import pool from '../db/pool.js';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  async sendInvoice(saleId, pdfPath) {
    if (!process.env.EMAIL_USER) {
      console.log('EMAIL_USER not set, skipping email send');
      return;
    }
    
    const invoiceResult = await pool.query(`
      SELECT i.id, s.invoice_number, s.total, c.name as customer_name, c.email
      FROM invoices i
      JOIN sales s ON i.sale_id = s.id
      JOIN customers c ON s.customer_id = c.id
      WHERE i.sale_id = $1
    `, [saleId]);
    
    if (invoiceResult.rows.length === 0 || !invoiceResult.rows[0].email) {
      console.log('No email for invoice');
      return;
    }
    
    const { invoice_number, total, customer_name, email } = invoiceResult.rows[0];
    const absolutePath = path.join(__dirname, '../..', pdfPath);
    
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Invoice ${invoice_number} — ${process.env.SHOP_NAME || 'TyreShop Pro'}`,
      text: `Dear ${customer_name},\n\nThank you for your purchase!\n\nInvoice: ${invoice_number}\nTotal Amount: ₹${total}\n\nPlease find the invoice attached.\n\nRegards,\n${process.env.SHOP_NAME || 'TyreShop Pro'}`,
      attachments: [{
        filename: `${invoice_number}.pdf`,
        path: absolutePath
      }]
    };
    
    try {
      await transporter.sendMail(mailOptions);
      await pool.query('UPDATE invoices SET sent_via_email = true, email_sent_at = NOW() WHERE sale_id = $1', [saleId]);
      console.log(`Invoice ${invoice_number} sent to ${email}`);
    } catch (err) {
      console.log('Email send error:', err.message);
    }
  }
};
