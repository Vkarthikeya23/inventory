import express from 'express';
import { get } from '../db/db.js';

const router = express.Router();

// Indian number formatting
function formatIndianNumber(num) {
  const amount = parseFloat(num) || 0;
  const [whole, decimal] = amount.toFixed(2).split('.');
  
  // Format whole number with Indian commas
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

router.get('/invoice/:invoice_number', async (req, res) => {
  try {
    const { invoice_number } = req.params;
    
    const result = await get(`
      SELECT i.invoice_data
      FROM invoices i
      JOIN sales s ON s.id = i.sale_id
      WHERE s.invoice_number = $invoice_number
    `, { invoice_number });
    
    if (!result) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Invoice Not Found</title></head>
        <body>
          <h1>Invoice Not Found</h1>
          <p>The invoice number "${invoice_number}" could not be found.</p>
        </body>
        </html>
      `);
    }
    
    const data = JSON.parse(result.invoice_data);
    
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tax Invoice ${data.invoice_number} - ${data.shop.name}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.5; 
            color: #333; 
            background: #f5f5f5; 
            padding: 20px;
          }
          .invoice-container { 
            max-width: 750px; 
            margin: 0 auto; 
            background: #fff; 
            padding: 30px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .header { 
            border-bottom: 2px solid #6c63ff; 
            padding-bottom: 15px; 
            margin-bottom: 20px;
          }
          .shop-name { 
            font-size: 22px; 
            font-weight: 700; 
            color: #333;
            margin-bottom: 5px;
          }
          .shop-phone {
            font-size: 14px;
            color: #666;
          }
          .tax-invoice-title {
            text-align: center;
            color: #6c63ff;
            font-size: 22px;
            font-weight: 600;
            margin: 20px 0;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
          .two-column {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            border: 1px solid #ddd;
          }
          .column {
            flex: 1;
            padding: 15px;
          }
          .column:first-child {
            border-right: 1px solid #ddd;
          }
          .column-label {
            font-weight: 600;
            color: #333;
            margin-bottom: 8px;
          }
          .customer-name {
            font-weight: 700;
            font-size: 16px;
            margin-bottom: 5px;
          }
          .detail-row {
            font-size: 14px;
            color: #555;
            margin: 3px 0;
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
            margin: 20px 0; 
            font-size: 14px;
          }
          th { 
            background: #6c63ff; 
            color: white; 
            font-weight: 600;
            padding: 12px 8px;
            text-align: left;
            border: 1px solid #6c63ff;
          }
          td { 
            padding: 10px 8px; 
            border: 1px solid #ddd; 
            vertical-align: top;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .item-name {
            font-weight: 500;
          }
          .totals-section {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
            border: 1px solid #ddd;
          }
          .words-column {
            flex: 1;
            padding: 15px;
            border-right: 1px solid #ddd;
          }
          .amounts-column {
            width: 280px;
            padding: 15px;
          }
          .amount-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            font-size: 14px;
          }
          .total-row {
            background: #6c63ff;
            color: white;
            font-weight: 700;
            padding: 10px;
            margin: 10px -15px -15px -15px;
          }
          .amount-in-words {
            font-weight: 600;
            color: #333;
            margin-bottom: 30px;
          }
          .thank-you {
            color: #666;
            font-style: italic;
            font-size: 13px;
          }
          .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #6c63ff;
          }
          .buttons {
            display: flex;
            gap: 10px;
          }
          .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          }
          .btn-print { 
            background: #6c63ff; 
            color: #fff; 
          }
          .btn-print:hover {
            background: #5a52d5;
          }
          .shop-signature {
            text-align: right;
            font-weight: 600;
            color: #333;
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
              padding: 0;
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
            margin: 10mm 12mm;
          }
          
          /* Responsive */
          @media screen and (max-width: 600px) {
            .two-column, .totals-section {
              flex-direction: column;
            }
            .column:first-child {
              border-right: none;
              border-bottom: 1px solid #ddd;
            }
            .words-column {
              border-right: none;
              border-bottom: 1px solid #ddd;
            }
            .amounts-column {
              width: 100%;
            }
            .footer {
              flex-direction: column;
              gap: 15px;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <!-- Header -->
          <div class="header">
            <div class="shop-name">${data.shop.name}</div>
            <div class="shop-phone">Phone no.: 9000909817, 9346513095, 9100717642</div>
            <div class="shop-address" style="font-size: 13px; color: #666; margin-top: 3px;">H.No. 3-25, Old RC Puram, Patancheru, Sangareddy Dist.</div>
            <div class="shop-gstin" style="font-size: 13px; color: #666; margin-top: 3px;">GSTIN: 36AVGPJ4122R1Z8</div>
          </div>
          
          <!-- Tax Invoice Title -->
          <div class="tax-invoice-title">Tax Invoice</div>
          
          <!-- Two Column Section -->
          <div class="two-column">
            <div class="column">
              <div class="column-label">Bill To</div>
              <div class="customer-name">${data.customer.name.toUpperCase()}</div>
              <div class="detail-row">Contact No.: ${data.customer.phone}</div>
              ${data.customer.vehicle_reg ? `<div class="detail-row">Car No.: ${data.customer.vehicle_reg}</div>` : ''}
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
                <th>Item name</th>
                <th style="width: 80px;">Qty</th>
                <th style="width: 120px;" class="text-right">Price/Unit</th>
                <th style="width: 120px;" class="text-right">GST</th>
                <th style="width: 120px;" class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${data.items.map((item, idx) => `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td class="item-name">${item.name}</td>
                  <td class="text-center">${item.qty}</td>
                  <td class="text-right">${formatIndianNumber(item.unit_price)}</td>
                  <td class="text-right">${formatIndianNumber(item.gst_amount)} (${item.gst_rate}%)</td>
                  <td class="text-right">${formatIndianNumber(item.amount)}</td>
                </tr>
              `).join('')}
              <!-- Total Row -->
              <tr style="background: #6c63ff; color: white; font-weight: 600;">
                <td colspan="2">Total</td>
                <td class="text-center">${data.items.reduce((sum, item) => sum + item.qty, 0)}</td>
                <td></td>
                <td class="text-right">${formatIndianNumber(data.items.reduce((sum, item) => sum + item.gst_amount, 0))}</td>
                <td class="text-right">${formatIndianNumber(data.total)}</td>
              </tr>
            </tbody>
          </table>
          
          <!-- Totals Section -->
          <div class="totals-section">
            <div class="words-column">
              <div class="amount-in-words">Invoice Amount In Words</div>
              <div>${data.amount_in_words}</div>
              <div style="margin-top: 20px; text-align: center;">
                <img src="/assets/stamp.png" alt="Stamp" style="width: 100px; height: auto; opacity: 0.8;">
              </div>
              <div class="thank-you" style="margin-top: 40px;">Thanks for doing business with us!</div>
            </div>
            <div class="amounts-column">
              <div class="amount-row">
                <span>Sub Total</span>
                <span>${formatIndianNumber(data.subtotal)}</span>
              </div>
              <div class="amount-row">
                <span>SGST@6%</span>
                <span>${formatIndianNumber(data.sgst)}</span>
              </div>
              <div class="amount-row">
                <span>CGST@6%</span>
                <span>${formatIndianNumber(data.cgst)}</span>
              </div>
              <div class="amount-row total-row">
                <span>Total</span>
                <span>${formatIndianNumber(data.total)}</span>
              </div>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <div class="buttons no-print">
              <button onclick="window.print()" class="btn btn-print">Download PDF</button>
              <button onclick="window.print()" class="btn btn-print">Print</button>
            </div>
            <div class="shop-signature">
              For: ${data.shop.name}
            </div>
          </div>
        </div>
        
        <script>
          // Set document title for printing
          document.title = 'Invoice-${data.invoice_number}';
          
          window.addEventListener('beforeprint', () => {
            document.title = 'Invoice-${data.invoice_number}';
          });
        </script>
      </body>
      </html>
    `;
    
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('Public invoice error:', err);
    res.status(500).send('<h1>Server Error</h1><p>Unable to load invoice. Please try again.</p>');
  }
});

export default router;
