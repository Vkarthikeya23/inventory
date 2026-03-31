import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../services/api';

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [products, setProducts] = useState([]);
  const [orderItems, setOrderItems] = useState([]);

  useEffect(() => {
    fetchOrders();
    fetchSuppliers();
    fetchProducts();
  }, []);

  async function fetchOrders() {
    const res = await api.get('/purchase-orders');
    setOrders(res.data);
    setLoading(false);
  }

  async function fetchSuppliers() {
    const res = await api.get('/suppliers');
    setSuppliers(res.data);
  }

  async function fetchProducts() {
    const res = await api.get('/products');
    setProducts(res.data);
  }

  async function createPO() {
    try {
      await api.post('/purchase-orders', {
        supplier_id: selectedSupplier,
        items: orderItems.map(i => ({ product_id: i.product_id, qty_ordered: parseInt(i.qty_ordered), unit_cost: i.unit_cost })),
      });
      alert('PO created');
      setModalOpen(false);
      setOrderItems([]);
      setSelectedSupplier('');
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  }

  async function markReceived(po) {
    try {
      const items = po.items.map(i => ({ po_item_id: i.id, qty_received: i.qty_ordered }));
      await api.put(`/purchase-orders/${po.id}/receive`, { items });
      alert('Marked as received');
      fetchOrders();
    } catch (err) {
      alert('Failed');
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <Navbar />
      <div style={{ padding: '20px' }}>
        <h1>Purchase Orders</h1>
        <button onClick={() => setModalOpen(true)} style={{ marginBottom: '20px', padding: '10px 20px', backgroundColor: '#2196F3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+ New PO</button>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '10px' }}>Supplier</th>
              <th>Status</th>
              <th>Items</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(po => (
              <tr key={po.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>{po.supplier_name}</td>
                <td>{po.status}</td>
                <td>{po.item_count}</td>
                <td>{new Date(po.created_at).toLocaleDateString()}</td>
                <td>
                  {po.status !== 'received' && (
                    <button onClick={() => markReceived(po)} style={{ padding: '5px 10px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Receive</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {modalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '8px', width: '500px', maxHeight: '80%', overflow: 'auto' }}>
              <h2>New Purchase Order</h2>
              <div style={{ marginBottom: '15px' }}>
                <label>Supplier: </label>
                <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)} style={{ padding: '8px', width: '100%' }}>
                  <option value="">Select supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <h3>Add Items</h3>
              <table style={{ width: '100%', marginBottom: '15px' }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td><input type="number" min="1" defaultValue="1" onChange={(e) => {
                        const existing = orderItems.find(i => i.product_id === p.id);
                        if (existing) {
                          setOrderItems(orderItems.map(i => i.product_id === p.id ? { ...i, qty_ordered: e.target.value } : i));
                        } else {
                          setOrderItems([...orderItems, { product_id: p.id, qty_ordered: e.target.value, unit_cost: p.cost_price }]);
                        }
                      }} style={{ width: '60px' }} /></td>
                      <td><input type="number" step="0.01" defaultValue={p.cost_price} onChange={(e) => {
                        setOrderItems(orderItems.map(i => i.product_id === p.id ? { ...i, unit_cost: e.target.value } : i));
                      }} style={{ width: '80px' }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={createPO} style={{ flex: 1, padding: '10px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Create PO</button>
                <button onClick={() => setModalOpen(false)} style={{ flex: 1, padding: '10px', backgroundColor: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
