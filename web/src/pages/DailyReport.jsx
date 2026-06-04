import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const INVOICE_URL = (import.meta.env.VITE_INVOICE_URL || import.meta.env.VITE_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

function formatDateInput(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDaysDiff(from, to) {
  if (!from || !to) return 0;
  const a = new Date(from);
  const b = new Date(to);
  const diff = Math.floor((b - a) / (1000 * 60 * 60 * 24)) + 1;
  return diff;
}

export default function DailyReport() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const [activeChip, setActiveChip] = useState('today');
  const [fromDate, setFromDate] = useState(formatDateInput(new Date()));
  const [toDate, setToDate] = useState(formatDateInput(new Date()));
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [data, setData] = useState(null);
  const [allSales, setAllSales] = useState([]);
  const [loading, setLoading] = useState(true);

  function applyPreset(chip) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let from = new Date(today);
    let to = new Date(today);

    switch (chip) {
      case 'today':
        break;
      case 'yesterday':
        from.setDate(from.getDate() - 1);
        to.setDate(to.getDate() - 1);
        break;
      case 'last7':
        from.setDate(from.getDate() - 6);
        break;
      case 'thisMonth':
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'lastMonth': {
        const firstOfThis = new Date(today.getFullYear(), today.getMonth(), 1);
        from = new Date(firstOfThis);
        from.setMonth(from.getMonth() - 1);
        to = new Date(firstOfThis);
        to.setDate(to.getDate() - 1);
        break;
      }
      default:
        return;
    }
    setFromDate(formatDateInput(from));
    setToDate(formatDateInput(to));
  }

  function handleChipClick(chip) {
    setActiveChip(chip);
    if (chip !== 'custom') {
      applyPreset(chip);
    }
  }

  useEffect(() => {
    fetchReport();
  }, [fromDate, toDate]);

  async function fetchReport() {
    setLoading(true);
    try {
      const url = `/reports/daily?from_date=${fromDate}&to_date=${toDate}`;
      const res = await api.get(url);
      setData(res.data);
      setAllSales(res.data.sales_details || []);
    } catch (err) {
      console.error('Report fetch error:', err);
    }
    setLoading(false);
  }

  const filteredSales = vehicleSearch
    ? allSales.filter(s => s.vehicle_reg?.toLowerCase().includes(vehicleSearch.toLowerCase()))
    : allSales;

  async function deleteSale(saleId) {
    if (!confirm('Are you sure you want to delete this sale? This will restore the stock.')) {
      return;
    }
    try {
      await api.delete(`/sales/${saleId}`);
      alert('Sale deleted and stock restored');
      fetchReport();
    } catch (err) {
      console.error('Delete sale error:', err);
      alert('Failed to delete sale');
    }
  }

  function exportCSV() {
    const headers = ['S.No', 'Date', 'Time', 'Customer Name', 'Phone', 'Vehicle Reg', 'Vehicle Type', 'Items Bought', 'Total'];
    const rows = filteredSales.map((s, index) => [
      index + 1,
      s.created_at ? new Date(s.created_at).toLocaleDateString('en-GB') : '',
      s.created_at ? new Date(s.created_at).toLocaleTimeString('en-IN') : '',
      s.customer_name || '',
      s.customer_phone || '',
      s.vehicle_reg || '-',
      s.vehicle_type || '-',
      s.items_bought || '-',
      (s.total || 0).toFixed(2)
    ]);

    const escapeCSV = (val) => {
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [headers.map(escapeCSV).join(','), ...rows.map(row => row.map(escapeCSV).join(','))].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${fromDate}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const chips = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'last7', label: 'Last 7 days' },
    { key: 'thisMonth', label: 'This month' },
    { key: 'lastMonth', label: 'Last month' },
    { key: 'custom', label: 'Custom' }
  ];

  const isCustom = activeChip === 'custom';
  const daysCount = getDaysDiff(fromDate, toDate);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#6B6860' }}>Loading...</div>;

  return (
    <div>
      <Navbar />
      <div style={{ padding: '20px' }}>
        <h1 style={{ marginBottom: '20px', color: '#2E2C27' }}>Daily Report</h1>

        {/* Date Filter Bar */}
        <div style={{
          marginBottom: '20px',
          backgroundColor: '#E8E4DA',
          padding: '15px',
          borderRadius: '12px'
        }}>
          {/* Chip Buttons */}
          <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '15px'
          }}>
            {chips.map(chip => {
              const isActive = activeChip === chip.key;
              return (
                <button
                  key={chip.key}
                  onClick={() => handleChipClick(chip.key)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    backgroundColor: isActive ? '#4A8A62' : '#F7F5F0',
                    color: isActive ? '#fff' : '#2E2C27',
                    border: isActive ? 'none' : '1px solid #D4D0C8',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {/* Date Inputs */}
          <div style={{
            display: 'flex',
            gap: '15px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#6B6860'
              }}>From</label>
              <input
                type="date"
                value={fromDate}
                readOnly={!isCustom}
                onChange={(e) => setFromDate(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #D4D0C8',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: isCustom ? '#F7F5F0' : '#E8E4DA',
                  color: '#2E2C27',
                  cursor: isCustom ? 'text' : 'default'
                }}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#6B6860'
              }}>To</label>
              <input
                type="date"
                value={toDate}
                readOnly={!isCustom}
                onChange={(e) => setToDate(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #D4D0C8',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: isCustom ? '#F7F5F0' : '#E8E4DA',
                  color: '#2E2C27',
                  cursor: isCustom ? 'text' : 'default'
                }}
              />
            </div>
            <button
              onClick={exportCSV}
              style={{
                padding: '8px 16px',
                backgroundColor: '#4A8A62',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                marginLeft: 'auto'
              }}
            >
              Export CSV
            </button>
          </div>

          {/* Helper Line */}
          <div style={{
            marginTop: '10px',
            fontSize: '13px',
            color: '#6B6860'
          }}>
            {daysCount} {daysCount === 1 ? 'day' : 'days'} selected
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
          <div style={{ padding: '20px', backgroundColor: '#E8E4DA', borderRadius: '12px', flex: 1, minWidth: '200px' }}>
            <h3 style={{ color: '#2E2C27', marginBottom: '5px' }}>Revenue</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#4A8A62' }}>₹{data?.total_revenue?.toFixed(2) || 0}</p>
          </div>
          <div style={{ padding: '20px', backgroundColor: '#E8E4DA', borderRadius: '12px', flex: 1, minWidth: '200px' }}>
            <h3 style={{ color: '#2E2C27', marginBottom: '5px' }}>Profit</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#7BAF8A' }}>₹{data?.total_profit?.toFixed(2) || 0}</p>
          </div>
          <div style={{ padding: '20px', backgroundColor: '#E8E4DA', borderRadius: '12px', flex: 1, minWidth: '200px' }}>
            <h3 style={{ color: '#2E2C27', marginBottom: '5px' }}>Transactions</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#C4956A' }}>{data?.total_transactions || 0}</p>
          </div>
          <div style={{ padding: '20px', backgroundColor: '#E8E4DA', borderRadius: '12px', flex: 1, minWidth: '200px' }}>
            <h3 style={{ color: '#2E2C27', marginBottom: '5px' }}>Profit (Incl GST)</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#4A8A62' }}>₹{data?.profit_incl_gst?.toFixed(2) || 0}</p>
          </div>
        </div>

        {/* Sales Table */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ color: '#2E2C27' }}>Sales Details</h2>
          <input
            type="text"
            placeholder="Search by vehicle number..."
            value={vehicleSearch}
            onChange={(e) => setVehicleSearch(e.target.value)}
            style={{ padding: '10px 15px', border: '1px solid #D4D0C8', borderRadius: '8px', width: '250px', fontSize: '14px', backgroundColor: '#F7F5F0' }}
          />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#E8E4DA', borderRadius: '12px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ backgroundColor: '#7BAF8A', color: 'white' }}>
              <th style={{ textAlign: 'left', padding: '12px', borderBottom: '2px solid #7BAF8A' }}>S.No</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #7BAF8A' }}>Vehicle No.</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #7BAF8A' }}>Vehicle Type</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #7BAF8A' }}>Items Bought</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #7BAF8A' }}>Total</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #7BAF8A' }}>Time</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #7BAF8A' }}>Action</th>
              {isOwner && <th style={{ padding: '12px', borderBottom: '2px solid #7BAF8A' }}>Delete</th>}
            </tr>
          </thead>
          <tbody>
            {filteredSales.map((s, index) => (
              <tr key={s.id} style={{ borderBottom: '1px solid #D4D0C8', backgroundColor: '#F7F5F0' }}>
                <td style={{ padding: '10px', color: '#2E2C27' }}>{index + 1}</td>
                <td style={{ padding: '10px', color: '#2E2C27', textTransform: 'uppercase' }}>{s.vehicle_reg || '-'}</td>
                <td style={{ padding: '10px', color: '#2E2C27' }}>{s.vehicle_type || '-'}</td>
                <td style={{ padding: '10px', color: '#2E2C27' }}>{s.items_bought || '-'}</td>
                <td style={{ padding: '10px', color: '#2E2C27', fontWeight: '500' }}>₹{s.total?.toFixed(2)}</td>
                <td style={{ padding: '10px', color: '#6B6860' }}>{new Date(s.created_at).toLocaleString()}</td>
                <td>
                  <a href={`/invoice/${s.invoice_number}`} onClick={(e) => { e.preventDefault(); window.open(`${INVOICE_URL}/api/invoice/${s.invoice_number}`, '_blank'); }} style={{ color: '#4A8A62', textDecoration: 'none', cursor: 'pointer', fontWeight: '500' }}>View Invoice</a>
                </td>
                {isOwner && (
                  <td>
                    <button
                      onClick={() => deleteSale(s.id)}
                      style={{
                        backgroundColor: '#B85C5C',
                        color: '#fff',
                        border: 'none',
                        padding: '5px 10px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
