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
    customer_gstin: '',
    vehicle_reg: '',
    vehicle_type: '',
    km_reading: '',
    next_alignment_km: '',
    next_service_km: '',
    sale_date: new Date().toISOString().split('T')[0]
  });
  
  // Line items
  const [items, setItems] = useState([
    { id: 1, product_id: '', qty: 1, unit_price: 0, gst_rate: 12, cgst_percent: 6, sgst_percent: 6, hsn_code: '', mfg_dates: [''], product: null }
  ]);
  
  // Totals
  const [receivedAmount, setReceivedAmount] = useState(0);
  
  // Product search modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemIndex, setSelectedItemIndex] = useState(null);
  
  // Services
  const [services, setServices] = useState([]);

  useEffect(() => {
    fetchProducts();
    fetchServices();
  }, []);

  async function fetchServices() {
    try {
      const res = await api.get('/services');
      setServices(res.data);
    } catch (err) {
      console.error('Fetch services error:', err);
    }
  }

  async function fetchProducts() {
    try {
      const res = await api.get('/products');
      // Handle both old array format and new object format
      const productsList = res.data.products || res.data;
      setProducts(productsList.filter(p => p.stock_qty > 0));
    } catch (err) {
      console.error('Fetch products error:', err);
    }
    setLoading(false);
  }

  const calculateItemAmount = (item) => {
    const qty = parseFloat(item.qty) || 0;
    const unitPrice = parseFloat(item.unit_price) || 0;
    const cgstPercent = parseFloat(item.cgst_percent) || 0;
    const sgstPercent = parseFloat(item.sgst_percent) || 0;
    
    const subtotal = qty * unitPrice;
    const cgstAmount = subtotal * (cgstPercent / 100);
    const sgstAmount = subtotal * (sgstPercent / 100);
    const total = subtotal + cgstAmount + sgstAmount;
    
    return { subtotal, cgstAmount, sgstAmount, total };
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    
    items.forEach(item => {
      const { subtotal: itemSubtotal, cgstAmount, sgstAmount } = calculateItemAmount(item);
      subtotal += itemSubtotal;
      totalCgst += cgstAmount;
      totalSgst += sgstAmount;
    });
    
    const total = subtotal + totalCgst + totalSgst;
    const balance = total - receivedAmount;
    
    return { subtotal, cgst: totalCgst, sgst: totalSgst, total, balance };
  };

  const { subtotal, cgst, sgst, total, balance } = calculateTotals();

  const addItem = () => {
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    setItems([...items, { id: newId, product_id: '', qty: 1, unit_price: 0, gst_rate: 12, cgst_percent: 6, sgst_percent: 6, hsn_code: '', mfg_dates: [''], product: null }]);
  };

  const removeItem = (id) => {
    setItems(items.filter(i => i.id !== id));
  };

  const updateItem = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        
        // If product selected, auto-fill price and CGST/SGST
        if (field === 'product_id' && value) {
          const product = products.find(p => p.id === value);
          if (product) {
            updated.product = product;
            updated.unit_price = product.selling_price_excl_gst;
            // Auto-calculate CGST and SGST from product's GST rate (split equally)
            // Handle 0 GST rate properly
            const productGstRate = product.gst_rate;
            const gstRate = productGstRate !== undefined && productGstRate !== null && !isNaN(productGstRate) ? productGstRate : 12;
            updated.gst_rate = gstRate;
            updated.cgst_percent = gstRate / 2;
            updated.sgst_percent = gstRate / 2;
            updated.hsn_code = product.hsn_code || '';
          }
        }
        
        // If quantity changed, resize mfg_dates array
        if (field === 'qty') {
          const qty = parseInt(value) || 1;
          const currentDates = updated.mfg_dates || [];
          if (qty > currentDates.length) {
            // Add empty strings for additional tyres
            updated.mfg_dates = [...currentDates, ...Array(qty - currentDates.length).fill('')];
          } else if (qty < currentDates.length) {
            // Remove extra dates
            updated.mfg_dates = currentDates.slice(0, qty);
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

  const openServiceSelector = (index) => {
    setSelectedItemIndex(index);
    setSearchQuery('');
    setShowServiceModal(true);
  };

  const selectProduct = (product) => {
    if (selectedItemIndex !== null) {
      const item = items[selectedItemIndex];
      setItems(items.map(it => {
        if (it.id === item.id) {
          const updated = { ...it, product_id: product.id, service_name: null };
          updated.product = product;
          updated.unit_price = product.selling_price_excl_gst;
          // Auto-calculate CGST and SGST from product's GST rate (split equally)
          // Handle 0 GST rate properly
          const productGstRate = product.gst_rate;
          const gstRate = productGstRate !== undefined && productGstRate !== null && !isNaN(productGstRate) ? productGstRate : 12;
          updated.gst_rate = gstRate;
          updated.cgst_percent = gstRate / 2;
          updated.sgst_percent = gstRate / 2;
          updated.hsn_code = product.hsn_code || '';
          // Set first MFG date from product, keep rest empty based on qty
          const qty = parseInt(updated.qty) || 1;
          updated.mfg_dates = [product.mfg_date || '', ...Array(Math.max(0, qty - 1)).fill('')];
          return updated;
        }
        return it;
      }));
    }
    setShowProductModal(false);
    setSelectedItemIndex(null);
  };

  const selectService = (service) => {
    if (selectedItemIndex !== null) {
      const item = items[selectedItemIndex];
      setItems(items.map(it => {
        if (it.id === item.id) {
          return {
            ...it,
            product_id: null,
            service_name: service.service_name,
            unit_price: service.price,
            gst_rate: 0,
            cgst_percent: 0,
            sgst_percent: 0,
            product: null,
            mfg_dates: []
          };
        }
        return it;
      }));
    }
    setShowServiceModal(false);
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
    
    const validItems = items.filter(item => item.product_id || item.service_name);
    if (validItems.length === 0) {
      setError('Please add at least one product or service');
      return;
    }

    setSubmitting(true);
    try {
      const saleItems = validItems.map(item => ({
        product_id: item.product_id || null,
        service_name: item.service_name || null,
        hsn_code: item.hsn_code || null,
        mfg_date: item.mfg_dates ? item.mfg_dates.filter(d => d).join(', ') : null,
        qty: parseInt(item.qty) || 1,
        unit_price: parseFloat(item.unit_price) || 0,
        gst_rate: parseFloat(item.gst_rate) || 0,
        cgst_percent: parseFloat(item.cgst_percent) || 0,
        sgst_percent: parseFloat(item.sgst_percent) || 0
      }));
      
      const res = await api.post('/sales', {
        customer_name: invoiceHeader.customer_name,
        customer_phone: invoiceHeader.customer_phone,
        customer_gstin: invoiceHeader.customer_gstin || null,
        vehicle_reg: invoiceHeader.vehicle_reg,
        vehicle_type: invoiceHeader.vehicle_type || null,
        km_reading: invoiceHeader.km_reading || null,
        next_alignment_km: invoiceHeader.next_alignment_km || null,
        next_service_km: invoiceHeader.next_service_km || null,
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
      customer_gstin: '',
      vehicle_reg: '',
      sale_date: new Date().toISOString().split('T')[0]
    });
    setItems([{ id: 1, product_id: '', qty: 1, unit_price: 0, gst_rate: 12, cgst_percent: 6, sgst_percent: 6, hsn_code: '', mfg_dates: [''], product: null }]);
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
      <div style={{ padding: '40px', textAlign: 'center', color: '#6B6860' }}>Loading...</div>
    </div>
  );

  if (success) return (
    <div>
      <Navbar />
      <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ color: '#4A8A62', marginBottom: '20px' }}>Sale Completed!</h1>
        <div style={{ padding: '30px', backgroundColor: '#E8E4DA', borderRadius: '12px', marginBottom: '20px' }}>
          <h2 style={{ color: '#2E2C27' }}>Invoice #{success.invoice_number}</h2>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#2E2C27' }}>Total: ₹{success.total}</p>
          <p style={{ fontSize: '14px', color: '#6B6860', marginTop: '10px' }}>
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
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Send on WhatsApp
            </button>
            <button 
              onClick={copyInvoiceLink}
              style={{ 
                padding: '12px 24px', 
                backgroundColor: '#4A8A62', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
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
            backgroundColor: '#7BAF8A', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '600'
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
        <h1 style={{ marginBottom: '20px', textAlign: 'center', color: '#2E2C27' }}>New Sale</h1>
        
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '20px', 
          marginBottom: '30px',
          backgroundColor: '#E8E4DA',
          padding: '20px',
          borderRadius: '12px'
        }}>
          <div>
            <h3 style={{ marginBottom: '15px', color: '#2E2C27' }}>Bill To</h3>
            <input
              type="text"
              placeholder="Customer name *"
              value={invoiceHeader.customer_name}
              onChange={(e) => setInvoiceHeader({...invoiceHeader, customer_name: e.target.value})}
              style={{ 
                width: '100%', 
                padding: '12px', 
                marginBottom: '10px', 
                border: '1px solid #D4D0C8', 
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '16px',
                backgroundColor: '#F7F5F0',
                color: '#2E2C27',
                textTransform: 'uppercase'
              }}
            />
            <input
              type="text"
              placeholder="Phone number *"
              value={invoiceHeader.customer_phone}
              onChange={(e) => setInvoiceHeader({...invoiceHeader, customer_phone: e.target.value})}
              style={{ 
                width: '100%', 
                padding: '12px', 
                marginBottom: '10px', 
                border: '1px solid #D4D0C8', 
                borderRadius: '8px',
                fontSize: '16px',
                backgroundColor: '#F7F5F0',
                color: '#2E2C27',
                textTransform: 'uppercase'
              }}
            />
            <input
              type="text"
              placeholder="Customer GSTIN (optional)"
              value={invoiceHeader.customer_gstin}
              onChange={(e) => setInvoiceHeader({...invoiceHeader, customer_gstin: e.target.value})}
              style={{ 
                width: '100%', 
                padding: '12px', 
                marginBottom: '10px', 
                border: '1px solid #D4D0C8', 
                borderRadius: '8px',
                fontSize: '16px',
                backgroundColor: '#F7F5F0',
                color: '#2E2C27',
                textTransform: 'uppercase'
              }}
            />
            <input
              type="text"
              placeholder="Car number plate (e.g., TS09AB1234)"
              value={invoiceHeader.vehicle_reg}
              onChange={(e) => setInvoiceHeader({...invoiceHeader, vehicle_reg: e.target.value})}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #D4D0C8',
                borderRadius: '8px',
                fontSize: '16px',
                backgroundColor: '#F7F5F0',
                color: '#2E2C27',
                textTransform: 'uppercase'
              }}
            />
            <input
              type="text"
              placeholder="Vehicle type (e.g., Swift, Baleno)"
              value={invoiceHeader.vehicle_type || ''}
              onChange={(e) => setInvoiceHeader({...invoiceHeader, vehicle_type: e.target.value})}
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '10px',
                border: '1px solid #D4D0C8',
                borderRadius: '8px',
                fontSize: '16px',
                backgroundColor: '#F7F5F0',
                color: '#2E2C27',
                textTransform: 'uppercase'
              }}
            />
            <input
              type="number"
              placeholder="KM reading (optional)"
              value={invoiceHeader.km_reading || ''}
              onChange={(e) => setInvoiceHeader({...invoiceHeader, km_reading: e.target.value})}
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '10px',
                border: '1px solid #D4D0C8',
                borderRadius: '8px',
                fontSize: '16px',
                backgroundColor: '#F7F5F0',
                color: '#2E2C27'
              }}
            />
            <input
              type="number"
              placeholder="Next alignment KM (optional)"
              value={invoiceHeader.next_alignment_km || ''}
              onChange={(e) => setInvoiceHeader({...invoiceHeader, next_alignment_km: e.target.value})}
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '10px',
                border: '1px solid #D4D0C8',
                borderRadius: '8px',
                fontSize: '16px',
                backgroundColor: '#F7F5F0',
                color: '#2E2C27'
              }}
            />
            <input
              type="number"
              placeholder="Next service in ___ KM (optional)"
              value={invoiceHeader.next_service_km || ''}
              onChange={(e) => setInvoiceHeader({...invoiceHeader, next_service_km: e.target.value})}
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '10px',
                border: '1px solid #D4D0C8',
                borderRadius: '8px',
                fontSize: '16px',
                backgroundColor: '#F7F5F0',
                color: '#2E2C27'
              }}
            />
          </div>
          
          <div>
            <h3 style={{ marginBottom: '15px', color: '#2E2C27' }}>Invoice Details</h3>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#6B6860' }}>Date</label>
              <input
                type="date"
                value={invoiceHeader.sale_date}
                onChange={(e) => setInvoiceHeader({...invoiceHeader, sale_date: e.target.value})}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  border: '1px solid #D4D0C8', 
                  borderRadius: '8px',
                  fontSize: '16px',
                  backgroundColor: '#F7F5F0',
                  color: '#2E2C27'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: '#6B6860' }}>Invoice No.</label>
              <input
                type="text"
                value="Auto-generated"
                disabled
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  border: '1px solid #D4D0C8', 
                  borderRadius: '8px',
                  backgroundColor: '#F7F5F0',
                  color: '#6B6860'
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
          border: '1px solid #D4D0C8',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#7BAF8A', color: 'white' }}>
              <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #7BAF8A' }}>#</th>
              <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #7BAF8A' }}>Item name</th>
              <th style={{ padding: '12px', textAlign: 'center', border: '1px solid #7BAF8A', width: '60px' }}>Qty</th>
              <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #7BAF8A', width: '80px' }}>Price/Unit</th>
              <th style={{ padding: '12px', textAlign: 'center', border: '1px solid #7BAF8A', width: '70px' }}>HSN</th>
              <th style={{ padding: '12px', textAlign: 'center', border: '1px solid #7BAF8A', width: '120px' }}>MFG Date</th>
              <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #7BAF8A', width: '80px' }}>CGST</th>
              <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #7BAF8A', width: '80px' }}>SGST</th>
              <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #7BAF8A', width: '100px' }}>Amount</th>
              <th style={{ padding: '12px', textAlign: 'center', border: '1px solid #7BAF8A', width: '50px' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const { cgstAmount, sgstAmount, total: itemTotal } = calculateItemAmount(item);
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid #D4D0C8', backgroundColor: '#F7F5F0' }}>
                  <td style={{ padding: '10px', border: '1px solid #D4D0C8' }}>{index + 1}</td>
                  <td style={{ padding: '10px', border: '1px solid #D4D0C8' }}>
                    {item.product ? (
                      <div>
                        <div style={{ fontWeight: '500', color: '#2E2C27' }}>{item.product.display_name}</div>
                        {item.product.mfg_date && <div style={{ fontSize: '12px', color: '#4A8A62' }}>MFG: {item.product.mfg_date}</div>}
                      </div>
                    ) : item.service_name ? (
                      <div>
                        <div style={{ fontWeight: '500', color: '#C4956A' }}>{item.service_name}</div>
                        <div style={{ fontSize: '12px', color: '#6B6860' }}>Service</div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => openProductSelector(index)}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: '#4A8A62',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          Select Product
                        </button>
                         <button
                          onClick={() => openServiceSelector(index)}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: '#C4956A',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '14px'
                          }}
                        >
                          Select Service
                        </button>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #D4D0C8' }}>
                    <input
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) => updateItem(item.id, 'qty', e.target.value)}
                      style={{ width: '60px', padding: '8px', textAlign: 'center', border: '1px solid #D4D0C8', borderRadius: '8px', backgroundColor: '#fff', fontSize: '14px' }}
                    />
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #D4D0C8', textAlign: 'right' }}>
                    <input
                      type="number"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateItem(item.id, 'unit_price', e.target.value)}
                      style={{ width: '100px', padding: '8px', textAlign: 'right', border: '1px solid #D4D0C8', borderRadius: '8px', backgroundColor: '#fff', fontSize: '14px' }}
                    />
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #D4D0C8', textAlign: 'center' }}>
                    <input
                      type="text"
                      placeholder="HSN"
                      value={item.hsn_code || ''}
                      onChange={(e) => updateItem(item.id, 'hsn_code', e.target.value)}
                      style={{ width: '70px', padding: '8px', textAlign: 'center', border: '1px solid #D4D0C8', borderRadius: '8px', backgroundColor: '#fff', fontSize: '14px', textTransform: 'uppercase' }}
                    />
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #D4D0C8', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {(item.mfg_dates || []).map((date, idx) => (
                        <input
                          key={idx}
                          type="text"
                          placeholder={`#${idx + 1}`}
                          value={date}
                          onChange={(e) => {
                            const newDates = [...(item.mfg_dates || [])];
                            newDates[idx] = e.target.value;
                            updateItem(item.id, 'mfg_dates', newDates);
                          }}
                          style={{ width: '100px', padding: '6px', textAlign: 'center', border: '1px solid #D4D0C8', borderRadius: '8px', backgroundColor: '#fff', fontSize: '13px', textTransform: 'uppercase' }}
                        />
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #D4D0C8', textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#6B6860' }}>{item.cgst_percent || 0}%</div>
                    <input
                      type="number"
                      step="0.01"
                      value={item.cgst_percent}
                      onChange={(e) => updateItem(item.id, 'cgst_percent', e.target.value)}
                      style={{ width: '60px', padding: '8px', textAlign: 'right', border: '1px solid #D4D0C8', borderRadius: '8px', backgroundColor: '#fff', fontSize: '14px' }}
                    />
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #D4D0C8', textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#6B6860' }}>{item.sgst_percent || 0}%</div>
                    <input
                      type="number"
                      step="0.01"
                      value={item.sgst_percent}
                      onChange={(e) => updateItem(item.id, 'sgst_percent', e.target.value)}
                      style={{ width: '60px', padding: '8px', textAlign: 'right', border: '1px solid #D4D0C8', borderRadius: '8px', backgroundColor: '#fff', fontSize: '14px' }}
                    />
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #D4D0C8', textAlign: 'right', fontWeight: '500', color: '#2E2C27' }}>
                    ₹{itemTotal.toFixed(2)}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #D4D0C8', textAlign: 'center' }}>
                    <button
                      onClick={() => removeItem(item.id)}
                      style={{
                        backgroundColor: '#B85C5C',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '5px 10px',
                        cursor: 'pointer',
                        fontSize: '16px'
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
              backgroundColor: '#4A8A62',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            + Add Item
          </button>
        </div>

        {/* Totals Section */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          border: '1px solid #D4D0C8',
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: '#E8E4DA'
        }}>
          <div style={{ flex: 1, padding: '20px', borderRight: '1px solid #D4D0C8' }}>
            <h3 style={{ marginBottom: '10px', color: '#2E2C27' }}>Invoice Amount In Words</h3>
            <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: '30px', color: '#2E2C27' }}>
              {success?.amount_in_words || '...'}
            </p>
            <p style={{ fontSize: '14px', color: '#6B6860', fontStyle: 'italic' }}>
              Thanks for doing business with us!
            </p>
          </div>
          
          <div style={{ width: '300px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#2E2C27' }}>
              <span>Sub Total</span>
              <span style={{ fontWeight: '500' }}>₹{subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#2E2C27' }}>
              <span>CGST</span>
              <span>₹{cgst.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#2E2C27' }}>
              <span>SGST</span>
              <span>₹{sgst.toFixed(2)}</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '10px',
              padding: '12px',
              backgroundColor: '#4A8A62',
              color: 'white',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '16px'
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
              backgroundColor: submitting ? '#999' : '#4A8A62',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
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
            backgroundColor: '#E8E4DA',
            padding: '30px',
            borderRadius: '12px',
            width: '500px',
            maxHeight: '70vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginBottom: '20px', color: '#2E2C27' }}>Select Product</h2>
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '20px',
                border: '1px solid #D4D0C8',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: '#F7F5F0',
                textTransform: 'uppercase'
              }}
            />
            <div style={{ maxHeight: '300px', overflow: 'auto', backgroundColor: '#F7F5F0', borderRadius: '8px' }}>
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  onClick={() => selectProduct(product)}
                  style={{
                    padding: '15px',
                    borderBottom: '1px solid #E8E4DA',
                    cursor: 'pointer',
                    backgroundColor: '#F7F5F0'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E8E4DA'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#F7F5F0'}
                >
                  <div style={{ fontWeight: '500', color: '#2E2C27' }}>{product.display_name}</div>
                  <div style={{ fontSize: '14px', color: '#6B6860' }}>
                    ₹{product.selling_price_excl_gst} (Stock: {product.stock_qty})
                    {product.mfg_date && <span style={{ marginLeft: '10px', color: '#4A8A62' }}>MFG: {product.mfg_date}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => window.location.href = '/services/new'}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#C4956A',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                + Add Service
              </button>
              <button
                onClick={() => setShowProductModal(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#B85C5C',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service Selection Modal */}
      {showServiceModal && (
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
            backgroundColor: '#E8E4DA',
            padding: '30px',
            borderRadius: '12px',
            width: '500px',
            maxHeight: '70vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginBottom: '20px', color: '#2E2C27' }}>Select Service</h2>
            <input
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '20px',
                border: '1px solid #D4D0C8',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: '#F7F5F0',
                textTransform: 'uppercase'
              }}
            />
            <div style={{ maxHeight: '300px', overflow: 'auto', backgroundColor: '#F7F5F0', borderRadius: '8px' }}>
              {services
                .filter(s => s.service_name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(service => (
                  <div
                    key={service.id}
                    onClick={() => selectService(service)}
                    style={{
                      padding: '15px',
                      borderBottom: '1px solid #E8E4DA',
                      cursor: 'pointer',
                      backgroundColor: '#F7F5F0'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E8E4DA'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#F7F5F0'}
                  >
                    <div style={{ fontWeight: '500', color: '#2E2C27' }}>{service.service_name}</div>
                    <div style={{ fontSize: '14px', color: '#6B6860' }}>
                      ₹{parseFloat(service.price).toFixed(2)}
                    </div>
                  </div>
                ))}
            </div>
            <button
              onClick={() => setShowServiceModal(false)}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                backgroundColor: '#B85C5C',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
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
