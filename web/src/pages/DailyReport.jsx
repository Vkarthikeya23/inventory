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
  const [data, setData] = useState(null);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, [date]);

  async function fetchReport() {
    try {
      const res = await api.get(`/reports/daily?date=${date}`);
      setData(res.data);
      setSales(res.data.sales_details || []);
    } catch (err) {
      console.error('Report fetch error:', err);
    }
    setLoading(false);
  }

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
    const headers = ['Invoice', 'Customer', 'Items', 'Total', 'Date'];
    const rows = sales.map(s => [s.invoice_number, s.customer_name, '-', s.total, s.created_at]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-report-${date}.csv`;
    a.click();
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <Navbar />
      <div style={{ padding: '20px' }}>
        <h1>Daily Report</h1>
        <div style={{ marginBottom: '20px' }}>
          <label>Date: </label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button onClick={exportCSV} style={{ marginLeft: '20px', padding: '8px 15px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Export CSV</button>
        </div>
        
        <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
          <div style={{ padding: '20px', backgroundColor: '#e8f5e9', borderRadius: '8px', flex: 1 }}>
            <h3>Revenue</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>₹{data?.total_revenue || 0}</p>
          </div>
          <div style={{ padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '8px', flex: 1 }}>
            <h3>Profit</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>₹{data?.total_profit || 0}</p>
          </div>
          <div style={{ padding: '20px', backgroundColor: '#fff3e0', borderRadius: '8px', flex: 1 }}>
            <h3>Transactions</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{data?.total_transactions || 0}</p>
          </div>
        </div>

        <h2>Hourly Sales</h2>
        {data?.hourly_sales?.length > 0 ? (
          <BarChart width={800} height={300} data={data.hourly_sales}>
            <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="total" fill="#2196F3" name="Revenue (₹)" />
          </BarChart>
        ) : <p>No sales data for this date.</p>}

        <h2>Sales Details</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '10px' }}>Invoice</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Time</th>
              <th>Action</th>
              {isOwner && <th>Delete</th>}
            </tr>
          </thead>
          <tbody>
            {sales.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>{s.invoice_number}</td>
                <td>{s.customer_name}</td>
                <td>₹{s.total}</td>
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
