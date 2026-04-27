import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { BarChart, XAxis, YAxis, Bar, Tooltip } from 'recharts';

const API_BASE_URL = (import.meta.env.VITE_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

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
      'Invoice No',
      'Date',
      'Time',
      'Customer Name',
      'Phone',
      'Vehicle Reg',
      'Items Bought',
      'Total'
    ];
    
    const rows = filteredSales.map(s => [
      s.invoice_number || '',
      s.created_at ? new Date(s.created_at).toLocaleDateString('en-GB') : '',
      s.created_at ? new Date(s.created_at).toLocaleTimeString('en-IN') : '',
      s.customer_name || '',
      s.customer_phone || '',
      s.vehicle_reg || '-',
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

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <Navbar />
      <div style={{ padding: '20px' }}>
        <h1>Daily Report</h1>
        <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label>From: </label>
            <input type="date" value={fromDate || date} onChange={(e) => { setFromDate(e.target.value); setDate(''); }} />
          </div>
          <div>
            <label>To: </label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <button 
            onClick={() => { setDate(new Date().toISOString().split('T')[0]); setFromDate(''); setToDate(''); }}
            style={{ padding: '8px 15px', backgroundColor: '#666', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Today
          </button>
          <button onClick={exportCSV} style={{ marginLeft: '20px', padding: '8px 15px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Export CSV</button>
        </div>
        
        <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
          <div style={{ padding: '20px', backgroundColor: '#e8f5e9', borderRadius: '8px', flex: 1, minWidth: '200px' }}>
            <h3>Revenue</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>₹{data?.total_revenue?.toFixed(2) || 0}</p>
          </div>
          <div style={{ padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '8px', flex: 1, minWidth: '200px' }}>
            <h3>Profit</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>₹{data?.total_profit?.toFixed(2) || 0}</p>
          </div>
          <div style={{ padding: '20px', backgroundColor: '#fff3e0', borderRadius: '8px', flex: 1, minWidth: '200px' }}>
            <h3>Transactions</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{data?.total_transactions || 0}</p>
          </div>
          <div style={{ padding: '20px', backgroundColor: '#fce4ec', borderRadius: '8px', flex: 1, minWidth: '200px' }}>
            <h3>Profit (Incl GST)</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>₹{data?.profit_incl_gst?.toFixed(2) || 0}</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2>Sales Details</h2>
          <input
            type="text"
            placeholder="Search by vehicle number..."
            value={vehicleSearch}
            onChange={(e) => setVehicleSearch(e.target.value)}
            style={{ padding: '8px 15px', border: '1px solid #ddd', borderRadius: '4px', width: '250px' }}
          />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '10px' }}>Invoice</th>
              <th>Vehicle No.</th>
              <th>Items Bought</th>
              <th>Total</th>
              <th>Time</th>
              <th>Action</th>
              {isOwner && <th>Delete</th>}
            </tr>
          </thead>
          <tbody>
            {filteredSales.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>{s.invoice_number}</td>
                <td>{s.vehicle_reg || '-'}</td>
                <td>{s.items_bought || '-'}</td>
                <td>₹{s.total?.toFixed(2)}</td>
                <td>{new Date(s.created_at).toLocaleString()}</td>
                <td>
                  <a href={`/invoice/${s.invoice_number}`} onClick={(e) => { e.preventDefault(); window.open(`${API_BASE_URL}/invoice/${s.invoice_number}`, '_blank'); }} style={{ color: '#2196F3', textDecoration: 'none', cursor: 'pointer' }}>View Invoice</a>
                </td>
                {isOwner && (
                  <td>
                    <button 
                      onClick={() => deleteSale(s.id)}
                      style={{
                        backgroundColor: '#f44336',
                        color: '#fff',
                        border: 'none',
                        padding: '5px 10px',
                        borderRadius: '4px',
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
