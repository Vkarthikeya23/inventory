import pool from '../db/pool.js';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  async sendInvoice(saleId, pdfPath) {
    if (!process.env.WATI_API_KEY) {
      console.log('WATI_API_KEY not set, skipping WhatsApp send');
      return;
    }
    
    const invoiceResult = await pool.query(
      'SELECT i.id, s.invoice_number, c.phone FROM invoices i JOIN sales s ON i.sale_id = s.id JOIN customers c ON s.customer_id = c.id WHERE i.sale_id = $1',
      [saleId]
    );
    
    if (invoiceResult.rows.length === 0) {
      console.log('Invoice not found for WhatsApp send');
      return;
    }
    
    const { invoice_number, phone } = invoiceResult.rows[0];
    const formattedPhone = phone.replace(/[^0-9]/g, '');
    
    const absolutePath = path.join(__dirname, '../..', pdfPath);
    
    const formData = new FormData();
    const fileStream = fs.createReadStream(absolutePath);
    formData.append('file', fileStream);
    formData.append('caption', `Invoice ${invoice_number} from ${process.env.SHOP_NAME || 'TyreShop Pro'}`);
    
    const url = `${process.env.WATI_BASE_URL}/api/v1/sendSessionFile/${formattedPhone}`;
    
    return new Promise((resolve, reject) => {
      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WATI_API_KEY}`,
          'Content-Type': 'multipart/form-data'
        }
      }, (res) => {
        if (res.statusCode === 200) {
          pool.query('UPDATE invoices SET sent_via_whatsapp = true, whatsapp_sent_at = NOW() WHERE sale_id = $1', [saleId])
            .then(() => resolve({ success: true }))
            .catch(reject);
        } else {
          console.log(`WATI API error: ${res.statusCode}`);
          reject(new Error(`WATI API error: ${res.statusCode}`));
        }
      });
      
      req.on('error', reject);
      formData.append('file', fs.readFileSync(absolutePath));
      req.write(formData.getBuffer());
      req.end();
    }).catch(err => {
      console.log('WhatsApp send error:', err.message);
    });
  }
};
