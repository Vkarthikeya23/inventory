import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../services/api';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    gstin: ''
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  async function fetchSuppliers() {
    try {
      const res = await api.get('/suppliers');
      setSuppliers(res.data);
    } catch (err) {
      console.error('Fetch suppliers error:', err);
    }
    setLoading(false);
  }

  async function addSupplier(e) {
    e.preventDefault();
    if (!formData.name) {
      alert('Supplier name is required');
      return;
    }
    try {
      await api.post('/suppliers', formData);
      alert('Supplier added successfully');
      setFormData({ name: '', contact_person: '', phone: '', email: '', gstin: '' });
      fetchSuppliers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add supplier');
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <Navbar />
      <div style={{ padding: '20px' }}>
        <h1>Suppliers</h1>
        
        {/* Add Supplier Form */}
        <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
          <h2>Add New Supplier</h2>
          <form onSubmit={addSupplier}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Supplier name"
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  required
                />
              </div>
              <div>
                <label>Contact Person</label>
                <input
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                  placeholder="Contact person"
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label>Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="Phone number"
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="Email address"
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label>GSTIN</label>
                <input
                  type="text"
                  value={formData.gstin}
                  onChange={(e) => setFormData({...formData, gstin: e.target.value})}
                  placeholder="GST number"
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
            </div>
            <button 
              type="submit"
              style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Add Supplier
            </button>
          </form>
        </div>

        {/* Suppliers List */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f5f5f5' }}>
              <th style={{ textAlign: 'left', padding: '10px' }}>Name</th>
              <th>Contact Person</th>
              <th>Phone</th>
              <th>Email</th>
              <th>GSTIN</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>{s.name}</td>
                <td>{s.contact_person}</td>
                <td>{s.phone}</td>
                <td>{s.email}</td>
                <td>{s.gstin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
