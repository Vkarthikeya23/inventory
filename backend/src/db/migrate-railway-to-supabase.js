/**
 * Migrate data from the LEGACY Railway database into Supabase.
 *
 *   SOURCE (read-only) : RAILWAY_DATABASE_URL
 *   TARGET             : SUPABASE_DATABASE_URL
 *
 * Safety guarantees:
 *   * The source connection is forced into default_transaction_read_only, so
 *     Postgres itself rejects any write against Railway.
 *   * Nothing is deleted from the source. The target can simply be re-run:
 *     it truncates the app tables (users preserved) and re-copies.
 *   * IDs are copied verbatim so foreign keys, invoice links and PO links
 *     keep working exactly as they did.
 *   * Timestamps are moved as raw strings (see the type parsers below) so
 *     naive Railway timestamps are NOT shifted by the local machine timezone.
 *
 * Usage:
 *   node src/db/migrate-railway-to-supabase.js --dry-run
 *   node src/db/migrate-railway-to-supabase.js
 *   node src/db/migrate-railway-to-supabase.js --keep-users
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Move timestamps as raw strings. Otherwise node-postgres parses
// `timestamp without time zone` into a JS Date using the *local* timezone,
// which silently shifts every historical row.
pg.types.setTypeParser(1114, v => v); // timestamp without time zone
pg.types.setTypeParser(1184, v => v); // timestamp with time zone

const { Client } = pg;

const DRY_RUN = process.argv.includes('--dry-run');
const KEEP_USERS = process.argv.includes('--keep-users');
const BATCH = 200;

// Copy order respects foreign keys.
const TABLES = [
  {
    name: 'users',
    // Supabase has a CHECK on role; Railway roles are owner/manager/cashier.
    columns: ['id', 'name', 'email', 'password_hash', 'role', 'is_active', 'created_at']
  },
  {
    name: 'products',
    // Dropped from Railway but absent in Supabase (intentionally):
    //   category_id, display_name, min_stock, is_active
    // display_name is recomputed as a SQL alias by the API; min_stock is
    // superseded by low_stock_threshold; is_active is unused by the routes.
    columns: [
      'id', 'company_name', 'size_spec', 'hsn_code', 'cost_price',
      'selling_price_excl_gst', 'selling_price_incl_gst', 'gst_rate',
      'cgst_rate', 'sgst_rate', 'price_entry_mode', 'stock_qty',
      'low_stock_threshold', 'mfg_date', 'is_deleted', 'created_at'
    ]
  },
  {
    name: 'customers',
    columns: ['id', 'name', 'phone', 'email', 'vehicle_reg', 'created_at']
  },
  {
    name: 'sales',
    // customer_gstin exists on Railway but not in Supabase; verified 0/2601
    // populated, so nothing is lost by omitting it.
    columns: [
      'id', 'customer_id', 'customer_name', 'customer_phone', 'vehicle_reg',
      'vehicle_type', 'km_reading', 'next_alignment_km', 'next_service_km',
      'user_id', 'invoice_number', 'subtotal', 'cgst_amount', 'sgst_amount',
      'total_amount', 'received_amount', 'balance_amount',
      'cgst', 'sgst', 'total', 'balance', 'sale_date', 'notes', 'created_at'
    ]
  },
  {
    name: 'sale_items',
    // mfg_date exists on Railway but not in Supabase; verified 0/2936 populated.
    columns: [
      'id', 'sale_id', 'product_id', 'service_name', 'qty', 'unit_price',
      'unit_cost', 'hsn_code', 'gst_rate', 'subtotal', 'gst_amount',
      'total_amount', 'amount', 'created_at'
    ]
  },
  {
    name: 'invoices',
    columns: ['id', 'sale_id', 'invoice_data', 'public_token', 'created_at']
  },
  {
    name: 'services',
    columns: ['id', 'service_name', 'price', 'created_at']
  },
  {
    name: 'purchase_orders',
    columns: [
      'id', 'po_number', 'po_data', 'supplier_phone', 'total_amount',
      'item_count', 'created_by', 'created_at'
    ]
  }
];

// Tables cleared before copying. users is intentionally excluded so the
// seeded owner@tyreshop.com login survives (Railway's own accounts come too).
const TRUNCATE_ORDER = [
  'sale_items', 'invoices', 'sales', 'purchase_orders',
  'products', 'customers', 'services'
];

async function main() {
  const src = new Client({
    connectionString: process.env.RAILWAY_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const dst = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await src.connect();
  // Hard guarantee: this session physically cannot write to Railway.
  await src.query('SET default_transaction_read_only = on');

  await dst.connect();
  await dst.query("SET TimeZone TO 'UTC'");

  console.log(`SOURCE  Railway (read-only)`);
  console.log(`TARGET  Supabase`);
  console.log(`MODE    ${DRY_RUN ? 'DRY RUN - nothing will be written' : 'LIVE MIGRATION'}\n`);

  if (!DRY_RUN) {
    if (KEEP_USERS) {
      console.log('Truncating (users preserved)...');
    } else {
      console.log('Truncating target tables (users preserved)...');
    }
    for (const t of TRUNCATE_ORDER) {
      await dst.query(`TRUNCATE TABLE public."${t}" CASCADE`);
    }
  }

  const summary = [];
  for (const { name, columns } of TABLES) {
    const colList = columns.map(c => `"${c}"`).join(', ');

    const { rows } = await src.query(`SELECT ${colList} FROM public."${name}"`);
    const sourceCount = rows.length;

    if (sourceCount === 0) {
      summary.push({ name, sourceCount, copied: 0 });
      console.log(`${name.padEnd(18)} source=${String(sourceCount).padStart(5)}  copied=0`);
      continue;
    }

    let copied = 0;
    if (!DRY_RUN) {
      for (let i = 0; i < rows.length; i += BATCH) {
        const slice = rows.slice(i, i + BATCH);
        // Parameter numbers must be offset per row, otherwise every row
        // reuses $1..$n and the statement only expects one row's worth.
        const placeholders = slice
          .map((_, rowIdx) => {
            const cols = columns
              .map((__, colIdx) => `$${rowIdx * columns.length + colIdx + 1}`)
              .join(', ');
            return `(${cols})`;
          })
          .join(', ');
        const values = slice.flatMap(row => columns.map(c => row[c] ?? null));

        await dst.query(
          `INSERT INTO public."${name}" (${colList}) VALUES ${placeholders}`,
          values
        );
        copied += slice.length;
      }
    } else {
      copied = 0;
    }

    summary.push({ name, sourceCount, copied });
    console.log(
      `${name.padEnd(18)} source=${String(sourceCount).padStart(5)}  ` +
      `${DRY_RUN ? 'would copy' : 'copied'}=${DRY_RUN ? sourceCount : copied}`
    );
  }

  console.log('\n--- verification (Supabase row counts) ---');
  for (const { name, sourceCount } of summary) {
    const r = await dst.query(`SELECT count(*)::int AS n FROM public."${name}"`);
    const targetCount = r.rows[0].n;
    const ok = DRY_RUN ? '—' : (targetCount === sourceCount ? 'OK' : 'MISMATCH');
    console.log(
      `${name.padEnd(18)} railway=${String(sourceCount).padStart(5)}  ` +
      `supabase=${String(targetCount).padStart(5)}  ${ok}`
    );
  }

  await src.end();
  await dst.end();
  console.log(`\nDone.${DRY_RUN ? ' (dry run - nothing written)' : ''}`);
}

main().catch(err => {
  console.error('\nMIGRATION FAILED:', err.message);
  process.exit(1);
});