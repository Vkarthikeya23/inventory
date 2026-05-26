// Vercel Serverless Function - Invoice Viewer
// Connects to Railway PostgreSQL and returns invoice HTML

import pg from 'pg';

const { Pool } = pg;

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Indian number formatting
function formatIndianNumber(num) {
  const amount = parseFloat(num) || 0;
  const [whole, decimal] = amount.toFixed(2).split('.');

  let formatted = '';
  let count = 0;

  for (let i = whole.length - 1; i >= 0; i--) {
    if (count === 3 || (count > 3 && (count - 3) % 2 === 0)) {
      formatted = ',' + formatted;
    }
    formatted = whole[i] + formatted;
    count++;
  }

  return `₹${formatted}.${decimal}`;
}

export default async function handler(req, res) {
  try {
    const { number } = req.query;

    if (!number) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Invalid Invoice</title></head>
        <body>
          <h1>Invalid Invoice Number</h1>
          <p>Please provide an invoice number.</p>
        </body>
        </html>
      `);
    }

    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT i.invoice_data
      FROM invoices i
      JOIN sales s ON s.id = i.sale_id
      WHERE s.invoice_number = $1
    `, [number]);

    client.release();

    if (result.rows.length === 0) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Invoice Not Found</title></head>
        <body>
          <h1>Invoice Not Found</h1>
          <p>The invoice number "${number}" could not be found.</p>
        </body>
        </html>
      `);
    }

    const data = JSON.parse(result.rows[0].invoice_data);

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice - ${data.shop.name}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.3;
            color: #333;
            background: #f5f5f5;
            padding: 8px;
          }
          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: #fff;
            padding: 12px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.15);
            border: 2px solid #000;
          }
          .header {
            padding-bottom: 8px;
            margin-bottom: 0;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .header-left {
            flex: 1;
          }
          .logo {
            width: 90px;
            height: 90px;
            object-fit: contain;
          }
          .shop-name {
            font-size: 24px;
            font-weight: 800;
            color: #000;
            margin-bottom: 4px;
            letter-spacing: 1px;
          }
          .shop-phone {
            font-size: 12px;
            color: #000;
            font-weight: 600;
          }
          .shop-address {
            font-size: 12px;
            color: #000;
            margin-top: 2px;
          }
          .shop-gstin {
            font-size: 12px;
            color: #000;
            margin-top: 2px;
            font-weight: 700;
          }
          .tax-invoice-title {
            text-align: center;
            color: #000;
            font-size: 18px;
            font-weight: 800;
            margin: 8px 0;
            text-transform: uppercase;
            letter-spacing: 3px;
            border: 3px solid #000;
            padding: 8px;
            background: #fff;
          }
          .two-column {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            border: 2px solid #000;
          }
          .column {
            flex: 1;
            padding: 10px;
          }
          .column:first-child {
            border-right: 2px solid #000;
            background: #fafafa;
          }
          .column:last-child {
            background: #fafafa;
          }
          .column-label {
            font-weight: 800;
            color: #000;
            margin-bottom: 6px;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            border-bottom: 2px solid #000;
            padding-bottom: 3px;
          }
          .customer-name {
            font-weight: 800;
            font-size: 14px;
            margin-bottom: 4px;
            color: #000;
          }
          .detail-row {
            font-size: 11px;
            color: #000;
            font-weight: 600;
            margin: 2px 0;
          }
          .invoice-details {
            text-align: right;
          }
          .invoice-details .detail-row {
            justify-content: flex-end;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
            font-size: 10px;
            border: 2px solid #000;
          }
          th {
            background: #000;
            color: #fff;
            font-weight: 800;
            padding: 8px 6px;
            text-align: left;
            border-bottom: 3px solid #000;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.8px;
          }
          td {
            padding: 6px;
            border: 2px solid #000;
            vertical-align: top;
            color: #000;
            font-weight: 500;
          }
          tbody tr:nth-child(even) {
            background: #e8e8e8;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .item-name {
            font-weight: 700;
            color: #000;
          }
          .item-service {
            color: #c62828;
          }
          .totals-section {
            display: flex;
            justify-content: space-between;
            margin-top: 10px;
            border: 2px solid #000;
          }
          .words-column {
            flex: 1;
            padding: 10px;
            border-right: 2px solid #000;
            background: #fafafa;
          }
          .amounts-column {
            width: 220px;
            padding: 10px;
            background: #fafafa;
          }
          .amount-row {
            display: flex;
            justify-content: space-between;
            padding: 3px 0;
            font-size: 11px;
            border-bottom: 1px solid #ddd;
          }
          .amount-row:last-child {
            border-bottom: none;
          }
          .total-row {
            background: #000;
            color: #fff;
            font-weight: 800;
            padding: 10px;
            margin: 8px -10px -10px -10px;
            font-size: 14px;
            letter-spacing: 1px;
          }
          .amount-in-words {
            font-weight: 800;
            color: #000;
            margin-bottom: 4px;
            font-size: 13px;
            text-transform: uppercase;
          }
          .thank-you {
            color: #444;
            font-size: 10px;
            margin-top: 12px;
            font-weight: 500;
          }
          .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 12px;
            padding-top: 10px;
            border-top: 2px solid #000;
          }
          .buttons {
            display: flex;
            gap: 8px;
          }
          .btn {
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
          }
          .btn-print {
            background: #333;
            color: #fff;
          }
          .btn-print:hover {
            background: #555;
          }
          .shop-signature {
            text-align: right;
            font-weight: 700;
            color: #000;
            font-size: 12px;
          }

          /* Print styles */
          @media print {
            body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .invoice-container { box-shadow: none; border: 2px solid #000; }
            .no-print { display: none !important; }
            th { background: #000 !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            tbody tr:nth-child(even) { background: #e0e0e0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            tbody tr { color: #000 !important; }
            td { border: 2px solid #000 !important; color: #000 !important; font-weight: 600 !important; }
            .total-row { background: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .total-row td { color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .item-name { color: #000 !important; font-weight: 700 !important; }
          }

          @page {
            size: A4;
            margin: 5mm 8mm;
          }

          /* Responsive */
          @media screen and (max-width: 600px) {
            body { padding: 5px; }
            .invoice-container { padding: 10px; max-width: 100%; }
            .header { flex-direction: column; text-align: center; gap: 10px; padding-bottom: 10px; }
            .header-left { width: 100%; }
            .logo { width: 60px; height: 60px; }
            .shop-name { font-size: 18px; }
            .shop-phone, .shop-address, .shop-gstin { font-size: 11px; }
            .logos { flex-direction: row; justify-content: center; }
            .tax-invoice-title { font-size: 14px; padding: 6px; margin: 10px 0; }
            .two-column { flex-direction: column; margin-bottom: 10px; }
            .column { padding: 10px; }
            .column:first-child { border-right: none; border-bottom: 2px solid #000; }
            .column-label { font-size: 12px; }
            .customer-name { font-size: 13px; }
            .detail-row { font-size: 11px; }
            table { font-size: 10px; margin: 10px 0; }
            th { padding: 6px 4px; font-size: 9px; }
            td { padding: 5px 4px; }
            .totals-section { flex-direction: column; margin-top: 10px; }
            .words-column { border-right: none; border-bottom: 2px solid #000; padding: 10px; }
            .amounts-column { width: 100%; padding: 10px; }
            .amount-row { font-size: 11px; }
            .total-row { margin: 6px -10px -10px -10px; padding: 6px 10px; }
            .footer { flex-direction: column; gap: 10px; margin-top: 10px; padding-top: 10px; }
            .shop-signature { text-align: center; font-size: 12px; }
            .btn { padding: 6px 12px; font-size: 12px; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <!-- Header -->
          <div class="header">
            <div class="header-left">
              <div class="shop-name">${data.shop.name}</div>
              <div class="shop-phone">Phone no.: 99499 56515, 9346513095, 9100717642</div>
              <div class="shop-address">H.No. 3-25, Old RC Puram, Patancheru, Sangareddy Dist.</div>
              <div class="shop-gstin">GSTIN: 36AVGPJ4122R1Z8</div>
            </div>
            <div class="logos" style="display: flex; gap: 10px; align-items: center;">
              <img src="/assets/logo.png" alt="Logo" class="logo">
            </div>
          </div>

          <!-- Tax Invoice Title -->
          <div class="tax-invoice-title">Tax Invoice</div>

          <!-- Two Column Section -->
          <div class="two-column">
            <div class="column">
              <div class="column-label">Bill To</div>
              <div class="customer-name">${data.customer.name.toUpperCase()}</div>
              ${data.customer.gstin ? `<div class="detail-row">GSTIN: ${data.customer.gstin}</div>` : ''}
              <div class="detail-row">Contact No.: ${data.customer.phone}</div>
              ${data.customer.vehicle_reg ? `<div class="detail-row">Vehicle No.: ${data.customer.vehicle_reg}</div>` : ''}
              ${data.customer.vehicle_type ? `<div class="detail-row">Vehicle Type: ${data.customer.vehicle_type}</div>` : ''}
              ${data.customer.km_reading ? `<div class="detail-row">KM Reading: ${data.customer.km_reading}</div>` : ''}
              ${data.customer.next_service_km ? `<div class="detail-row">Next Service in: ${data.customer.next_service_km} KM</div>` : ''}
            </div>
            <div class="column invoice-details">
              <div class="column-label">Invoice Details</div>
              <div class="detail-row">Invoice No.: ${data.invoice_number}</div>
              <div class="detail-row">Date: ${data.sale_date ? new Date(data.sale_date).toLocaleDateString('en-GB').replace(/\//g, '-') : 'N/A'}</div>
            </div>
          </div>

          <!-- Line Items Table -->
          <table>
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th>Description</th>
                <th style="width: 70px;">Qty</th>
                <th style="width: 100px;" class="text-right">Rate (₹)</th>
                <th style="width: 70px;" class="text-center">HSN</th>
                <th style="width: 80px;" class="text-right">CGST</th>
                <th style="width: 80px;" class="text-right">SGST</th>
                <th style="width: 100px;" class="text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${data.items.map((item, idx) => `
                <tr class="data-row">
                  <td class="text-center">${idx + 1}</td>
                  <td class="${item.is_service ? 'item-name item-service' : 'item-name'}">
                    ${item.name}
                    ${!item.is_service && item.mfg_date ? `<div style="font-size: 9px; color: #666; margin-top: 2px;">MFG date: ${item.mfg_date}</div>` : ''}
                  </td>
                  <td class="text-center">${item.qty}</td>
                  <td class="text-right">${formatIndianNumber(item.unit_price)}</td>
                  <td class="text-center">${item.hsn_code || '-'}</td>
                  <td class="text-right">${formatIndianNumber(item.cgst_amount !== undefined ? item.cgst_amount : (item.gst_amount / 2))}</td>
                  <td class="text-right">${formatIndianNumber(item.sgst_amount !== undefined ? item.sgst_amount : (item.gst_amount / 2))}</td>
                  <td class="text-right" style="font-weight: 600;">${formatIndianNumber(item.amount)}</td>
                </tr>
              `).join('')}
              <!-- Total Row -->
              <tr class="total-table-row" style="background: #000 !important; font-weight: 800; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                <td colspan="4" style="padding: 14px 10px; font-size: 12px; letter-spacing: 1px; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">TOTAL</td>
                <td style="color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></td>
                <td class="text-right" style="padding: 14px 10px; font-weight: 800; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">${formatIndianNumber(data.cgst)}</td>
                <td class="text-right" style="padding: 14px 10px; font-weight: 800; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">${formatIndianNumber(data.sgst)}</td>
                <td class="text-right" style="padding: 14px 10px; font-weight: 800; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">${formatIndianNumber(data.total)}</td>
              </tr>
            </tbody>
          </table>

          <!-- Totals Section -->
          <div class="totals-section">
            <div class="words-column">
              <div class="amount-in-words">Amount In Words</div>
              <div style="font-size: 15px; font-weight: 600; color: #1a1a1a;">${data.amount_in_words}</div>
              <div class="thank-you">Thanks for doing business with us!</div>
            </div>
            <div class="amounts-column">
              <div class="amount-row">
                <span style="font-weight: 800; color: #000;">Sub Total</span>
                <span style="font-weight: 800; color: #000;">${formatIndianNumber(data.subtotal)}</span>
              </div>
              ${(data.sgst > 0 || data.cgst > 0) ? `
              <div class="amount-row">
                <span style="color: #000; font-weight: 600;">CGST @ ${data.subtotal > 0 ? ((data.cgst / data.subtotal) * 100).toFixed(1) : 0}%</span>
                <span style="color: #000; font-weight: 600;">${formatIndianNumber(data.cgst)}</span>
              </div>
              <div class="amount-row">
                <span style="color: #000; font-weight: 600;">SGST @ ${data.subtotal > 0 ? ((data.sgst / data.subtotal) * 100).toFixed(1) : 0}%</span>
                <span style="color: #000; font-weight: 600;">${formatIndianNumber(data.sgst)}</span>
              </div>
              ` : ''}
              <div class="total-row">
                <span style="color: #fff;">TOTAL</span>
                <span style="color: #fff;">${formatIndianNumber(data.total)}</span>
              </div>
              <div style="margin-top: 40px; text-align: center;">
                <img src="/assets/stamp.png?v=${Date.now()}" alt="Stamp" style="width: 120px; height: auto;">
                <div style="font-size: 16px; font-weight: 800; margin-top: 10px; color: #000;">Authorized Signature</div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div class="buttons no-print">
              <button onclick="window.print()" class="btn btn-print">Print</button>
            </div>
            <div class="shop-signature">
              For: ${data.shop.name}
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch (err) {
    console.error('Invoice API error:', err);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Error</title></head>
      <body>
        <h1>Server Error</h1>
        <p>Error: ${err.message}</p>
        <pre>${err.stack}</pre>
      </body>
      </html>
    `);
  }
}
