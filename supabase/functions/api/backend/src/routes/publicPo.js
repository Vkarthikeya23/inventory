import express from '../../../express-lite.ts';
import { get } from '../db/db.js';

const router = express.Router();

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(amount) {
  const value = parseFloat(amount) || 0;
  return `Rs.${value.toFixed(2)}`;
}

router.get('/po/:po_number', async (req, res) => {
  try {
    const { po_number } = req.params;

    const result = await get(`
      SELECT po_number, po_data, supplier_phone, total_amount, item_count, created_at
      FROM purchase_orders
      WHERE po_number = $po_number
    `, { po_number });

    if (!result) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Purchase Order Not Found</title></head>
        <body style="font-family: sans-serif; background: #F7F5F0; padding: 40px; color: #2E2C27;">
          <h1>Purchase Order Not Found</h1>
          <p>The purchase order "${escapeHtml(po_number)}" could not be found.</p>
        </body>
        </html>
      `);
    }

    let data;
    try {
      data = JSON.parse(result.po_data);
    } catch {
      data = {};
    }

    const columns = data.columns || {};
    const showStock = !!columns.current_stock;
    const showQty = !!columns.quantity;
    const showCost = !!columns.cost_price;
    const showTotal = showQty && showCost;
    const items = Array.isArray(data.items) ? data.items : [];
    const totalQty = items.reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0);
    const poDate = data.date ? new Date(data.date) : new Date(result.created_at);

    const headCells = [
      '<th style="text-align:left;padding:10px 12px;">#</th>',
      '<th style="text-align:left;padding:10px 12px;">Product</th>'
    ];
    if (showStock) headCells.push('<th style="text-align:right;padding:10px 12px;">Current Stock</th>');
    if (showQty) headCells.push('<th style="text-align:center;padding:10px 12px;">Quantity</th>');
    if (showCost) headCells.push('<th style="text-align:right;padding:10px 12px;">Cost Price</th>');
    if (showTotal) headCells.push('<th style="text-align:right;padding:10px 12px;">Total</th>');

    const rows = items.map((item, index) => {
      const cells = [
        `<td style="padding:10px 12px;border-bottom:1px solid #D4D0C8;">${index + 1}</td>`,
        `<td style="padding:10px 12px;border-bottom:1px solid #D4D0C8;font-weight:500;">${escapeHtml(item.name)}</td>`
      ];
      if (showStock) cells.push(`<td style="padding:10px 12px;border-bottom:1px solid #D4D0C8;text-align:right;">${parseInt(item.current_stock, 10) || 0}</td>`);
      if (showQty) cells.push(`<td style="padding:10px 12px;border-bottom:1px solid #D4D0C8;text-align:center;">${parseInt(item.qty, 10) || 0}</td>`);
      if (showCost) cells.push(`<td style="padding:10px 12px;border-bottom:1px solid #D4D0C8;text-align:right;">${formatMoney(item.cost_price)}</td>`);
      if (showTotal) cells.push(`<td style="padding:10px 12px;border-bottom:1px solid #D4D0C8;text-align:right;">${formatMoney(item.line_total)}</td>`);
      return `<tr>${cells.join('')}</tr>`;
    }).join('\n');

    // Totals sit side by side when both are available. Quantity is labelled
    // "Quantity" rather than "Tyres" because a PO can mix tyres with services.
    const totalParts = [];
    if (showTotal) {
      totalParts.push(`<div class="total-line">Total Amount: ${formatMoney(result.total_amount)}</div>`);
    }
    if (showQty) {
      totalParts.push(`<div class="total-line">Total Quantity: ${totalQty}</div>`);
    }
    const totalsHtml = totalParts.length === 0
      ? ''
      : totalParts.length === 1
        ? totalParts[0]
        : `<div class="totals-row">${totalParts.join('')}</div>`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Purchase Order - ${escapeHtml(result.po_number)}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #F7F5F0;
            color: #2E2C27;
            padding: 30px 15px;
          }
          .sheet {
            max-width: 800px;
            margin: 0 auto;
            background: #fff;
            border: 1px solid #D4D0C8;
            border-radius: 12px;
            padding: 36px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.08);
          }
          .shop-name {
            text-align: center;
            font-size: 24px;
            font-weight: 700;
            color: #4A8A62;
            letter-spacing: 1px;
          }
          .shop-detail {
            text-align: center;
            font-size: 13px;
            color: #6B6860;
            margin-top: 4px;
          }
          .title {
            text-align: center;
            margin-top: 26px;
            font-size: 18px;
            font-weight: 700;
            color: #2E2C27;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
          .meta {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
            font-size: 14px;
            color: #2E2C27;
            flex-wrap: wrap;
            gap: 8px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 14px;
          }
          thead th {
            background: #4A8A62;
            color: #fff;
            border: 1px solid #4A8A62;
          }
          tbody td { border: 1px solid #D4D0C8; }
          .total-row td {
            font-weight: 700;
            background: #E8E4DA;
          }
          .total-line {
            text-align: right;
            margin-top: 16px;
            font-size: 16px;
            font-weight: 700;
            color: #4A8A62;
          }
          .totals-row {
            display: flex;
            justify-content: flex-end;
            gap: 36px;
            margin-top: 16px;
            flex-wrap: wrap;
          }
          .totals-row .total-line {
            margin-top: 0;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #6B6860;
            border-top: 1px solid #D4D0C8;
            padding-top: 14px;
          }
          .actions {
            max-width: 800px;
            margin: 20px auto 0;
            text-align: center;
          }
          .btn {
            display: inline-block;
            padding: 10px 24px;
            background: #4A8A62;
            color: #fff;
            border: none;
            border-radius: 8px;
            font-size: 15px;
            cursor: pointer;
            margin: 0 6px;
          }
          @media print {
            body { background: #fff; padding: 0; }
            .sheet { border: none; box-shadow: none; padding: 10px; }
            .actions { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="shop-name">SRI MAHALAKSHMI TYRES</div>
          <div class="shop-detail">H.No. 3-25, Old RC Puram, Patancheru, Sangareddy Dist.</div>
          <div class="shop-detail">Phone no.: 99499 56515, 9346513095, 9100717642</div>
          <div class="shop-detail">GSTIN: 36AVGPJ4122R1Z8</div>

          <div class="title">Purchase Order</div>

          <div class="meta">
            <span><strong>PO #:</strong> ${escapeHtml(result.po_number)}</span>
            <span><strong>Date:</strong> ${poDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
          ${result.supplier_phone ? `<div class="meta"><span><strong>WhatsApp:</strong> ${escapeHtml(result.supplier_phone)}</span></div>` : ''}

          <table>
            <thead>
              <tr>${headCells.join('')}</tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="9" style="padding:16px;text-align:center;color:#6B6860;">No items</td></tr>'}
            </tbody>
          </table>

          ${totalsHtml}

          <div class="footer">
            This is a purchase order for stock replenishment.<br>
            Please confirm availability and delivery schedule.
          </div>
        </div>

        <div class="actions">
          <button class="btn" onclick="window.print()">🖨️ Print / Save PDF</button>
        </div>
      </body>
      </html>
    `;

    res.send(html);
  } catch (err) {
    console.error('Public purchase order error:', err);
    res.status(500).send(`
      <!DOCTYPE html>
      <html><head><title>Error</title></head>
      <body style="font-family: sans-serif; padding: 40px;">
        <h1>Something went wrong</h1>
        <p>Please try again later.</p>
      </body></html>
    `);
  }
});

export default router;
