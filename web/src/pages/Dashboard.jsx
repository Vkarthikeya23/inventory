import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import api from '../services/api';
import { BarChart, XAxis, YAxis, Bar, Tooltip } from 'recharts';

export default function Dashboard() {
  const { user } = useAuth();
  const [dailyData, setDailyData] = useState(null);
  const [weeklyData, setWeeklyData] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      const dailyRes = await api.get('/reports/daily');
      setDailyData(dailyRes.data);
      
      const weeklyRes = await api.get('/reports/weekly');
      setWeeklyData(weeklyRes.data);
      
      const productsRes = await api.get('/products?low_stock=true');
      setLowStock(productsRes.data.slice(0, 5));
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
    setLoading(false);
  }

  const isOwner = user?.role === 'owner';
  const isManager = user?.role === 'manager';

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <Navbar />
      <div style={{ padding: '20px' }}>
        <h1>Dashboard</h1>
        <p>Welcome, {user?.name}</p>
        
        <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
          <div style={{ padding: '20px', backgroundColor: '#e8f5e9', borderRadius: '8px', flex: 1 }}>
            <h3>Today's Revenue</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>₹{dailyData?.total_revenue || 0}</p>
          </div>
          {isManager || isOwner ? (
            <div style={{ padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '8px', flex: 1 }}>
              <h3>Today's Profit</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold' }}>₹{dailyData?.total_profit || 0}</p>
            </div>
          ) : null}
          <div style={{ padding: '20px', backgroundColor: '#fff3e0', borderRadius: '8px', flex: 1 }}>
            <h3>Transactions</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{dailyData?.total_transactions || 0}</p>
          </div>
          <div style={{ padding: '20px', backgroundColor: '#fce4ec', borderRadius: '8px', flex: 1 }}>
            <h3>Units Sold</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{dailyData?.units_sold || 0}</p>
          </div>
        </div>

        <h2>Last 7 Days Revenue</h2>
        {weeklyData && (
          <BarChart width={800} height={300} data={weeklyData}>
            <XAxis dataKey="date" />
            <YAxis />
            <Bar dataKey="revenue" fill="#2196F3" />
          </BarChart>
        )}

        <h2>Low Stock Products</h2>
        {lowStock.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd' }}>
                <th style={{ textAlign: 'left', padding: '10px' }}>Product</th>
                <th>Stock</th>
                <th>Threshold</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{p.name}</td>
                  <td>{p.stock_qty}</td>
                  <td>{p.low_stock_threshold}</td>
                  <td style={{ color: p.stock_qty <= p.low_stock_threshold ? '#f44336' : '#4caf50' }}>
                    {p.stock_qty <= p.low_stock_threshold ? 'Low Stock' : 'OK'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p>All products are well stocked.</p>}
      </div>
    </div>
  );
}
