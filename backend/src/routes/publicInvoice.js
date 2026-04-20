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
            border: 2px solid #333;
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
            background: #f5f5f5;
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
            background: #000;
            color: #fff;
            font-weight: 800;
            padding: 10px;
            margin: 8px -10px -10px -10px;
            font-size: 14px;
            letter-spacing: 1px;
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
          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: #fff;
            padding: 20px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.15);
            border: 2px solid #4a4a4a;
          }
          .header {
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 15px;
          }
          .header-left {
            flex: 1;
          }
          .logo {
            width: 70px;
            height: 70px;
            object-fit: contain;
          }
          .shop-name {
            font-size: 22px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 5px;
            letter-spacing: 0.5px;
          }
          .shop-phone {
            font-size: 13px;
            color: #444;
            font-weight: 500;
          }
          .shop-address {
            font-size: 12px;
            color: #666;
            margin-top: 3px;
          }
          .shop-gstin {
            font-size: 12px;
            color: #666;
            margin-top: 2px;
            font-weight: 600;
          }
          .tax-invoice-title {
            text-align: center;
            color: #333;
            font-size: 18px;
            font-weight: 700;
            margin: 15px 0;
            text-transform: uppercase;
            letter-spacing: 2px;
            border: 2px solid #333;
            padding: 8px;
            background: linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 100%);
          }
          .two-column {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
            border: 2px solid #444;
          }
          .column {
            flex: 1;
            padding: 12px;
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
            margin-bottom: 6px;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 3px;
          }
          .customer-name {
            font-weight: 700;
            font-size: 14px;
            margin-bottom: 4px;
            color: #1a1a1a;
          }
          .detail-row {
            font-size: 12px;
            color: #333;
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
            margin: 15px 0;
            font-size: 12px;
            border: 2px solid #333;
          }
          th {
            background: #333;
            color: white;
            font-weight: 700;
            padding: 8px 6px;
            text-align: left;
            border-bottom: 2px solid #222;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
          }
          td {
            padding: 6px;
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
            margin-top: 15px;
            border: 2px solid #444;
          }
          .words-column {
            flex: 1;
            padding: 12px;
            border-right: 2px solid #444;
            background: #fafafa;
          }
          .amounts-column {
            width: 250px;
            padding: 12px;
            background: #fafafa;
          }
          .amount-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            font-size: 12px;
            border-bottom: 1px solid #ddd;
          }
          .amount-row:last-child {
            border-bottom: none;
          }
          .total-row {
            background: #333;
            color: white;
            font-weight: 700;
            padding: 8px 12px;
            margin: 8px -12px -12px -12px;
            font-size: 13px;
          }
          .amount-in-words {
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 6px;
            font-size: 13px;
          }
          .thank-you {
            color: #444;
            font-size: 12px;
            margin-top: 15px;
            font-weight: 500;
          }
          .warranty-box {
            margin-top: 10px;
            padding: 6px 8px;
            background-color: #fffde7;
            border: 1px solid #ffc107;
            border-radius: 4px;
            font-size: 10px;
            color: #856404;
            font-weight: 500;
          }
          .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 2px solid #333;
          }
          .buttons {
            display: flex;
            gap: 10px;
          }
          .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
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
            font-size: 14px;
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
              padding: 15px;
              border: none;
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
            margin: 8mm 10mm;
          }

          /* Responsive */
          @media screen and (max-width: 600px) {
            .two-column, .totals-section {
              flex-direction: column;
            }
            .column:first-child {
              border-right: none;
              border-bottom: 2px solid #444;
            }
            .words-column {
              border-right: none;
              border-bottom: 2px solid #444;
            }
            .amounts-column {
              width: 100%;
            }
            .footer {
              flex-direction: column;
              gap: 15px;
            }
            .header {
              flex-direction: column;
              text-align: center;
            }
          }
          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: #fff;
            padding: 30px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.15);
            border: 3px solid #4a4a4a;
          }
          .header {
            border-bottom: 3px solid #333;
            padding-bottom: 20px;
            margin-bottom: 25px;
            display: flex;
            align-items: center;
            gap: 20px;
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
            font-size: 26px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 8px;
            letter-spacing: 0.5px;
          }
          .shop-phone {
            font-size: 14px;
            color: #444;
            font-weight: 500;
          }
          .shop-address {
            font-size: 13px;
            color: #666;
            margin-top: 5px;
          }
          .shop-gstin {
            font-size: 13px;
            color: #666;
            margin-top: 3px;
            font-weight: 600;
          }
          .tax-invoice-title {
            text-align: center;
            color: #333;
            font-size: 24px;
            font-weight: 700;
            margin: 25px 0;
            text-transform: uppercase;
            letter-spacing: 3px;
            border: 2px solid #333;
            padding: 12px;
            background: linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 100%);
          }
          .two-column {
            display: flex;
            justify-content: space-between;
            margin-bottom: 25px;
            border: 2px solid #444;
          }
          .column {
            flex: 1;
            padding: 18px;
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
            margin-bottom: 10px;
            font-size: 15px;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 5px;
          }
          .customer-name {
            font-weight: 700;
            font-size: 18px;
            margin-bottom: 8px;
            color: #1a1a1a;
          }
          .detail-row {
            font-size: 14px;
            color: #333;
            margin: 5px 0;
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
            margin: 25px 0;
            font-size: 14px;
            border: 2px solid #333;
          }
          th {
            background: #333;
            color: white;
            font-weight: 700;
            padding: 14px 10px;
            text-align: left;
            border-bottom: 2px solid #222;
            text-transform: uppercase;
            font-size: 13px;
            letter-spacing: 0.5px;
          }
          td {
            padding: 12px 10px;
            border: 1px solid #999;
            vertical-align: top;
            color: #333;
          }
          tbody tr:nth-child(even) {
            background: #f9f9f9;
          }
          tbody tr:hover {
            background: #f0f0f0;
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
            margin-top: 25px;
            border: 2px solid #444;
          }
          .words-column {
            flex: 1;
            padding: 20px;
            border-right: 2px solid #444;
            background: #fafafa;
          }
          .amounts-column {
            width: 300px;
            padding: 20px;
            background: #fafafa;
          }
          .amount-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 14px;
            border-bottom: 1px solid #ddd;
          }
          .amount-row:last-child {
            border-bottom: none;
          }
          .total-row {
            background: #333;
            color: white;
            font-weight: 700;
            padding: 12px 15px;
            margin: 10px -20px -20px -20px;
            font-size: 16px;
          }
          .amount-in-words {
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 10px;
            font-size: 16px;
            text-transform: uppercase;
          }
          .thank-you {
            color: #444;
            font-size: 14px;
            margin-top: 30px;
            font-weight: 500;
          }
          .warranty-box {
            margin-top: 20px;
            padding: 12px 15px;
            background-color: #fffde7;
            border: 1px solid #ffc107;
            border-radius: 4px;
            font-size: 12px;
            color: #856404;
            font-weight: 500;
          }
          .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 3px solid #333;
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
            font-size: 16px;
          }

          /* Print styles - Optimized for readability on A4 */
          @media print {
            body {
              background: #fff;
              padding: 0;
              color: #000 !important;
            }
            .invoice-container {
              box-shadow: none;
              max-width: 100%;
              padding: 12px 15px;
              border: 2px solid #000;
              color: #000 !important;
            }
            .header {
              padding-bottom: 10px;
              margin-bottom: 10px;
              gap: 12px;
              border-bottom: 2px solid #000;
            }
            .logo {
              width: 65px;
              height: 65px;
            }
            .shop-name {
              font-size: 18px;
              margin-bottom: 4px;
              color: #000 !important;
              font-weight: 800;
            }
            .shop-phone, .shop-address, .shop-gstin {
              font-size: 11px;
              color: #000 !important;
              font-weight: 600;
            }
            .tax-invoice-title {
              font-size: 16px;
              padding: 8px;
              margin: 10px 0;
              border: 2px solid #000;
              color: #000 !important;
              font-weight: 800;
            }
            .two-column {
              margin-bottom: 10px;
              border: 2px solid #000;
            }
            .column {
              padding: 10px;
              border-right: 2px solid #000;
            }
            .column-label {
              font-size: 11px;
              margin-bottom: 4px;
              padding-bottom: 3px;
              color: #000 !important;
              font-weight: 700;
              border-bottom: 1px solid #000;
            }
            .customer-name {
              font-size: 13px;
              color: #000 !important;
              font-weight: 700;
            }
            .detail-row {
              font-size: 11px;
              margin: 2px 0;
              color: #000 !important;
              font-weight: 500;
            }
            table {
              margin: 10px 0;
              font-size: 10px;
              border: 2px solid #000;
            }
            th {
              padding: 6px 4px;
              font-size: 9px;
              background: #000 !important;
              color: #fff !important;
              border: 1px solid #000;
            }
            td {
              padding: 5px 4px;
              border: 1px solid #666;
              color: #000 !important;
              font-weight: 600;
            }
            .item-name {
              color: #000 !important;
              font-weight: 700;
            }
            .totals-section {
              margin-top: 10px;
              border: 2px solid #000;
            }
            .words-column, .amounts-column {
              padding: 10px;
            }
            .amount-row {
              font-size: 11px;
              padding: 3px 0;
              color: #000 !important;
              font-weight: 600;
            }
            .total-row {
              padding: 8px 10px;
              margin: 6px -10px -10px -10px;
              font-size: 12px;
              background: #000 !important;
              color: #fff !important;
              font-weight: 800;
            }
            .amount-in-words {
              font-size: 11px;
              margin-bottom: 4px;
              color: #000 !important;
              font-weight: 700;
            }
            .thank-you {
              font-size: 10px;
              margin-top: 10px;
              color: #000 !important;
              font-weight: 600;
            }
            .warranty-box {
              margin-top: 8px;
              padding: 6px 8px;
              font-size: 9px;
              border: 1px solid #000;
              color: #000 !important;
              font-weight: 600;
            }
            .footer {
              margin-top: 12px;
              padding-top: 10px;
              border-top: 2px solid #000;
            }
            .shop-signature {
              font-size: 12px;
              color: #000 !important;
              font-weight: 700;
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
              width: 70px;
              height: 70px;
            }
            .shop-name {
              font-size: 20px;
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
            .thank-you {
              font-size: 11px;
            }
            .warranty-box {
              font-size: 9px;
              padding: 5px;
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
              <tr style="background: #000; color: #fff; font-weight: 800;">
                <td colspan="3" style="padding: 14px 10px; font-size: 12px; letter-spacing: 1px;">TOTAL</td>
                <td></td>
                <td></td>
                <td class="text-right" style="padding: 14px 10px; font-weight: 800;">${formatIndianNumber(data.items.reduce((sum, item) => sum + item.gst_amount, 0))}</td>
                <td class="text-right" style="padding: 14px 10px; font-weight: 800;">${formatIndianNumber(data.total)}</td>
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
                <span style="font-weight: 800; color: #000;">Sub Total</span>
                <span style="font-weight: 800; color: #000;">${formatIndianNumber(data.subtotal)}</span>
              </div>
              <div class="amount-row">
                <span style="color: #000; font-weight: 600;">SGST @ 6%</span>
                <span style="color: #000; font-weight: 600;">${formatIndianNumber(data.sgst)}</span>
              </div>
              <div class="amount-row">
                <span style="color: #000; font-weight: 600;">CGST @ 6%</span>
                <span style="color: #000; font-weight: 600;">${formatIndianNumber(data.cgst)}</span>
              </div>
              <div class="total-row">
                <span>TOTAL</span>
                <span>${formatIndianNumber(data.total)}</span>
              </div>
              <div style="margin-top: 40px; text-align: center;">
                <img src="/assets/stamp.png" alt="Stamp" style="width: 120px; height: auto;">
                <div style="font-size: 16px; font-weight: 800; margin-top: 10px; color: #000;">Authorized Signature</div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div class="buttons no-print">
              <button onclick="generatePDF()" class="btn btn-print">Download PDF</button>
              <button onclick="window.print()" class="btn btn-print">Print</button>
            </div>
            <div class="shop-signature">
              For: ${data.shop.name}
            </div>
          </div>
        </div>

        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
        
        <script>
          document.title = 'Invoice';
          
          async function generatePDF() {
            const element = document.querySelector('.invoice-container');
            const buttons = document.querySelector('.buttons');
            
            // Temporarily hide buttons
            if (buttons) buttons.style.display = 'none';
            
            try {
              const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight
              });
              
              const imgData = canvas.toDataURL('image/png');
              const { jsPDF } = window.jspdf;
              
              const pdf = new jsPDF('p', 'mm', 'a4');
              const pdfWidth = pdf.internal.pageSize.getWidth();
              const pdfHeight = pdf.internal.pageSize.getHeight();
              const imgWidth = canvas.width;
              const imgHeight = canvas.height;
              const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
              
              const imgX = (pdfWidth - imgWidth * ratio) / 2;
              const imgY = 10;
              
              pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
              pdf.save('Invoice-${data.invoice_number}.pdf');
            } catch (error) {
              console.error('PDF generation failed:', error);
              alert('Failed to generate PDF. Please use Print button instead.');
            } finally {
              // Restore buttons
              if (buttons) buttons.style.display = '';
            }
          }
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