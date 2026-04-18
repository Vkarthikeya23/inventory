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
            padding: 15px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.15);
            border: 2px solid #4a4a4a;
          }
          .header {
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .header-left {
            flex: 1;
          }
          .logo {
            width: 60px;
            height: 60px;
            object-fit: contain;
          }
          .shop-name {
            font-size: 18px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 3px;
            letter-spacing: 0.5px;
          }
          .shop-phone {
            font-size: 11px;
            color: #444;
            font-weight: 500;
          }
          .shop-address {
            font-size: 10px;
            color: #666;
            margin-top: 2px;
          }
          .shop-gstin {
            font-size: 10px;
            color: #666;
            margin-top: 1px;
            font-weight: 600;
          }
          .tax-invoice-title {
            text-align: center;
            color: #333;
            font-size: 16px;
            font-weight: 700;
            margin: 10px 0;
            text-transform: uppercase;
            letter-spacing: 2px;
            border: 2px solid #333;
            padding: 6px;
            background: linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 100%);
          }
          .two-column {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            border: 2px solid #444;
          }
          .column {
            flex: 1;
            padding: 10px;
          }
          .column:first-child {
            border-right: 2px solid #444;
            background: #fafafa;
          }
          .column:last-child {
            background: #fafafa;
          }
          .column-label {
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 4px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 2px;
          }
          .customer-name {
            font-weight: 700;
            font-size: 12px;
            margin-bottom: 3px;
            color: #1a1a1a;
          }
          .detail-row {
            font-size: 10px;
            color: #333;
            margin: 1px 0;
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
            border: 2px solid #333;
          }
          th {
            background: #333;
            color: white;
            font-weight: 700;
            padding: 5px 4px;
            text-align: left;
            border-bottom: 2px solid #222;
            text-transform: uppercase;
            font-size: 9px;
            letter-spacing: 0.5px;
          }
          td {
            padding: 4px;
            border: 1px solid #999;
            vertical-align: top;
            color: #333;
          }
          tbody tr:nth-child(even) {
            background: #f9f9f9;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .item-name {
            font-weight: 600;
            color: #1a1a1a;
          }
          .item-service {
            color: #c62828;
          }
          .totals-section {
            display: flex;
            justify-content: space-between;
            margin-top: 10px;
            border: 2px solid #444;
          }
          .words-column {
            flex: 1;
            padding: 10px;
            border-right: 2px solid #444;
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
            font-size: 10px;
            border-bottom: 1px solid #ddd;
          }
          .amount-row:last-child {
            border-bottom: none;
          }
          .total-row {
            background: #333;
            color: white;
            font-weight: 700;
            padding: 6px 10px;
            margin: 6px -10px -10px -10px;
            font-size: 11px;
          }
          .amount-in-words {
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 4px;
            font-size: 11px;
            text-transform: uppercase;
          }
          .thank-you {
            color: #444;
            font-size: 10px;
            margin-top: 12px;
            font-weight: 500;
          }
          .warranty-box {
            margin-top: 8px;
            padding: 5px 6px;
            background-color: #fffde7;
            border: 1px solid #ffc107;
            border-radius: 4px;
            font-size: 8px;
            color: #856404;
            font-weight: 500;
          }
          .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 12px;
            padding-top: 10px;
            border-top: 2px solid #333;
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
            color: #1a1a1a;
            font-size: 12px;
          }

          /* Print styles */
          @media print {
            body {
              background: #fff;
              padding: 0;
            }
            .invoice-container {
              box-shadow: none;
              max-width: 100%;
              padding: 10px 15px;
              border: none;
            }
            .header {
              padding-bottom: 8px;
              margin-bottom: 8px;
              gap: 10px;
            }
            .logo {
              width: 55px;
              height: 55px;
            }
            .shop-name {
              font-size: 16px;
              margin-bottom: 2px;
            }
            .shop-phone, .shop-address, .shop-gstin {
              font-size: 9px;
            }
            .tax-invoice-title {
              font-size: 14px;
              padding: 5px;
              margin: 8px 0;
            }
            .two-column {
              margin-bottom: 8px;
            }
            .column {
              padding: 8px;
            }
            .column-label {
              font-size: 10px;
              margin-bottom: 3px;
              padding-bottom: 2px;
            }
            .customer-name {
              font-size: 11px;
            }
            .detail-row {
              font-size: 9px;
              margin: 1px 0;
            }
            table {
              margin: 8px 0;
              font-size: 9px;
            }
            th {
              padding: 4px 3px;
              font-size: 8px;
            }
            td {
              padding: 3px;
            }
            .totals-section {
              margin-top: 8px;
            }
            .words-column, .amounts-column {
              padding: 8px;
            }
            .amount-row {
              font-size: 9px;
              padding: 2px 0;
            }
            .total-row {
              padding: 5px 8px;
              margin: 5px -8px -8px -8px;
              font-size: 10px;
            }
            .amount-in-words {
              font-size: 10px;
              margin-bottom: 3px;
            }
            .thank-you {
              font-size: 9px;
              margin-top: 8px;
            }
            .warranty-box {
              margin-top: 6px;
              padding: 4px 6px;
              font-size: 8px;
            }
            .footer {
              margin-top: 10px;
              padding-top: 8px;
            }
            .shop-signature {
              font-size: 11px;
            }
            .no-print {
              display: none !important;
            }
            .two-column, .totals-section {
              break-inside: avoid;
            }
            table {
              break-inside: avoid;
            }
          }

          @page {
            size: A4;
            margin: 5mm 8mm;
          }

          /* Responsive */
          @media screen and (max-width: 600px) {
            body {
              padding: 5px;
            }
            .invoice-container {
              padding: 10px;
              max-width: 100%;
            }
            .header {
              flex-direction: column;
              text-align: center;
              gap: 10px;
              padding-bottom: 10px;
            }
            .header-left {
              width: 100%;
            }
            .logo {
              width: 60px;
              height: 60px;
            }
            .shop-name {
              font-size: 18px;
            }
            .shop-phone, .shop-address, .shop-gstin {
              font-size: 11px;
            }
            .logos {
              flex-direction: row;
              justify-content: center;
            }
            .tax-invoice-title {
              font-size: 14px;
              padding: 6px;
              margin: 10px 0;
            }
            .two-column {
              flex-direction: column;
              margin-bottom: 10px;
            }
            .column {
              padding: 10px;
            }
            .column:first-child {
              border-right: none;
              border-bottom: 2px solid #444;
            }
            .column-label {
              font-size: 12px;
            }
            .customer-name {
              font-size: 13px;
            }
            .detail-row {
              font-size: 11px;
            }
            table {
              font-size: 10px;
              margin: 10px 0;
            }
            th {
              padding: 6px 4px;
              font-size: 9px;
            }
            td {
              padding: 5px 4px;
            }
            .totals-section {
              flex-direction: column;
              margin-top: 10px;
            }
            .words-column {
              border-right: none;
              border-bottom: 2px solid #444;
              padding: 10px;
            }
            .amounts-column {
              width: 100%;
              padding: 10px;
            }
            .amount-row {
              font-size: 11px;
            }
            .total-row {
              margin: 6px -10px -10px -10px;
              padding: 6px 10px;
            }
            .footer {
              flex-direction: column;
              gap: 10px;
              margin-top: 10px;
              padding-top: 10px;
            }
            .shop-signature {
              text-align: center;
              font-size: 12px;
            }
            .btn {
              padding: 6px 12px;
              font-size: 12px;
            }
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
              <div class="detail-row">Contact No.: ${data.customer.phone}</div>
              ${data.customer.vehicle_reg ? `<div class="detail-row">Vehicle No.: ${data.customer.vehicle_reg}</div>` : ''}
              ${data.customer.vehicle_type ? `<div class="detail-row">Vehicle Type: ${data.customer.vehicle_type}</div>` : ''}
              ${data.customer.km_reading ? `<div class="detail-row">KM Reading: ${data.customer.km_reading}</div>` : ''}
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
                <th style="width: 100px;" class="text-right">GST (₹)</th>
                <th style="width: 100px;" class="text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${data.items.map((item, idx) => `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td class="${item.is_service ? 'item-name item-service' : 'item-name'}">${item.name}</td>
                  <td class="text-center">${item.qty}</td>
                  <td class="text-right">${formatIndianNumber(item.unit_price)}</td>
                  <td class="text-center">${item.hsn_code || '-'}</td>
                  <td class="text-right">${formatIndianNumber(item.gst_amount)}</td>
                  <td class="text-right" style="font-weight: 600;">${formatIndianNumber(item.amount)}</td>
                </tr>
              `).join('')}
              <!-- Total Row -->
              <tr style="background: #333; color: white; font-weight: 700;">
                <td colspan="3" style="padding: 14px 10px;">TOTAL</td>
                <td></td>
                <td></td>
                <td class="text-right" style="padding: 14px 10px;">${formatIndianNumber(data.items.reduce((sum, item) => sum + item.gst_amount, 0))}</td>
                <td class="text-right" style="padding: 14px 10px;">${formatIndianNumber(data.total)}</td>
              </tr>
            </tbody>
          </table>

          <!-- Totals Section -->
          <div class="totals-section">
            <div class="words-column">
              <div class="amount-in-words">Amount In Words</div>
              <div style="font-size: 15px; font-weight: 600; color: #1a1a1a;">${data.amount_in_words}</div>
              <div class="thank-you">Thanks for doing business with us!</div>
              <div class="warranty-box">
                Free inspection/service is available for any issues related to the work performed, valid for 15 days from the date of installation.
              </div>
            </div>
            <div class="amounts-column">
              <div class="amount-row">
                <span style="font-weight: 600;">Sub Total</span>
                <span style="font-weight: 600;">${formatIndianNumber(data.subtotal)}</span>
              </div>
              <div class="amount-row">
                <span>SGST @ 6%</span>
                <span>${formatIndianNumber(data.sgst)}</span>
              </div>
              <div class="amount-row">
                <span>CGST @ 6%</span>
                <span>${formatIndianNumber(data.cgst)}</span>
              </div>
              <div class="total-row">
                <span>TOTAL</span>
                <span>${formatIndianNumber(data.total)}</span>
              </div>
              <div style="margin-top: 30px; text-align: center;">
                <img src="/assets/stamp.png" alt="Stamp" style="width: 85px; height: auto; opacity: 0.9;">
                <div style="font-size: 13px; font-weight: 600; margin-top: 5px; color: #333;">Authorized Signature</div>
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

        <script>
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