import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../services/api';

export default function NewSale() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  
  // Invoice header
  const [invoiceHeader, setInvoiceHeader] = useState({
    customer_name: '',
    customer_phone: '',
    vehicle_reg: '',
    sale_date: new Date().toISOString().split('T')[0]
  });
  
  // Line items
  const [items, setItems] = useState([
    { id: 1, product_id: '', qty: 1, unit_price: 0, gst_rate: 12, product: null }
  ]);
  
  // Totals
  const [receivedAmount, setReceivedAmount] = useState(0);
  
  // Product search modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemIndex, setSelectedItemIndex] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      const res = await api.get('/products');
      setProducts(res.data.filter(p => p.stock_qty > 0));
    } catch (err) {
      console.error('Fetch products error:', err);
    }
    setLoading(false);
  }

  const calculateItemAmount = (item) => {
    const qty = parseFloat(item.qty) || 0;
    const unitPrice = parseFloat(item.unit_price) || 0;
    const gstRate = isNaN(parseFloat(item.gst_rate)) ? 12 : parseFloat(item.gst_rate);
    
    const subtotal = qty * unitPrice;
    const gstAmount = subtotal * (gstRate / 100);
    const total = subtotal + gstAmount;
    
    return { subtotal, gstAmount, total };
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalGst = 0;
    
    items.forEach(item => {
      const { subtotal: itemSubtotal, gstAmount } = calculateItemAmount(item);
      subtotal += itemSubtotal;
      totalGst += gstAmount;
    });
    
    // Split total GST equally into CGST and SGST
    const cgst = totalGst / 2;
    const sgst = totalGst / 2;
    const total = subtotal + cgst + sgst;
    const balance = total - receivedAmount;
    
    return { subtotal, cgst, sgst, total, balance };
  };

  const { subtotal, cgst, sgst, total, balance } = calculateTotals();

  const addItem = () => {
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    setItems([...items, { id: newId, product_id: '', qty: 1, unit_price: 0, gst_rate: 12, product: null }]);
  };

  const removeItem = (id) => {
    if (items.length > 1) {
      setItems(items.filter(i => i.id !== id));
    }
  };

  const updateItem = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        
        // If product selected, auto-fill price and GST
        if (field === 'product_id' && value) {
          const product = products.find(p => p.id === value);
          if (product) {
            updated.product = product;
            updated.unit_price = product.selling_price_excl_gst;
            updated.gst_rate = product.gst_rate || 12;
          }
        }
        
        return updated;
      }
      return item;
    }));
  };

  const openProductSelector = (index) => {
    setSelectedItemIndex(index);
    setSearchQuery('');
    setShowProductModal(true);
  };

  const selectProduct = (product) => {
    if (selectedItemIndex !== null) {
      updateItem(items[selectedItemIndex].id, 'product_id', product.id);
    }
    setShowProductModal(false);
    setSelectedItemIndex(null);
  };

  const filteredProducts = products.filter(p => 
    p.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.size_spec?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function submitSale() {
    setError(null);
    
    // Validation
    if (!invoiceHeader.customer_name || !invoiceHeader.customer_phone) {
      setError('Please enter customer name and phone number');
      return;
    }
    
    const validItems = items.filter(item => item.product_id);
    if (validItems.length === 0) {
      setError('Please add at least one product');
      return;
    }

    setSubmitting(true);
    try {
      const saleItems = validItems.map(item => ({
        product_id: item.product_id,
        qty: parseInt(item.qty) || 1,
        unit_price: parseFloat(item.unit_price) || 0,
        gst_rate: parseFloat(item.gst_rate) || 12
      }));
      
      const res = await api.post('/sales', {
        customer_name: invoiceHeader.customer_name,
        customer_phone: invoiceHeader.customer_phone,
        vehicle_reg: invoiceHeader.vehicle_reg,
        sale_date: invoiceHeader.sale_date,
        received_amount: receivedAmount || total,
        items: saleItems
      });
      
      setSuccess({
        sale_id: res.data.sale_id,
        invoice_number: res.data.invoice_number,
        total: res.data.total,
        amount_in_words: res.data.amount_in_words,
        customer_name: res.data.customer_name,
        customer_phone: res.data.customer_phone,
        invoice_url: res.data.invoice_url
      });
    } catch (err) {
      console.error('Sale submission error:', err);
      const errorMsg = err.response?.data?.error || 'Failed to create sale. Please try again.';
      setError(errorMsg);
    }
    setSubmitting(false);
  }

  function resetForm() {
    setSuccess(null);
    setError(null);
    setInvoiceHeader({
      customer_name: '',
      customer_phone: '',
      vehicle_reg: '',
      sale_date: new Date().toISOString().split('T')[0]
    });
    setItems([{ id: 1, product_id: '', qty: 1, unit_price: 0, gst_rate: 12, product: null }]);
    setReceivedAmount(0);
  }

  const copyInvoiceLink = async () => {
    const link = success.invoice_url;
    try {
      await navigator.clipboard.writeText(link);
      alert('Invoice link copied!');
    } catch (err) {
      console.error('Failed to copy:', err);
      prompt('Copy this link:', link);
    }
  };

  const sendWhatsApp = () => {
    const phone = success.customer_phone?.replace(/\D/g, '');
    const phoneWithCountry = phone?.startsWith('91') ? phone : `91${phone}`;
    const message = encodeURIComponent(
      `Hi ${success.customer_name}, your invoice ${success.invoice_number} is ready.\nView & download: ${success.invoice_url}`
    );
    window.open(`https://wa.me/${phoneWithCountry}?text=${message}`, '_blank');
  };

  if (loading) return (
    <div>
      <Navbar />
      <div style={{ padding: '20px' }}>Loading...</div>
    </div>
  );

  if (success) return (
    <div>
      <Navbar />
      <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ color: '#4CAF50' }}>Sale Completed!</h1>
        <div style={{ padding: '30px', backgroundColor: '#e8f5e9', borderRadius: '8px', marginBottom: '20px' }}>
          <h2>Invoice #{success.invoice_number}</h2>
          <p style={{ fontSize: '24px', fontWeight: 'bold' }}>Total: ₹{success.total}</p>
          <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
            Amount in words: {success.amount_in_words}
          </p>
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button 
              onClick={sendWhatsApp}
              style={{ 
                padding: '12px 24px', 
                backgroundColor: '#25D366', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Send on WhatsApp
            </button>
            <button 
              onClick={copyInvoiceLink}
              style={{ 
                padding: '12px 24px', 
                backgroundColor: '#2196F3', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Copy Invoice Link
            </button>
          </div>
        </div>
        <button 
          onClick={resetForm}
          style={{ 
            padding: '12px 24px', 
            backgroundColor: '#4CAF50', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: 'pointer' 
          }}
        >
          New Sale
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <Navbar />
      <div style={{ padding: '30px', maxWidth: '1000px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '20px', textAlign: 'center', color: '#6c63ff' }}>Tax Invoice</h1>
        
        {/* Error Message */}
        {error && (
          <div style={{ 
            padding: '15px', 
            backgroundColor: '#ffebee', 
            color: '#c62828', 
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #ef9a9a'
          }}>
            {error}
          </div>
        )}
        
        {/* Invoice Header */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '20px', 
          marginBottom: '30px',
          border: '1px solid #ddd',
          padding: '20px',
          borderRadius: '8px'
        }}>
          <div>
            <h3 style={{ marginBottom: '15px', color: '#333' }}>Bill To</h3>
            <input
              type="text"
              placeholder="Customer name *"
              value={invoiceHeader.customer_name}
              onChange={(e) => setInvoiceHeader({...invoiceHeader, customer_name: e.target.value})}
              style={{ 
                width: '100%', 
                padding: '10px', 
                marginBottom: '10px', 
                border: '1px solid #ddd', 
                borderRadius: '4px',
                fontWeight: 'bold'
              }}
            />
            <input
              type="text"
              placeholder="Phone number *"
              value={invoiceHeader.customer_phone}
              onChange={(e) => setInvoiceHeader({...invoiceHeader, customer_phone: e.target.value})}
              style={{ 
                width: '100%', 
                padding: '10px', 
                marginBottom: '10px', 
                border: '1px solid #ddd', 
                borderRadius: '4px' 
              }}
            />
            <input
              type="text"
              placeholder="Car number plate (e.g., TS09AB1234)"
              value={invoiceHeader.vehicle_reg}
              onChange={(e) => setInvoiceHeader({...invoiceHeader, vehicle_reg: e.target.value})}
              style={{ 
                width: '100%', 
                padding: '10px', 
                border: '1px solid #ddd', 
                borderRadius: '4px' 
              }}
            />
          </div>
          
          <div>
            <h3 style={{ marginBottom: '15px', color: '#333' }}>Invoice Details</h3>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#666' }}>Date</label>
              <input
                type="date"
                value={invoiceHeader.sale_date}
                onChange={(e) => setInvoiceHeader({...invoiceHeader, sale_date: e.target.value})}
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px' 
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: '#666' }}>Invoice No.</label>
              <input
                type="text"
                value="Auto-generated"
                disabled
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px',
                  backgroundColor: '#f5f5f5'
                }}
              />
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse', 
          marginBottom: '20px',
          border: '1px solid #ddd'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#6c63ff', color: 'white' }}>
              <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #6c63ff' }}>#</th>
              <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #6c63ff' }}>Item name</th>
              <th style={{ padding: '12px', textAlign: 'center', border: '1px solid #6c63ff', width: '80px' }}>Qty</th>
              <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #6c63ff', width: '120px' }}>Price/Unit</th>
              <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #6c63ff', width: '120px' }}>GST</th>
              <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #6c63ff', width: '120px' }}>Amount</th>
              <th style={{ padding: '12px', textAlign: 'center', border: '1px solid #6c63ff', width: '50px' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const { gstAmount, total: itemTotal } = calculateItemAmount(item);
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{index + 1}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    {item.product ? (
                      <div>
                        <div style={{ fontWeight: '500' }}>{item.product.display_name}</div>
                      </div>
                    ) : (
                      <button
                        onClick={() => openProductSelector(index)}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#6c63ff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Select Product
                      </button>
                    )}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    <input
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) => updateItem(item.id, 'qty', e.target.value)}
                      style={{ width: '60px', padding: '5px', textAlign: 'center' }}
                    />
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>
                    <input
                      type="number"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateItem(item.id, 'unit_price', e.target.value)}
                      style={{ width: '100px', padding: '5px', textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>
                    <div>₹{gstAmount.toFixed(2)}</div>
                    <input
                      type="number"
                      value={item.gst_rate}
                      onChange={(e) => updateItem(item.id, 'gst_rate', e.target.value)}
                      style={{ width: '50px', padding: '5px', textAlign: 'right', marginTop: '5px' }}
                    />
                    <span>%</span>
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right', fontWeight: '500' }}>
                    ₹{itemTotal.toFixed(2)}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>
                    <button
                      onClick={() => removeItem(item.id)}
                      style={{
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '5px 10px',
                        cursor: 'pointer'
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={addItem}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c63ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            + Add Item
          </button>

          <button
            onClick={() => window.location.href = '/services/new'}
            style={{
              padding: '10px 20px',
              backgroundColor: '#e53e3e',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            + Add Service
          </button>
        </div>

        {/* Totals Section */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          border: '1px solid #ddd',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <div style={{ flex: 1, padding: '20px', borderRight: '1px solid #ddd' }}>
            <h3 style={{ marginBottom: '10px' }}>Invoice Amount In Words</h3>
            <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: '30px' }}>
              {success?.amount_in_words || '...'}
            </p>
            <p style={{ fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
              Thanks for doing business with us!
            </p>
          </div>
          
          <div style={{ width: '300px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>Sub Total</span>
              <span style={{ fontWeight: '500' }}>₹{subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>SGST @{cgst > 0 && subtotal > 0 ? ((cgst / subtotal) * 100).toFixed(1) : 0}%</span>
              <span>₹{sgst.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>CGST @{cgst > 0 && subtotal > 0 ? ((cgst / subtotal) * 100).toFixed(1) : 0}%</span>
              <span>₹{cgst.toFixed(2)}</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '10px',
              padding: '10px',
              backgroundColor: '#6c63ff',
              color: 'white',
              borderRadius: '4px',
              fontWeight: 'bold'
            }}>
              <span>Total</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <button
            onClick={submitSale}
            disabled={submitting}
            style={{
              padding: '15px 40px',
              backgroundColor: submitting ? '#999' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '18px',
              fontWeight: '600'
            }}
          >
            {submitting ? 'Processing...' : 'Complete Sale'}
          </button>
        </div>
      </div>

      {/* Product Selection Modal */}
      {showProductModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            width: '500px',
            maxHeight: '70vh',
            overflow: 'auto'
          }}>
            <h2>Select Product</h2>
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                marginBottom: '20px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
            <div style={{ maxHeight: '300px', overflow: 'auto' }}>
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  onClick={() => selectProduct(product)}
                  style={{
                    padding: '15px',
                    borderBottom: '1px solid #eee',
                    cursor: 'pointer',
                    hover: { backgroundColor: '#f5f5f5' }
                  }}
                >
                  <div style={{ fontWeight: '500' }}>{product.display_name}</div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    ₹{product.selling_price_excl_gst} (Stock: {product.stock_qty})
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowProductModal(false)}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
