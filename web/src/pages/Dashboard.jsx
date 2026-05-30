import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import api from '../services/api';
import { BarChart, XAxis, YAxis, Bar, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Line, Legend } from 'recharts';

export default function Dashboard() {
  const { user } = useAuth();
  const [dailyData, setDailyData] = useState(null);
  const [weeklyData, setWeeklyData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [error, setError] = useState(null);
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
      
      const monthlyRes = await api.get('/reports/monthly');
      setMonthlyData(monthlyRes.data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load dashboard data. Please try again later.');
    }
    setLoading(false);
  }

  const isOwner = user?.role === 'owner';
  const isManager = user?.role === 'manager';

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#6B6860' }}>Loading...</div>;
  if (error) return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <p style={{ color: '#B85C5C', fontSize: '18px', marginBottom: '20px' }}>{error}</p>
      <button 
        onClick={() => { setError(null); setLoading(true); fetchDashboardData(); }}
        style={{
          padding: '10px 20px',
          backgroundColor: '#4A8A62',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        Retry
      </button>
    </div>
  );

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

        <h2 style={{ color: '#2E2C27', marginBottom: '15px' }}>Last 30 Days Tyres Sales</h2>
        
        {/* 30-Day Summary Cards */}
        {monthlyData && monthlyData.length > 0 && (
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ padding: '20px', backgroundColor: '#E8E4DA', borderRadius: '12px', flex: 1, minWidth: '180px' }}>
              <h3 style={{ color: '#2E2C27', marginBottom: '5px' }}>Total Tyres Sold</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#C4956A' }}>
                {monthlyData.reduce((sum, d) => sum + (d.qty || 0), 0).toLocaleString()}
              </p>
            </div>
            <div style={{ padding: '20px', backgroundColor: '#E8E4DA', borderRadius: '12px', flex: 1, minWidth: '180px' }}>
              <h3 style={{ color: '#2E2C27', marginBottom: '5px' }}>Total Revenue</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#4A8A62' }}>
                ₹{monthlyData.reduce((sum, d) => sum + (d.revenue || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
        )}
        
        {monthlyData && monthlyData.length > 0 && (
          <div style={{ width: '100%', height: '400px', backgroundColor: '#E8E4DA', padding: '20px', borderRadius: '12px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D4D0C8" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => {
                    const d = new Date(date);
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }}
                  angle={-45}
                  textAnchor="end"
                  interval={2}
                  height={60}
                  tick={{ fill: '#2E2C27', fontSize: 12 }}
                  axisLine={{ stroke: '#6B6860' }}
                  tickLine={{ stroke: '#6B6860' }}
                />
                <YAxis 
                  yAxisId="left"
                  tick={{ fill: '#2E2C27', fontSize: 13 }}
                  axisLine={{ stroke: '#6B6860' }}
                  tickLine={{ stroke: '#6B6860' }}
                  tickFormatter={(value) => `₹${value.toLocaleString()}`}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: '#2E2C27', fontSize: 13 }}
                  axisLine={{ stroke: '#6B6860' }}
                  tickLine={{ stroke: '#6B6860' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#F7F5F0', 
                    border: '1px solid #D4D0C8', 
                    borderRadius: '8px',
                    color: '#2E2C27'
                  }}
                  labelFormatter={(date) => {
                    const d = new Date(date);
                    return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" name="Revenue (₹)" fill="#7BAF8A" radius={[6, 6, 0, 0]} />
                <Bar yAxisId="right" dataKey="qty" name="Tyres Sold" fill="#C4956A" radius={[6, 6, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        {(!monthlyData || monthlyData.length === 0) && (
          <p style={{ color: '#6B6860', textAlign: 'center', padding: '20px' }}>No tyre sales data for the last 30 days</p>
        )}
      </div>
    </div>
  );
}
