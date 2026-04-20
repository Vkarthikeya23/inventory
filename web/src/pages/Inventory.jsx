import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';

// Apply autoTable plugin to jsPDF
applyPlugin(jsPDF);

export default function Inventory() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [brandSummary, setBrandSummary] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState({
    stock_qty: '',
    cost_price: '',
    selling_price_excl_gst: '',
    selling_price_incl_gst: '',
    price_entry_mode: 'excl'
  });
  const [editError, setEditError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteNotification, setDeleteNotification] = useState(null);

  // Purchase Order Modal States
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [poSelectedProducts, setPoSelectedProducts] = useState({});
  const [poQuantities, setPoQuantities] = useState({});

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
      cost_price: product.cost_price?.toString() || '',
      selling_price_excl_gst: product.selling_price_excl_gst?.toString() || '',
      selling_price_incl_gst: product.selling_price_incl_gst?.toString() || '',
      gst_rate: product.gst_rate?.toString() || '12',
      price_entry_mode: 'excl'
    });
    setEditError(null);
  }

  function closeEditModal() {
    setEditingProduct(null);
    setEditForm({ stock_qty: '', cost_price: '', selling_price_excl_gst: '', selling_price_incl_gst: '', gst_rate: '12', price_entry_mode: 'excl' });
    setEditError(null);
  }

  // Calculate prices based on entry mode
  const calculatePrices = () => {
    const gstRate = parseFloat(editForm.gst_rate) || 12;
    
    if (editForm.price_entry_mode === 'excl') {
      // User entered price excluding GST
      const exclPrice = parseFloat(editForm.selling_price_excl_gst) || 0;
      const inclPrice = Math.round(exclPrice * (1 + gstRate / 100) * 100) / 100;
      return { excl: exclPrice, incl: inclPrice };
    } else {
      // User entered price including GST
      const inclPrice = parseFloat(editForm.selling_price_incl_gst) || 0;
      const exclPrice = Math.round(inclPrice / (1 + gstRate / 100) * 100) / 100;
      return { excl: exclPrice, incl: inclPrice };
    }
  };

  async function handleSaveEdit() {
    setEditError(null);
    setSaving(true);

    const stockQty = parseInt(editForm.stock_qty);
    const costPrice = parseFloat(editForm.cost_price);
    const gstRate = parseFloat(editForm.gst_rate);
    const { excl: sellingPriceExcl, incl: sellingPriceIncl } = calculatePrices();

    if (isNaN(stockQty) || stockQty < 0) {
      setEditError('Stock quantity must be a non-negative number');
      setSaving(false);
      return;
    }

    if (isNaN(costPrice) || costPrice < 0) {
      setEditError('Cost price must be a non-negative number');
      setSaving(false);
      return;
    }

    if (isNaN(sellingPriceExcl) || sellingPriceExcl <= 0) {
      setEditError('Selling price must be greater than 0');
      setSaving(false);
      return;
    }

    if (isNaN(gstRate) || gstRate < 0 || gstRate > 100) {
      setEditError('GST rate must be between 0 and 100');
      setSaving(false);
      return;
    }

    try {
      console.log('Frontend - Editing product ID:', editingProduct.id);
      console.log('Frontend - Editing product:', editingProduct);
      
      const payload = {
        stock_qty: stockQty,
        cost_price: costPrice,
        selling_price_excl_gst: sellingPriceExcl,
        selling_price_incl_gst: sellingPriceIncl,
        gst_rate: gstRate
      };
      
      console.log('Frontend - Sending payload:', payload);

      const res = await api.put(`/products/${editingProduct.id}`, payload);
      
      console.log('Frontend - Response:', res.data);
      
      // Update local state
      setProducts(products.map(p => 
        p.id === editingProduct.id ? res.data : p
      ));
      
      closeEditModal();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update product');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProduct() {
    if (!confirm(`Are you sure you want to permanently delete ${editingProduct.company_name} ${editingProduct.size_spec}? This cannot be undone.`)) {
      return;
    }

    setSaving(true);
    try {
      await api.delete(`/products/${editingProduct.id}`);
      
      // Remove from local state
      setProducts(products.filter(p => p.id !== editingProduct.id));
      
      // Show notification
      setDeleteNotification({
        message: `${editingProduct.company_name} ${editingProduct.size_spec} has been permanently deleted`,
        visible: true
      });
      
      // Hide notification after 3 seconds
      setTimeout(() => {
        setDeleteNotification(null);
      }, 3000);
      
      closeEditModal();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to delete product');
    } finally {
      setSaving(false);
    }
  }

  // Purchase Order Functions
  function openPoModal() {
    setPoModalOpen(true);
    setPoSelectedProducts({});
    // Initialize quantities to 10 for all products
    const initialQuantities = {};
    products.forEach(p => {
      initialQuantities[p.id] = 10;
    });
    setPoQuantities(initialQuantities);
  }

  function closePoModal() {
    setPoModalOpen(false);
    setPoSelectedProducts({});
    setPoQuantities({});
  }

  function toggleProductSelection(productId) {
    setPoSelectedProducts(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  }

  function updatePoQuantity(productId, quantity) {
    const num = parseInt(quantity) || 0;
    if (num >= 0) {
      setPoQuantities(prev => ({
        ...prev,
        [productId]: num
      }));
    }
  }

  function selectLowStock() {
    const selected = {};
    products.forEach(p => {
      if ((p.stock_qty || 0) < 4) {
        selected[p.id] = true;
      }
    });
    setPoSelectedProducts(selected);
  }

  async function generatePoPdf() {
    console.log('generatePoPdf called');
    console.log('jsPDF available:', typeof jsPDF);
    console.log('poSelectedProducts:', poSelectedProducts);
    console.log('products:', products.length, 'items');
    
    const selectedProducts = products.filter(p => poSelectedProducts[p.id]);
    console.log('selectedProducts:', selectedProducts.length, 'items');
    
    if (selectedProducts.length === 0) {
      alert('Please select at least one product');
      return;
    }

    try {
      console.log('Creating jsPDF instance...');
      const doc = new jsPDF();
      console.log('jsPDF instance created, autoTable available:', typeof doc.autoTable);
      const pageWidth = doc.internal.pageSize.width;
      
      // Header
      doc.setFontSize(20);
      doc.setTextColor(0, 0, 128);
      doc.text('PURCHASE ORDER', pageWidth / 2, 20, { align: 'center' });
      
      // Shop details
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('SRI MAHALAKSHMI TYRES', pageWidth / 2, 35, { align: 'center' });
      doc.setFontSize(10);
      doc.text('H.No. 3-25, Old RC Puram, Patancheru, Sangareddy Dist.', pageWidth / 2, 42, { align: 'center' });
      doc.text('Phone no.: 99499 56515, 9346513095, 9100717642', pageWidth / 2, 48, { align: 'center' });
      doc.text('GSTIN: 36AVGPJ4122R1Z8', pageWidth / 2, 54, { align: 'center' });
      
      // PO Details
      doc.setFontSize(11);
      doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 20, 60);
      doc.text(`PO #: PO-${Date.now().toString().slice(-6)}`, 20, 68);
      
      // Table data
      const tableData = selectedProducts.map(p => {
        const qty = parseInt(poQuantities[p.id]) || 0;
        const cost = parseFloat(p.cost_price) || 0;
        return [
          p.display_name,
          qty,
          `Rs.${cost.toFixed(2)}`,
          `Rs.${(qty * cost).toFixed(2)}`
        ];
      });

      doc.autoTable({
        startY: 78,
        head: [['Product', 'Quantity', 'Cost Price', 'Total']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [33, 150, 243],
          textColor: 255,
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' }
        },
        margin: { left: 20, right: 20 }
      });

      // Total
      const totalAmount = selectedProducts.reduce((sum, p) => {
        return sum + ((poQuantities[p.id] || 0) * (p.cost_price || 0));
      }, 0);

      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Amount: Rs.${totalAmount.toFixed(2)}`, pageWidth - 20, finalY, { align: 'right' });
      
      // Footer note
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('This is a purchase order for stock replenishment.', 20, finalY + 20);
      doc.text('Please confirm availability and delivery schedule.', 20, finalY + 28);

      doc.save(`Purchase_Order_${new Date().toISOString().slice(0, 10)}.pdf`);
      closePoModal();
      console.log('PDF generated successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF: ' + error.message);
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

        {/* Potential Profit Summary - Excl and Incl GST */}
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px 20px', 
          backgroundColor: '#fff8e1', 
          borderRadius: '8px',
          border: '2px solid #ffa000',
          display: 'flex',
          alignItems: 'center',
          gap: '40px'
        }}>
          <span style={{ fontSize: '28px' }}>💰</span>
          <div style={{ display: 'flex', gap: '40px' }}>
            <div>
              <span style={{ fontSize: '14px', color: '#666', display: 'block', marginBottom: '4px' }}>
                Potential Profit (Excl GST)
              </span>
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#2e7d32' }}>
                ₹{products.reduce((sum, p) => {
                  const cost = (p.cost_price || 0) * (p.stock_qty || 0);
                  const selling = (p.selling_price_excl_gst || 0) * (p.stock_qty || 0);
                  return sum + (selling - cost);
                }, 0).toFixed(2)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '14px', color: '#666', display: 'block', marginBottom: '4px' }}>
                Potential Profit (Incl GST)
              </span>
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#1976d2' }}>
                ₹{products.reduce((sum, p) => {
                  const cost = (p.cost_price || 0) * (p.stock_qty || 0);
                  const selling = (p.selling_price_incl_gst || 0) * (p.stock_qty || 0);
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

        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
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
          <button
            onClick={openPoModal}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2196F3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>📥</span>
            Download PO
          </button>
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
              <th style={{ textAlign: 'right' }}>Total Cost</th>
              {canEdit && <th style={{ textAlign: 'center' }}>Action</th>}
            </tr>
            {/* Total row for columns */}
            <tr style={{ borderBottom: '1px solid #ddd', backgroundColor: '#e3f2fd' }}>
              <td style={{ padding: '8px 10px', fontWeight: 'bold', color: '#333' }}>Total</td>
              <td style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 'bold', color: '#2e7d32' }}>
                ₹{products.reduce((sum, p) => sum + ((p.selling_price_excl_gst || 0) * (p.stock_qty || 0)), 0).toFixed(2)}
              </td>
              <td style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 'bold', color: '#1565c0' }}>
                ₹{products.reduce((sum, p) => sum + ((p.selling_price_incl_gst || 0) * (p.stock_qty || 0)), 0).toFixed(2)}
              </td>
              <td></td>
              <td style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 'bold', color: '#333' }}>
                {products.reduce((sum, p) => sum + (p.stock_qty || 0), 0)}
              </td>
              <td style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 'bold', color: '#e65100' }}>
                -
              </td>
              <td style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 'bold', color: '#d84315' }}>
                ₹{products.reduce((sum, p) => sum + ((p.cost_price || 0) * (p.stock_qty || 0)), 0).toFixed(2)}
              </td>
              {canEdit && <td></td>}
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
                <td style={{ textAlign: 'right' }}>
                  ₹{((p.cost_price || 0) * (p.stock_qty || 0)).toFixed(2)}
                </td>
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
            maxWidth: '500px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            <h2 style={{ marginBottom: '8px' }}>
              Update — {editingProduct.company_name} {editingProduct.size_spec}
            </h2>
            
            {/* Stock Quantity */}
            <div style={{ marginBottom: '15px' }}>
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

            {/* Cost Price */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                Cost Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={editForm.cost_price}
                onChange={(e) => setEditForm({ ...editForm, cost_price: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px'
                }}
              />
            </div>

            {/* GST Rate */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                GST Rate (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={editForm.gst_rate}
                onChange={(e) => setEditForm({ ...editForm, gst_rate: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px'
                }}
              />
            </div>

            {/* Price Entry Mode Toggle */}
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                Price Entry Mode
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, price_entry_mode: 'excl' })}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: editForm.price_entry_mode === 'excl' ? '#2196F3' : '#f5f5f5',
                    color: editForm.price_entry_mode === 'excl' ? '#fff' : '#333',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: editForm.price_entry_mode === 'excl' ? '600' : '400'
                  }}
                >
                  Excluding GST
                </button>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, price_entry_mode: 'incl' })}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: editForm.price_entry_mode === 'incl' ? '#2196F3' : '#f5f5f5',
                    color: editForm.price_entry_mode === 'incl' ? '#fff' : '#333',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: editForm.price_entry_mode === 'incl' ? '600' : '400'
                  }}
                >
                  Including GST
                </button>
              </div>
            </div>

            {/* Selling Price Input */}
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                Selling Price ({editForm.price_entry_mode === 'excl' ? 'Excl' : 'Incl'} GST) ₹
              </label>
              {editForm.price_entry_mode === 'excl' ? (
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
              ) : (
                <input
                  type="number"
                  step="0.01"
                  value={editForm.selling_price_incl_gst}
                  onChange={(e) => setEditForm({ ...editForm, selling_price_incl_gst: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px'
                  }}
                />
              )}
            </div>

            {/* Display Calculated Price */}
            <div style={{
              marginBottom: '20px',
              padding: '10px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              fontSize: '14px',
              color: '#666'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Excl. GST:</span>
                <span style={{ fontWeight: '600' }}>₹ {calculatePrices().excl.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span>Incl. GST ({editForm.gst_rate}%):</span>
                <span style={{ fontWeight: '600' }}>₹ {calculatePrices().incl.toFixed(2)}</span>
              </div>
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

            {/* Action Buttons */}
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
              
              {/* Delete button - red color */}
              <button
                onClick={handleDeleteProduct}
                disabled={saving}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#f44336',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Delete
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

      {/* Purchase Order Modal */}
      {poModalOpen && (
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
            maxWidth: '900px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            <h2 style={{ marginBottom: '20px' }}>
              Generate Purchase Order
            </h2>

            {/* Actions Bar */}
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
              <button
                onClick={selectLowStock}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ff9800',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Select Low Stock ({'<'} 4)
              </button>
              <span style={{ marginLeft: 'auto', fontSize: '14px', color: '#666' }}>
                Selected: {Object.values(poSelectedProducts).filter(Boolean).length} products
              </span>
            </div>

            {/* Products Table */}
            <div style={{ maxHeight: '50vh', overflow: 'auto', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f5f5f5' }}>
                    <th style={{ textAlign: 'left', padding: '10px', width: '40px' }}>Select</th>
                    <th style={{ textAlign: 'left', padding: '10px' }}>Product</th>
                    <th style={{ textAlign: 'right', padding: '10px' }}>Current Stock</th>
                    <th style={{ textAlign: 'right', padding: '10px' }}>Cost Price</th>
                    <th style={{ textAlign: 'center', padding: '10px', width: '120px' }}>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const isLowStock = (p.stock_qty || 0) < 4;
                    return (
                      <tr
                        key={p.id}
                        style={{
                          borderBottom: '1px solid #eee',
                          backgroundColor: isLowStock ? '#fff3e0' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={!!poSelectedProducts[p.id]}
                            onChange={() => toggleProductSelection(p.id)}
                            style={{ width: '18px', height: '18px' }}
                          />
                        </td>
                        <td style={{ padding: '10px' }}>
                          <div style={{ fontWeight: '500' }}>{p.display_name}</div>
                          {isLowStock && (
                            <span style={{
                              fontSize: '12px',
                              color: '#e65100',
                              fontWeight: 'bold'
                            }}>
                              ⚠ Low Stock
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          {p.stock_qty || 0}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          ₹{parseFloat(p.cost_price || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <input
                            type="number"
                            min="1"
                            value={poQuantities[p.id] || ''}
                            onChange={(e) => updatePoQuantity(p.id, e.target.value)}
                            disabled={!poSelectedProducts[p.id]}
                            style={{
                              width: '80px',
                              padding: '6px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              textAlign: 'center',
                              opacity: poSelectedProducts[p.id] ? 1 : 0.5
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div style={{
              marginBottom: '20px',
              padding: '15px',
              backgroundColor: '#e3f2fd',
              borderRadius: '4px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '14px', color: '#666' }}>
                Total Items: {Object.values(poSelectedProducts).filter(Boolean).length}
              </span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1976d2' }}>
                Total: ₹{products
                  .filter(p => poSelectedProducts[p.id])
                  .reduce((sum, p) => sum + ((poQuantities[p.id] || 0) * (p.cost_price || 0)), 0)
                  .toFixed(2)}
              </span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={closePoModal}
                style={{
                  padding: '12px 24px',
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
                onClick={generatePoPdf}
                disabled={Object.values(poSelectedProducts).filter(Boolean).length === 0}
                style={{
                  padding: '12px 24px',
                  backgroundColor: Object.values(poSelectedProducts).filter(Boolean).length === 0 ? '#ccc' : '#4CAF50',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: Object.values(poSelectedProducts).filter(Boolean).length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '16px'
                }}
              >
                📄 Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
