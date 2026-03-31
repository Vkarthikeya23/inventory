import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../services/api';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    const res = await api.get('/categories');
    setCategories(res.data);
  }

  async function addCategory() {
    if (!newName) {
      alert('Name required');
      return;
    }
    try {
      await api.post('/categories', { name: newName, description: newDesc });
      alert('Category added');
      setNewName('');
      setNewDesc('');
      fetchCategories();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  }

  return (
    <div>
      <Navbar />
      <div style={{ padding: '20px' }}>
        <h1>Categories</h1>
        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
          <input type="text" placeholder="Category name" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <input type="text" placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <button onClick={addCategory} style={{ padding: '10px 20px', backgroundColor: '#2196F3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Add</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '10px' }}>Name</th>
              <th>Description</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>{c.name}</td>
                <td>{c.description}</td>
                <td>{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
