import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../services/api';

export default function AddService() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    service_name: '',
    price: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.service_name || !formData.price) {
      alert('Service name and price are required');
      return;
    }

    setLoading(true);
    
    try {
      await api.post('/services', formData);
      alert('Service added successfully!');
      navigate('/inventory');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Navbar />
      <div style={{ padding: '30px', maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '30px' }}>Add New Service</h1>
        
        <form onSubmit={handleSubmit} style={{ backgroundColor: '#f5f5f5', padding: '30px', borderRadius: '8px' }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Service Name *</label>
            <input
              type="text"
              name="service_name"
              value={formData.service_name}
              onChange={handleChange}
              placeholder="e.g., Tyre Alignment"
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              required
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Price (₹) *</label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              placeholder="Service price"
              step="0.01"
              required
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 24px',
                backgroundColor: loading ? '#999' : '#e53e3e',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: '600'
              }}
            >
              {loading ? 'Adding...' : 'Add Service'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/inventory')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#666',
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
