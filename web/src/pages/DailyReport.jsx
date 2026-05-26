import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { BarChart, XAxis, YAxis, Bar, Tooltip } from 'recharts';

const API_BASE_URL = (import.meta.env.VITE_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const INVOICE_URL = (import.meta.env.VITE_INVOICE_URL || import.meta.env.VITE_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

export default function DailyReport() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [data, setData] = useState(null);
  const [allSales, setAllSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, [date, fromDate, toDate]);

  async function fetchReport() {
    setLoading(true);
    try {
      let url = '/reports/daily?';
      if (fromDate && toDate) {
        url += `from_date=${fromDate}&to_date=${toDate}`;
      } else {
        url += `date=${date}`;
      }
      const res = await api.get(url);
      setData(res.data);
      setAllSales(res.data.sales_details || []);
    } catch (err) {
      console.error('Report fetch error:', err);
    }
    setLoading(false);
  }

  // Filter sales based on vehicle search
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
      fetchReport(); // Refresh the report
    } catch (err) {
      console.error('Delete sale error:', err);
      alert('Failed to delete sale');
    }
  }

  function exportCSV() {
const headers = [
      'S.No',
      'Date',
      'Time',
      'Customer Name',
      'Phone',
      'Vehicle Reg',
      'Vehicle Type',
      'Items Bought',
      'Total'
    ];
    
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
    
    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');
    
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#6B6860' }}>Loading...</div>;

  return (
    <div>
      <Navbar />
      <div style={{ padding: '20px' }}>
        <h1 style={{ marginBottom: '20px', color: '#2E2C27' }}>Daily Report</h1>
        <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#E8E4DA', padding: '15px', borderRadius: '12px' }}>
          <div>
            <label style={{ marginRight: '8px', color: '#6B6860' }}>From: </label>
            <input type="date" value={fromDate || date} onChange={(e) => { setFromDate(e.target.value); setDate(''); }} style={{ padding: '8px 12px', border: '1px solid #D4D0C8', borderRadius: '8px', fontSize: '14px', backgroundColor: '#F7F5F0' }} />
          </div>
          <div>
            <label style={{ marginRight: '8px', color: '#6B6860' }}>To: </label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #D4D0C8', borderRadius: '8px', fontSize: '14px', backgroundColor: '#F7F5F0' }} />
          </div>
          <button 
            onClick={() => { setDate(new Date().toISOString().split('T')[0]); setFromDate(''); setToDate(''); }}
            style={{ padding: '8px 15px', backgroundColor: '#6B6860', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
          >
            Today
          </button>
          <button onClick={exportCSV} style={{ marginLeft: '20px', padding: '8px 15px', backgroundColor: '#4A8A62', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>Export CSV</button>
        </div>
        
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
                <td style={{ padding: '10px', color: '#2E2C27' }}>{s.vehicle_reg || '-'}</td>
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
