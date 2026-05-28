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
  const [poColumns, setPoColumns] = useState({
    current_stock: true,
    cost_price: true,
    quantity: true
  });

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
      company_name: product.company_name || '',
      size_spec: product.size_spec || '',
      stock_qty: product.stock_qty.toString(),
      cost_price: product.cost_price?.toString() || '',
      selling_price_excl_gst: product.selling_price_excl_gst?.toString() || '',
      selling_price_incl_gst: product.selling_price_incl_gst?.toString() || '',
      cgst_rate: (product.cgst_rate !== undefined && product.cgst_rate !== null && product.cgst_rate !== '' ? product.cgst_rate : (product.gst_rate ? product.gst_rate / 2 : 6)).toString(),
      sgst_rate: (product.sgst_rate !== undefined && product.sgst_rate !== null && product.sgst_rate !== '' ? product.sgst_rate : (product.gst_rate ? product.gst_rate / 2 : 6)).toString(),
      price_entry_mode: 'excl'
    });
    setEditError(null);
  }

  function closeEditModal() {
    setEditingProduct(null);
    setEditForm({ company_name: '', size_spec: '', stock_qty: '', cost_price: '', selling_price_excl_gst: '', selling_price_incl_gst: '', cgst_rate: '6', sgst_rate: '6', price_entry_mode: 'excl' });
    setEditError(null);
  }

  // Calculate prices based on entry mode
  const calculatePrices = () => {
    const cgstRate = editForm.cgst_rate !== '' && editForm.cgst_rate !== undefined ? parseFloat(editForm.cgst_rate) : 6;
    const sgstRate = editForm.sgst_rate !== '' && editForm.sgst_rate !== undefined ? parseFloat(editForm.sgst_rate) : 6;
    const totalGstRate = cgstRate + sgstRate;
    
    if (editForm.price_entry_mode === 'excl') {
      // User entered price excluding GST
      const exclPrice = parseFloat(editForm.selling_price_excl_gst) || 0;
      if (totalGstRate === 0) {
        return { excl: exclPrice, incl: exclPrice };
      }
      const inclPrice = Math.round(exclPrice * (1 + totalGstRate / 100) * 100) / 100;
      return { excl: exclPrice, incl: inclPrice };
    } else {
      // User entered price including GST
      const inclPrice = parseFloat(editForm.selling_price_incl_gst) || 0;
      if (totalGstRate === 0) {
        return { excl: inclPrice, incl: inclPrice };
      }
      const exclPrice = Math.round(inclPrice / (1 + totalGstRate / 100) * 100) / 100;
      return { excl: exclPrice, incl: inclPrice };
    }
  };

  async function handleSaveEdit() {
    setEditError(null);
    setSaving(true);

    const stockQty = parseInt(editForm.stock_qty);
    const costPrice = parseFloat(editForm.cost_price);
    const cgstRate = parseFloat(editForm.cgst_rate);
    const sgstRate = parseFloat(editForm.sgst_rate);
    const effectiveCgstRate = isNaN(cgstRate) ? 0 : cgstRate;
    const effectiveSgstRate = isNaN(sgstRate) ? 0 : sgstRate;
    
    let { excl: sellingPriceExcl, incl: sellingPriceIncl } = calculatePrices();
    
    // When GST is 0, incl must equal excl
    if (effectiveCgstRate === 0 && effectiveSgstRate === 0) {
      sellingPriceIncl = sellingPriceExcl;
    }

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

    if (effectiveCgstRate < 0 || effectiveSgstRate < 0 || effectiveCgstRate > 100 || effectiveSgstRate > 100) {
      setEditError('CGST and SGST rates must be between 0 and 100');
      setSaving(false);
      return;
    }

    try {
      console.log('Frontend - Editing product ID:', editingProduct.id);
      console.log('Frontend - Editing product:', editingProduct);
      
      const payload = {
        company_name: editForm.company_name,
        size_spec: editForm.size_spec,
        stock_qty: stockQty,
        cost_price: costPrice,
        selling_price_excl_gst: sellingPriceExcl,
        selling_price_incl_gst: sellingPriceIncl,
        cgst_rate: effectiveCgstRate,
        sgst_rate: effectiveSgstRate,
        gst_rate: effectiveCgstRate + effectiveSgstRate
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
    setPoQuantities({});
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

  function selectAll() {
    const selected = {};
    products.forEach(p => {
      selected[p.id] = true;
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
        const row = [p.display_name];
        if (poColumns.current_stock) row.push(p.stock_qty || 0);
        if (poColumns.quantity) row.push(qty);
        if (poColumns.cost_price) row.push(`Rs.${cost.toFixed(2)}`);
        if (poColumns.quantity && poColumns.cost_price) row.push(`Rs.${(qty * cost).toFixed(2)}`);
        return row;
      });

      const head = ['Product'];
      if (poColumns.current_stock) head.push('Current Stock');
      if (poColumns.quantity) head.push('Quantity');
      if (poColumns.cost_price) head.push('Cost Price');
      if (poColumns.quantity && poColumns.cost_price) head.push('Total');

      const columnStyles = { 0: { cellWidth: 'auto' } };
      let colIndex = 1;
      if (poColumns.current_stock) {
        columnStyles[colIndex] = { halign: 'center' };
        colIndex++;
      }
      if (poColumns.quantity) {
        columnStyles[colIndex] = { halign: 'center' };
        colIndex++;
      }
      if (poColumns.cost_price) {
        columnStyles[colIndex] = { halign: 'right' };
        colIndex++;
      }
      if (poColumns.quantity && poColumns.cost_price) {
        columnStyles[colIndex] = { halign: 'right' };
      }

      doc.autoTable({
        startY: 78,
        head: [head],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [33, 150, 243],
          textColor: 255,
          fontStyle: 'bold'
        },
        columnStyles: columnStyles,
        margin: { left: 20, right: 20 }
      });

      // Total
      const totalAmount = selectedProducts.reduce((sum, p) => {
        return sum + ((poQuantities[p.id] || 0) * (p.cost_price || 0));
      }, 0);

      const finalY = doc.lastAutoTable.finalY + 10;
      
      if (poColumns.quantity && poColumns.cost_price) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Total Amount: Rs.${totalAmount.toFixed(2)}`, pageWidth - 20, finalY, { align: 'right' });
      }
      
      // Footer note
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const footerY = poColumns.quantity && poColumns.cost_price ? finalY + 20 : finalY + 10;
      doc.text('This is a purchase order for stock replenishment.', 20, footerY);
      doc.text('Please confirm availability and delivery schedule.', 20, footerY + 8);

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
    <div style={{ backgroundColor: '#F7F5F0', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        <h1 style={{ color: '#2E2C27', marginBottom: '20px' }}>Inventory</h1>
        
        {deleteNotification && (
          <div style={{
            padding: '12px 20px',
            marginBottom: '20px',
            borderRadius: '8px',
            backgroundColor: '#F7F5F0',
            color: '#B85C5C',
            border: '1px solid #B85C5C',
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
          backgroundColor: '#E8E4DA', 
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <span style={{ fontSize: '24px' }}>📦</span>
          <div>
            <span style={{ fontSize: '14px', color: '#6B6860' }}>Total Stock Available: </span>
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#4A8A62' }}>
              {products.reduce((sum, p) => sum + (p.stock_qty || 0), 0)} units
            </span>
          </div>
        </div>

        {/* Potential Profit Summary - Excl and Incl GST */}
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px 20px', 
          backgroundColor: '#E8E4DA', 
          borderRadius: '12px',
          border: '2px solid #7BAF8A',
          display: 'flex',
          alignItems: 'center',
          gap: '40px'
        }}>
          <span style={{ fontSize: '28px' }}>💰</span>
          <div style={{ display: 'flex', gap: '40px' }}>
            <div>
              <span style={{ fontSize: '14px', color: '#6B6860', display: 'block', marginBottom: '4px' }}>
                Potential Profit (Excl GST)
              </span>
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#4A8A62' }}>
                ₹{products.reduce((sum, p) => {
                  const cost = (p.cost_price || 0) * (p.stock_qty || 0);
                  const selling = (p.selling_price_excl_gst || 0) * (p.stock_qty || 0);
                  return sum + (selling - cost);
                }, 0).toFixed(2)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '14px', color: '#6B6860', display: 'block', marginBottom: '4px' }}>
                Potential Profit (Incl GST)
              </span>
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#4A8A62' }}>
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
            backgroundColor: '#E8E4DA', 
            borderRadius: '12px',
            border: '2px solid #7BAF8A',
            display: 'flex',
            alignItems: 'center',
            gap: '15px'
          }}>
            <span style={{ fontSize: '28px' }}>🏭</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', color: '#6B6860', marginBottom: '4px' }}>
                <strong>{brandSummary.company_name}</strong> Combined Stock:
              </div>
              <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '14px', color: '#6B6860' }}>Total Units: </span>
                  <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#4A8A62' }}>
                    {brandSummary.total_stock}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '14px', color: '#6B6860' }}>Products: </span>
                  <span style={{ fontSize: '18px', fontWeight: '600', color: '#4A8A62' }}>
                    {brandSummary.product_count} variants
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '12px 15px',
              border: '1px solid #D4D0C8',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '400px',
              fontSize: '16px',
              backgroundColor: '#E8E4DA',
              color: '#2E2C27',
            }}
          />
          <button
            onClick={openPoModal}
            style={{
              padding: '10px 20px',
              backgroundColor: '#4A8A62',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>📥</span>
            Download PO
          </button>
        </div>

        <div style={{ backgroundColor: '#E8E4DA', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#7BAF8A' }}>
                <th style={{ textAlign: 'left', padding: '12px 15px', color: '#fff', fontSize: '14px' }}>Product</th>
                <th style={{ textAlign: 'right', padding: '12px', color: '#fff', fontSize: '14px' }}>Price (Excl)</th>
                <th style={{ textAlign: 'right', padding: '12px', color: '#fff', fontSize: '14px' }}>Price (Incl)</th>
                <th style={{ textAlign: 'center', padding: '12px', color: '#fff', fontSize: '14px' }}>CGST</th>
                <th style={{ textAlign: 'center', padding: '12px', color: '#fff', fontSize: '14px' }}>SGST</th>
                <th style={{ textAlign: 'right', padding: '12px', color: '#fff', fontSize: '14px' }}>Stock</th>
                <th style={{ textAlign: 'right', padding: '12px', color: '#fff', fontSize: '14px' }}>Cost</th>
                <th style={{ textAlign: 'right', padding: '12px', color: '#fff', fontSize: '14px' }}>Total Cost</th>
                {canEdit && <th style={{ textAlign: 'center', padding: '12px', color: '#fff', fontSize: '14px' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {/* Total row for columns */}
              <tr style={{ backgroundColor: '#D4D0C8' }}>
                <td style={{ padding: '10px 15px', fontWeight: 'bold', color: '#2E2C27', fontSize: '14px' }}>Total</td>
                <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 'bold', color: '#4A8A62', fontSize: '14px' }}>
                  ₹{products.reduce((sum, p) => sum + ((p.selling_price_excl_gst || 0) * (p.stock_qty || 0)), 0).toFixed(2)}
                </td>
                <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 'bold', color: '#4A8A62', fontSize: '14px' }}>
                  ₹{products.reduce((sum, p) => sum + ((p.selling_price_incl_gst || 0) * (p.stock_qty || 0)), 0).toFixed(2)}
                </td>
                <td></td>
                <td></td>
                <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 'bold', color: '#2E2C27', fontSize: '14px' }}>
                  {products.reduce((sum, p) => sum + (p.stock_qty || 0), 0)}
              </td>
              <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 'bold', color: '#2E2C27', fontSize: '14px' }}>-</td>
              <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 'bold', color: '#2E2C27', fontSize: '14px' }}>
                ₹{products.reduce((sum, p) => sum + ((p.cost_price || 0) * (p.stock_qty || 0)), 0).toFixed(2)}
              </td>
              {canEdit && <td></td>}
            </tr>
              {displayProducts.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #D4D0C8' }}>
                <td style={{ padding: '12px 15px' }}>
                  <div style={{ fontWeight: '500', color: '#2E2C27', fontSize: '15px' }}>{p.display_name}</div>
                </td>
                <td style={{ textAlign: 'right', color: '#2E2C27', fontSize: '14px' }}>₹{parseFloat(p.selling_price_excl_gst || 0).toFixed(2)}</td>
                <td style={{ textAlign: 'right', color: '#2E2C27', fontSize: '14px' }}>₹{parseFloat(p.selling_price_incl_gst || 0).toFixed(2)}</td>
                <td style={{ textAlign: 'center', color: '#6B6860', fontSize: '14px' }}>{parseFloat(p.cgst_rate !== null && p.cgst_rate !== undefined ? p.cgst_rate : (p.gst_rate ? p.gst_rate / 2 : 0)).toFixed(1)}%</td>
                <td style={{ textAlign: 'center', color: '#6B6860', fontSize: '14px' }}>{parseFloat(p.sgst_rate !== null && p.sgst_rate !== undefined ? p.sgst_rate : (p.gst_rate ? p.gst_rate / 2 : 0)).toFixed(1)}%</td>
                <td style={{ textAlign: 'right', color: '#2E2C27', fontSize: '14px' }}>{p.stock_qty}</td>
                <td style={{ textAlign: 'right', color: '#6B6860', fontSize: '14px' }}>₹{p.cost_price ? parseFloat(p.cost_price).toFixed(2) : '-'}</td>
                <td style={{ textAlign: 'right', color: '#2E2C27', fontSize: '14px', fontWeight: '500' }}>
                  ₹{((p.cost_price || 0) * (p.stock_qty || 0)).toFixed(2)}
                </td>
                {canEdit && (
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => openEditModal(p)}
                      style={{
                        padding: '6px 16px',
                        backgroundColor: '#4A8A62',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
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
        </div>
        </div>
        
        {displayProducts.length === 0 && (
          <p style={{ textAlign: 'center', color: '#6B6860', marginTop: '20px', fontSize: '16px' }}>No products found</p>
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
          backgroundColor: 'rgba(46, 44, 39, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '10px'
        }}>
          <div style={{
            backgroundColor: '#E8E4DA',
            padding: '25px',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            <h2 style={{ marginBottom: '20px', color: '#2E2C27' }}>
              Update — {editingProduct.company_name} {editingProduct.size_spec}
            </h2>

            {/* Product Name */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                Company Name
              </label>
              <input
                type="text"
                value={editForm.company_name}
                onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px'
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                Size Spec
              </label>
              <input
                type="text"
                value={editForm.size_spec}
                onChange={(e) => setEditForm({ ...editForm, size_spec: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #D4D0C8',
                  borderRadius: '8px',
                  fontSize: '16px',
                  backgroundColor: '#F7F5F0',
                  color: '#2E2C27',
                }}
              />
            </div>

            {/* Stock Quantity */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#2E2C27' }}>
                Stock quantity
              </label>
              <input
                type="number"
                value={editForm.stock_qty}
                onChange={(e) => setEditForm({ ...editForm, stock_qty: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #D4D0C8',
                  borderRadius: '8px',
                  fontSize: '16px',
                  backgroundColor: '#F7F5F0',
                  color: '#2E2C27',
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

            {/* CGST and SGST Rate */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                CGST & SGST (%)
              </label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={editForm.cgst_rate}
                  onChange={(e) => {
                    const newCgstRate = e.target.value;
                    setEditForm(prev => {
                      const updated = { ...prev, cgst_rate: newCgstRate };
                      // When both are 0, make incl = excl
                      if (newCgstRate === '0' || newCgstRate === '') {
                        if (prev.sgst_rate === '0' || prev.sgst_rate === '') {
                          updated.selling_price_incl_gst = prev.selling_price_excl_gst;
                        }
                      }
                      return updated;
                    });
                  }}
                  placeholder="CGST"
                  style={{
                    flex: '1 1 45%',
                    minWidth: '120px',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px'
                  }}
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={editForm.sgst_rate}
                  onChange={(e) => {
                    const newSgstRate = e.target.value;
                    setEditForm(prev => {
                      const updated = { ...prev, sgst_rate: newSgstRate };
                      // When both are 0, make incl = excl
                      if (newSgstRate === '0' || newSgstRate === '') {
                        if (prev.cgst_rate === '0' || prev.cgst_rate === '') {
                          updated.selling_price_incl_gst = prev.selling_price_excl_gst;
                        }
                      }
                      return updated;
                    });
                  }}
                  placeholder="SGST"
                  style={{
                    flex: '1 1 45%',
                    minWidth: '120px',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px'
                  }}
                />
              </div>
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
                    backgroundColor: editForm.price_entry_mode === 'excl' ? '#4A8A62' : '#F7F5F0',
                    color: editForm.price_entry_mode === 'excl' ? '#fff' : '#2E2C27',
                    border: '1px solid #D4D0C8',
                    borderRadius: '8px',
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
                    backgroundColor: editForm.price_entry_mode === 'incl' ? '#4A8A62' : '#F7F5F0',
                    color: editForm.price_entry_mode === 'incl' ? '#fff' : '#2E2C27',
                    border: '1px solid #D4D0C8',
                    borderRadius: '8px',
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
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#2E2C27' }}>
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
                    padding: '12px',
                    border: '1px solid #D4D0C8',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: '#F7F5F0',
                    color: '#2E2C27',
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
                    padding: '12px',
                    border: '1px solid #D4D0C8',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: '#F7F5F0',
                    color: '#2E2C27',
                  }}
                />
              )}
            </div>

            {/* Display Calculated Price */}
            <div style={{
              marginBottom: '20px',
              padding: '12px',
              backgroundColor: '#F7F5F0',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#666'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Excl. GST:</span>
                <span style={{ fontWeight: '600' }}>₹ {calculatePrices().excl.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span>Incl. GST (CGST {editForm.cgst_rate}% + SGST {editForm.sgst_rate}%):</span>
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
            <div style={{ 
              display: 'flex', 
              gap: '10px', 
              justifyContent: 'flex-end',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={closeEditModal}
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6B6860',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  flex: '1 1 auto',
                  minWidth: '100px'
                }}
              >
                Cancel
              </button>
              
              {/* Delete button - red color */}
              <button
                onClick={handleDeleteProduct}
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#B85C5C',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  flex: '1 1 auto',
                  minWidth: '100px'
                }}
              >
                Delete
              </button>
              
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  backgroundColor: saving ? '#7BAF8A' : '#4A8A62',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  flex: '1 1 auto',
                  minWidth: '100px'
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
          backgroundColor: 'rgba(46, 44, 39, 0.5)',
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
            <h2 style={{ marginBottom: '20px', color: '#2E2C27' }}>
              Generate Purchase Order
            </h2>

            {/* Actions Bar */}
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={selectAll}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#4A8A62',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Select All
              </button>
              <button
                onClick={selectLowStock}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#C4956A',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Select Low Stock ({'<'} 4)
              </button>
              <span style={{ marginLeft: 'auto', fontSize: '14px', color: '#6B6860' }}>
                Selected: {Object.values(poSelectedProducts).filter(Boolean).length} products
              </span>
            </div>

            {/* Column Toggles */}
            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px', display: 'flex', gap: '20px', alignItems: 'center' }}>
              <span style={{ fontWeight: '600', fontSize: '14px', color: '#333' }}>Show columns:</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                <input
                  type="checkbox"
                  checked={poColumns.current_stock}
                  onChange={(e) => setPoColumns({...poColumns, current_stock: e.target.checked})}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                Current Stock
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                <input
                  type="checkbox"
                  checked={poColumns.cost_price}
                  onChange={(e) => setPoColumns({...poColumns, cost_price: e.target.checked})}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                Cost Price
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                <input
                  type="checkbox"
                  checked={poColumns.quantity}
                  onChange={(e) => setPoColumns({...poColumns, quantity: e.target.checked})}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                Quantity
              </label>
            </div>

            {/* Products Table */}
            <div style={{ maxHeight: '50vh', overflow: 'auto', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f5f5f5' }}>
                    <th style={{ textAlign: 'left', padding: '10px', width: '40px' }}>Select</th>
                    <th style={{ textAlign: 'left', padding: '10px' }}>Product</th>
                    {poColumns.current_stock && <th style={{ textAlign: 'right', padding: '10px' }}>Current Stock</th>}
                    {poColumns.cost_price && <th style={{ textAlign: 'right', padding: '10px' }}>Cost Price</th>}
                    {poColumns.quantity && <th style={{ textAlign: 'center', padding: '10px', width: '120px' }}>Quantity</th>}
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
                        {poColumns.current_stock && (
                          <td style={{ padding: '10px', textAlign: 'right' }}>
                            {p.stock_qty || 0}
                          </td>
                        )}
                        {poColumns.cost_price && (
                          <td style={{ padding: '10px', textAlign: 'right' }}>
                            ₹{parseFloat(p.cost_price || 0).toFixed(2)}
                          </td>
                        )}
                        {poColumns.quantity && (
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
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                </table>
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
