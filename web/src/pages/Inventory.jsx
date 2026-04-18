import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Inventory() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [brandSummary, setBrandSummary] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState({
    stock_qty: '',
    selling_price_excl_gst: ''
  });
  const [editError, setEditError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteNotification, setDeleteNotification] = useState(null);

  const isOwner = user?.role === 'owner';
  const isManager = user?.role === 'manager';
  const canEdit = isOwner || isManager;

  useEffect(() => {
    fetchProducts();
  }, []);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search) {
        fetchProducts(search);
      } else {
        fetchProducts();
      }
    }, 300); // Wait 300ms after typing stops

    return () => clearTimeout(timer);
  }, [search]);

  async function fetchProducts(searchTerm = '') {
    try {
      const url = searchTerm ? `/products?search=${encodeURIComponent(searchTerm)}` : '/products';
      const res = await api.get(url);
      // Handle both old and new response format
      if (res.data.products) {
        setProducts(res.data.products);
        setBrandSummary(res.data.brand_summary);
      } else {
        setProducts(res.data);
        setBrandSummary(null);
      }
    } catch (err) {
      console.error('Fetch products error:', err);
      if (err.response?.status === 401) {
        setProducts([]);
        setBrandSummary(null);
      } else {
        setProducts([]);
        setBrandSummary(null);
      }
    }
    setLoading(false);
  }

  function openEditModal(product) {
    setEditingProduct(product);
    setEditForm({
      stock_qty: product.stock_qty.toString(),
      selling_price_excl_gst: product.selling_price_excl_gst?.toString() || ''
    });
    setEditError(null);
  }

  function closeEditModal() {
    setEditingProduct(null);
    setEditForm({ stock_qty: '', selling_price_excl_gst: '' });
    setEditError(null);
  }

  // Calculate incl. GST price from excl. GST price
  const computedInclPrice = () => {
    const price = parseFloat(editForm.selling_price_excl_gst) || 0;
    const gstRate = parseFloat(editingProduct?.gst_rate) || 12;
    return Math.round(price * (1 + gstRate / 100) * 100) / 100;
  };

  async function handleSaveEdit() {
    setEditError(null);
    setSaving(true);

    const stockQty = parseInt(editForm.stock_qty);
    const sellingPriceExcl = parseFloat(editForm.selling_price_excl_gst);

    if (isNaN(stockQty) || stockQty < 0) {
      setEditError('Stock quantity must be a non-negative number');
      setSaving(false);
      return;
    }

    if (isNaN(sellingPriceExcl) || sellingPriceExcl <= 0) {
      setEditError('Selling price must be a positive number');
      setSaving(false);
      return;
    }

    try {
      console.log('Frontend - Editing product ID:', editingProduct.id);
      console.log('Frontend - Editing product:', editingProduct);
      
      const payload = {
        stock_qty: stockQty,
        selling_price_excl_gst: sellingPriceExcl
      };
      
      console.log('Frontend - Sending payload:', payload);

      const res = await api.put(`/products/${editingProduct.id}`, payload);
      
      console.log('Frontend - Response:', res.data);
      
      // Check if product was soft-deleted (stock set to 0)
      if (res.data.deleted) {
        // Remove product from local state
        setProducts(products.filter(p => p.id !== editingProduct.id));
        // Show notification
        setDeleteNotification({
          message: `${res.data.display_name} removed from inventory (stock set to 0)`,
          visible: true
        });
        // Hide notification after 3 seconds
        setTimeout(() => {
          setDeleteNotification(null);
        }, 3000);
      } else {
        // Update local state normally
        setProducts(products.map(p => 
          p.id === editingProduct.id ? res.data : p
        ));
      }
      
      closeEditModal();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update product');
    } finally {
      setSaving(false);
    }
  }

  // Products are already filtered by server when searching
  const displayProducts = products;

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <Navbar />
      <div style={{ padding: '20px' }}>
        <h1>Inventory</h1>
        
        {deleteNotification && (
          <div style={{
            padding: '12px 20px',
            marginBottom: '20px',
            borderRadius: '4px',
            backgroundColor: '#fff3cd',
            color: '#856404',
            border: '1px solid #ffc107',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '18px' }}>🗑️</span>
            <span>{deleteNotification.message}</span>
          </div>
        )}
        
        {/* Total Stock Summary */}
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px 20px', 
          backgroundColor: '#e3f2fd', 
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '24px' }}>📦</span>
          <div>
            <span style={{ fontSize: '16px', color: '#666' }}>Total Stock Available: </span>
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196F3' }}>
              {products.reduce((sum, p) => sum + (p.stock_qty || 0), 0)} units
            </span>
          </div>
        </div>

        {/* Total Cost and Selling Price Summary */}
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px 20px', 
          backgroundColor: '#fff8e1', 
          borderRadius: '8px',
          border: '2px solid #ffa000',
          display: 'flex',
          alignItems: 'center',
          gap: '30px'
        }}>
          <span style={{ fontSize: '28px' }}>💰</span>
          <div style={{ display: 'flex', gap: '40px', flex: 1 }}>
            <div>
              <span style={{ fontSize: '14px', color: '#666', display: 'block', marginBottom: '4px' }}>
                Total Selling Price (Excl GST)
              </span>
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#2e7d32' }}>
                ₹{products.reduce((sum, p) => sum + ((p.selling_price_excl_gst || 0) * (p.stock_qty || 0)), 0).toFixed(2)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '14px', color: '#666', display: 'block', marginBottom: '4px' }}>
                Total Selling Price (Incl GST)
              </span>
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#1565c0' }}>
                ₹{products.reduce((sum, p) => sum + ((p.selling_price_incl_gst || 0) * (p.stock_qty || 0)), 0).toFixed(2)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '14px', color: '#666', display: 'block', marginBottom: '4px' }}>
                Total Cost Price
              </span>
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#e65100' }}>
                ₹{products.reduce((sum, p) => sum + ((p.cost_price || 0) * (p.stock_qty || 0)), 0).toFixed(2)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '14px', color: '#666', display: 'block', marginBottom: '4px' }}>
                Potential Profit
              </span>
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#2e7d32' }}>
                ₹{products.reduce((sum, p) => {
                  const cost = (p.cost_price || 0) * (p.stock_qty || 0);
                  const selling = (p.selling_price_excl_gst || 0) * (p.stock_qty || 0);
                  return sum + (selling - cost);
                }, 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Brand Stock Summary - Shows when searching for a specific company */}
        {brandSummary && (
          <div style={{ 
            marginBottom: '20px', 
            padding: '15px 20px', 
            backgroundColor: '#e8f5e9', 
            borderRadius: '8px',
            border: '2px solid #4CAF50',
            display: 'flex',
            alignItems: 'center',
            gap: '15px'
          }}>
            <span style={{ fontSize: '28px' }}>🏭</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', color: '#666', marginBottom: '4px' }}>
                <strong>{brandSummary.company_name}</strong> Combined Stock:
              </div>
              <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '14px', color: '#666' }}>Total Units: </span>
                  <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#2e7d32' }}>
                    {brandSummary.total_stock}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '14px', color: '#666' }}>Products: </span>
                  <span style={{ fontSize: '18px', fontWeight: '600', color: '#1976d2' }}>
                    {brandSummary.product_count} variants
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              padding: '10px', 
              border: '1px solid #ddd', 
              borderRadius: '4px', 
              width: '400px',
              fontSize: '16px'
            }}
          />
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f5f5f5' }}>
              <th style={{ textAlign: 'left', padding: '10px' }}>Product</th>
              <th style={{ textAlign: 'right' }}>Price (Excl)</th>
              <th style={{ textAlign: 'right' }}>Price (Incl)</th>
              <th style={{ textAlign: 'center' }}>GST</th>
              <th style={{ textAlign: 'right' }}>Stock</th>
              <th style={{ textAlign: 'right' }}>Cost</th>
              {canEdit && <th style={{ textAlign: 'center' }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {displayProducts.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>
                  <div style={{ fontWeight: '500' }}>{p.display_name}</div>
                </td>
                <td style={{ textAlign: 'right' }}>₹{parseFloat(p.selling_price_excl_gst || 0).toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>₹{parseFloat(p.selling_price_incl_gst || 0).toFixed(2)}</td>
                <td style={{ textAlign: 'center' }}>{p.gst_rate}%</td>
                <td style={{ textAlign: 'right' }}>{p.stock_qty}</td>
                <td style={{ textAlign: 'right' }}>₹{p.cost_price ? parseFloat(p.cost_price).toFixed(2) : '-'}</td>
                {canEdit && (
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => openEditModal(p)}
                      style={{
                        padding: '6px 16px',
                        backgroundColor: '#2196F3',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      Update
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        
        {displayProducts.length === 0 && (
          <p style={{ textAlign: 'center', color: '#666', marginTop: '20px' }}>No products found</p>
        )}
      </div>

      {/* Edit Modal */}
      {editingProduct && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#fff',
            padding: '30px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '450px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            <h2 style={{ marginBottom: '8px' }}>
              Update — {editingProduct.company_name} {editingProduct.size_spec}
            </h2>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                Stock quantity
              </label>
              <input
                type="number"
                value={editForm.stock_qty}
                onChange={(e) => setEditForm({ ...editForm, stock_qty: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px'
                }}
                min="0"
              />
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                Selling price (excl GST) ₹
              </label>
              <input
                type="number"
                step="0.01"
                value={editForm.selling_price_excl_gst}
                onChange={(e) => setEditForm({ ...editForm, selling_price_excl_gst: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px'
                }}
              />
            </div>

            <div style={{
              marginBottom: '20px',
              padding: '10px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              fontSize: '14px',
              color: '#666'
            }}>
              Incl. GST ({editingProduct.gst_rate}%): ₹ {computedInclPrice().toFixed(2)}
            </div>

            {editError && (
              <div style={{
                marginBottom: '20px',
                padding: '10px',
                backgroundColor: '#ffebee',
                color: '#c62828',
                borderRadius: '4px',
                fontSize: '14px'
              }}>
                {editError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={closeEditModal}
                disabled={saving}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#999',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                style={{
                  padding: '10px 24px',
                  backgroundColor: saving ? '#81c784' : '#4CAF50',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '16px'
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
