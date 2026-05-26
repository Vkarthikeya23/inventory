import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import api from '../services/api';
import { BarChart, XAxis, YAxis, Bar, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

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

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#6B6860' }}>Loading...</div>;

  return (
    <div style={{ backgroundColor: '#F7F5F0', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ color: '#2E2C27', marginBottom: '10px' }}>Dashboard</h1>
        <p style={{ color: '#6B6860', marginBottom: '25px' }}>Welcome, {user?.name}</p>
        
        <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
          <div style={{ padding: '20px', backgroundColor: '#E8E4DA', borderRadius: '12px', flex: 1, minWidth: '180px' }}>
            <h3 style={{ color: '#2E2C27', marginBottom: '5px' }}>Today's Revenue</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#4A8A62' }}>₹{(dailyData?.total_revenue || 0).toLocaleString()}</p>
          </div>
          {isManager || isOwner ? (
            <div style={{ padding: '20px', backgroundColor: '#E8E4DA', borderRadius: '12px', flex: 1, minWidth: '180px' }}>
              <h3 style={{ color: '#2E2C27', marginBottom: '5px' }}>Today's Profit</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#7BAF8A' }}>₹{(dailyData?.total_profit || 0).toLocaleString()}</p>
            </div>
          ) : null}
          <div style={{ padding: '20px', backgroundColor: '#E8E4DA', borderRadius: '12px', flex: 1, minWidth: '180px' }}>
            <h3 style={{ color: '#2E2C27', marginBottom: '5px' }}>Transactions</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#C4956A' }}>{dailyData?.total_transactions || 0}</p>
          </div>
          <div style={{ padding: '20px', backgroundColor: '#E8E4DA', borderRadius: '12px', flex: 1, minWidth: '180px' }}>
            <h3 style={{ color: '#2E2C27', marginBottom: '5px' }}>Units Sold</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#4A8A62' }}>{dailyData?.units_sold || 0}</p>
          </div>
        </div>

        <h2 style={{ color: '#2E2C27', marginBottom: '15px' }}>Last 7 Days Revenue</h2>
        {weeklyData && (
          <div style={{ width: '100%', height: '350px', backgroundColor: '#E8E4DA', padding: '20px', borderRadius: '12px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D4D0C8" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => {
                    const d = new Date(date);
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                  height={60}
                  tick={{ fill: '#2E2C27', fontSize: 13 }}
                  axisLine={{ stroke: '#6B6860' }}
                  tickLine={{ stroke: '#6B6860' }}
                />
                <YAxis 
                  tick={{ fill: '#2E2C27', fontSize: 13 }}
                  axisLine={{ stroke: '#6B6860' }}
                  tickLine={{ stroke: '#6B6860' }}
                  tickFormatter={(value) => `₹${value.toLocaleString()}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#F7F5F0', 
                    border: '1px solid #D4D0C8', 
                    borderRadius: '8px',
                    color: '#2E2C27'
                  }}
                  formatter={(value) => [`₹${value.toLocaleString()}`, 'Revenue']}
                  labelFormatter={(date) => {
                    const d = new Date(date);
                    return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
                  }}
                />
                <Bar dataKey="revenue" fill="#7BAF8A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <h2 style={{ color: '#2E2C27', marginBottom: '15px' }}>Low Stock Products</h2>
        {lowStock.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#E8E4DA', borderRadius: '12px', overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: '#7BAF8A', color: 'white' }}>
                <th style={{ textAlign: 'left', padding: '12px' }}>Product</th>
                <th style={{ padding: '12px' }}>Stock</th>
                <th style={{ padding: '12px' }}>Threshold</th>
                <th style={{ padding: '12px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #D4D0C8', backgroundColor: '#F7F5F0' }}>
                  <td style={{ padding: '10px', color: '#2E2C27' }}>{p.name}</td>
                  <td style={{ padding: '10px', color: '#2E2C27' }}>{p.stock_qty}</td>
                  <td style={{ padding: '10px', color: '#2E2C27' }}>{p.low_stock_threshold}</td>
                  <td style={{ padding: '10px', color: p.stock_qty <= p.low_stock_threshold ? '#B85C5C' : '#4A8A62', fontWeight: '600' }}>
                    {p.stock_qty <= p.low_stock_threshold ? 'Low Stock' : 'OK'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p style={{ color: '#6B6860' }}>All products are well stocked.</p>}
      </div>
    </div>
  );
}
