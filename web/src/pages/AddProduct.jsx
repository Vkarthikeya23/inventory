import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../services/api';

export default function AddProduct() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    size_spec: '',
    cost_price: '',
    cgst_rate: '6',
    sgst_rate: '6',
    price_entry_mode: 'excl',
    selling_price: '',
    stock_qty: '0',
    hsn_code: ''
  });

  // Calculate prices based on mode
  const calculatePrices = () => {
    const price = parseFloat(formData.selling_price) || 0;
    const cgstRate = isNaN(parseFloat(formData.cgst_rate)) ? 6 : parseFloat(formData.cgst_rate);
    const sgstRate = isNaN(parseFloat(formData.sgst_rate)) ? 6 : parseFloat(formData.sgst_rate);
    const totalGstRate = cgstRate + sgstRate;
    
    if (formData.price_entry_mode === 'excl') {
      const excl = price;
      const incl = Math.round(price * (1 + totalGstRate / 100) * 100) / 100;
      return { excl, incl };
    } else {
      const incl = price;
      const excl = Math.round(price / (1 + totalGstRate / 100) * 100) / 100;
      return { excl, incl };
    }
  };

  const { excl, incl } = calculatePrices();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.company_name || !formData.size_spec || !formData.selling_price) {
      alert('Company name, size specification, and selling price are required');
      return;
    }

    setLoading(true);
    
    try {
      // Calculate both prices before sending
      const { excl, incl } = calculatePrices();
      const payload = {
        company_name: formData.company_name,
        size_spec: formData.size_spec,
        cost_price: parseFloat(formData.cost_price) || 0,
        selling_price_excl_gst: excl,
        selling_price_incl_gst: incl,
        gst_rate: (parseFloat(formData.cgst_rate) || 0) + (parseFloat(formData.sgst_rate) || 0),
        cgst_rate: parseFloat(formData.cgst_rate) || 0,
        sgst_rate: parseFloat(formData.sgst_rate) || 0,
        stock_qty: parseInt(formData.stock_qty) || 0,
        hsn_code: formData.hsn_code || ''
      };
      
      await api.post('/products', payload);
      alert('Product added successfully!');
      navigate('/inventory');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Navbar />
      <div style={{ padding: '30px', maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '30px' }}>Add New Product</h1>
        
        <form onSubmit={handleSubmit} style={{ backgroundColor: '#f5f5f5', padding: '30px', borderRadius: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Company Name *</label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                placeholder="e.g., MRF"
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Tyre Size *</label>
              <input
                type="text"
                name="size_spec"
                value={formData.size_spec}
                onChange={handleChange}
                placeholder="e.g., 215/55/16E"
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Cost Price (₹)</label>
              <input
                type="number"
                name="cost_price"
                value={formData.cost_price}
                onChange={handleChange}
                placeholder="What you paid"
                step="0.01"
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>CGST (%)</label>
              <input
                type="number"
                name="cgst_rate"
                value={formData.cgst_rate}
                onChange={handleChange}
                placeholder="6"
                step="0.01"
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>SGST (%)</label>
              <input
                type="number"
                name="sgst_rate"
                value={formData.sgst_rate}
                onChange={handleChange}
                placeholder="6"
                step="0.01"
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
          </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>HSN Code</label>
            <input
              type="text"
              name="hsn_code"
              value={formData.hsn_code}
              onChange={handleChange}
              placeholder="e.g., 4011"
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <p style={{ fontSize: '13px', color: '#666', marginTop: '5px' }}>
              GST HSN code for tyres (typically 4011 for tyres)
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>Price Entry Mode</label>
            <div style={{ display: 'flex', gap: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="price_entry_mode"
                  value="excl"
                  checked={formData.price_entry_mode === 'excl'}
                  onChange={handleChange}
                />
                Enter price excluding GST
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="price_entry_mode"
                  value="incl"
                  checked={formData.price_entry_mode === 'incl'}
                  onChange={handleChange}
                />
                Enter price including GST
              </label>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              Selling Price {formData.price_entry_mode === 'excl' ? 'excl.' : 'incl.'} GST *
            </label>
            <input
              type="number"
              name="selling_price"
              value={formData.selling_price}
              onChange={handleChange}
              placeholder={formData.price_entry_mode === 'excl' ? 'Price before GST' : 'Price after GST'}
              step="0.01"
              required
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            
            {formData.selling_price && (
              <div style={{ 
                marginTop: '10px', 
                padding: '10px', 
                backgroundColor: '#e8f5e9', 
                borderRadius: '4px',
                fontSize: '14px'
              }}>
                {formData.price_entry_mode === 'excl' ? (
                  <>
                    Selling price incl. GST (CGST {formData.cgst_rate}% + SGST {formData.sgst_rate}%): <strong>₹{incl.toFixed(2)}</strong>
                  </>
                ) : (
                  <>
                    Selling price excl. GST: <strong>₹{excl.toFixed(2)}</strong> (CGST {formData.cgst_rate}% + SGST {formData.sgst_rate}%)
                  </>
                )}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Stock Quantity</label>
            <input
              type="number"
              name="stock_qty"
              value={formData.stock_qty}
              onChange={handleChange}
              placeholder="0"
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 24px',
                backgroundColor: loading ? '#999' : '#4CAF50',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: '600'
              }}
            >
              {loading ? 'Adding...' : 'Add Product'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/inventory')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#f44336',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
