import ReactPDF from '@react-pdf/renderer';
import React from 'react';
import pool from '../db/pool.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const InvoiceDocument = ({ sale }) => (
  <ReactPDF.Document>
    <ReactPDF.Page size="A4" style={{ fontFamily: 'Helvetica', padding: 30 }}>
      <ReactPDF.View style={{ marginBottom: 20 }}>
        <ReactPDF.Text style={{ fontSize: 18, fontWeight: 'bold' }}>{process.env.SHOP_NAME || 'TyreShop Pro'}</ReactPDF.Text>
        <ReactPDF.Text style={{ fontSize: 10 }}>{process.env.SHOP_ADDRESS || '123 Main Street, City, State'}</ReactPDF.Text>
        <ReactPDF.Text style={{ fontSize: 10 }}>GSTIN: {process.env.SHOP_GSTIN || 'XX-XXXXXXX'}</ReactPDF.Text>
      </ReactPDF.View>
      
      <ReactPDF.View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
        <ReactPDF.View>
          <ReactPDF.Text style={{ fontSize: 12, fontWeight: 'bold' }}>Bill To:</ReactPDF.Text>
          <ReactPDF.Text style={{ fontSize: 10 }}>{sale.customer_name}</ReactPDF.Text>
          <ReactPDF.Text style={{ fontSize: 10 }}>Phone: {sale.phone}</ReactPDF.Text>
          {sale.vehicle_make && (
            <ReactPDF.Text style={{ fontSize: 10 }}>
              Vehicle: {sale.vehicle_make} {sale.vehicle_model} - {sale.vehicle_reg}
            </ReactPDF.Text>
          )}
        </ReactPDF.View>
        <ReactPDF.View style={{ textAlign: 'right' }}>
          <ReactPDF.Text style={{ fontSize: 12, fontWeight: 'bold' }}>Invoice #{sale.invoice_number}</ReactPDF.Text>
          <ReactPDF.Text style={{ fontSize: 10 }}>Date: {new Date(sale.created_at).toLocaleDateString('en-IN')}</ReactPDF.Text>
        </ReactPDF.View>
      </ReactPDF.View>
      
      <ReactPDF.View style={{ borderBottom: 1, borderColor: '#000', marginBottom: 10 }}>
        <ReactPDF.View style={{ flexDirection: 'row', fontSize: 10, fontWeight: 'bold', paddingBottom: 5 }}>
          <ReactPDF.Text style={{ width: 30 }}>#</ReactPDF.Text>
          <ReactPDF.Text style={{ width: 200 }}>Product</ReactPDF.Text>
          <ReactPDF.Text style={{ width: 50 }}>HSN</ReactPDF.Text>
          <ReactPDF.Text style={{ width: 40 }}>Qty</ReactPDF.Text>
          <ReactPDF.Text style={{ width: 80 }}>Unit Price</ReactPDF.Text>
          <ReactPDF.Text style={{ width: 80 }}>Amount</ReactPDF.Text>
        </ReactPDF.View>
      </ReactPDF.View>
      
      {sale.items.map((item, index) => (
        <ReactPDF.View key={item.product_id} style={{ flexDirection: 'row', fontSize: 10, paddingBottom: 5 }}>
          <ReactPDF.Text style={{ width: 30 }}>{index + 1}</ReactPDF.Text>
          <ReactPDF.Text style={{ width: 200 }}>{item.product_name}</ReactPDF.Text>
          <ReactPDF.Text style={{ width: 50 }}>{item.hsn_code}</ReactPDF.Text>
          <ReactPDF.Text style={{ width: 40 }}>{item.qty}</ReactPDF.Text>
          <ReactPDF.Text style={{ width: 80 }}>₹{item.unit_price}</ReactPDF.Text>
          <ReactPDF.Text style={{ width: 80 }}>₹{item.amount}</ReactPDF.Text>
        </ReactPDF.View>
      ))}
      
      <ReactPDF.View style={{ borderTop: 1, borderColor: '#000', marginTop: 10, paddingTop: 10 }}>
        <ReactPDF.View style={{ flexDirection: 'row', fontSize: 10, marginBottom: 5 }}>
          <ReactPDF.Text style={{ width: 380, textAlign: 'right' }}>Subtotal:</ReactPDF.Text>
          <ReactPDF.Text style={{ width: 80 }}>₹{sale.subtotal}</ReactPDF.Text>
        </ReactPDF.View>
        <ReactPDF.View style={{ flexDirection: 'row', fontSize: 10, marginBottom: 5 }}>
          <ReactPDF.Text style={{ width: 380, textAlign: 'right' }}>CGST (14%):</ReactPDF.Text>
          <ReactPDF.Text style={{ width: 80 }}>₹{sale.cgst}</ReactPDF.Text>
        </ReactPDF.View>
        <ReactPDF.View style={{ flexDirection: 'row', fontSize: 10, marginBottom: 5 }}>
          <ReactPDF.Text style={{ width: 380, textAlign: 'right' }}>SGST (14%):</ReactPDF.Text>
          <ReactPDF.Text style={{ width: 80 }}>₹{sale.sgst}</ReactPDF.Text>
        </ReactPDF.View>
        <ReactPDF.View style={{ flexDirection: 'row', fontSize: 12, fontWeight: 'bold' }}>
          <ReactPDF.Text style={{ width: 380, textAlign: 'right' }}>Grand Total:</ReactPDF.Text>
          <ReactPDF.Text style={{ width: 80 }}>₹{sale.total}</ReactPDF.Text>
        </ReactPDF.View>
      </ReactPDF.View>
      
      <ReactPDF.View style={{ marginTop: 30, fontSize: 9, color: '#666' }}>
        <ReactPDF.Text>All tyres carry manufacturer warranty. Fitment verified by our technician.</ReactPDF.Text>
        <ReactPDF.Text style={{ marginTop: 5 }}>Thank you for your business!</ReactPDF.Text>
      </ReactPDF.View>
    </ReactPDF.Page>
  </ReactPDF.Document>
);

export default {
  async generateInvoice(saleId) {
    const saleResult = await pool.query(`
      SELECT s.invoice_number, s.subtotal, s.cgst, s.sgst, s.total, s.created_at,
             c.name as customer_name, c.phone, c.vehicle_make, c.vehicle_model, c.vehicle_reg
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.id = $1
    `, [saleId]);
    
    if (saleResult.rows.length === 0) {
      throw new Error('Sale not found');
    }
    
    const itemsResult = await pool.query(`
      SELECT si.qty, si.unit_price, si.amount, si.unit_cost,
             p.name as product_name, p.size_spec, p.hsn_code
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = $1
    `, [saleId]);
    
    const sale = { ...saleResult.rows[0], items: itemsResult.rows };
    
    const invoiceDir = path.join(__dirname, '../../invoices');
    if (!fs.existsSync(invoiceDir)) {
      fs.mkdirSync(invoiceDir, { recursive: true });
    }
    
    const pdfPath = path.join(invoiceDir, `${sale.invoice_number}.pdf`);
    
    const pdf = await ReactPDF.renderToBuffer(<InvoiceDocument sale={sale} />);
    fs.writeFileSync(pdfPath, pdf);
    
    const relativePath = `invoices/${sale.invoice_number}.pdf`;
    
    await pool.query(
      'UPDATE invoices SET pdf_path = $1 WHERE sale_id = $2',
      [relativePath, saleId]
    );
    
    return relativePath;
  }
};
