import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StatCard from '../components/StatCard';

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState(null);
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      const dailyRes = await api.get('/reports/daily');
      setDailyData(dailyRes.data);
      
      const productsRes = await api.get('/products?low_stock=true');
      setLowStockCount(productsRes.data.length);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
    setLoading(false);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  const isOwner = user?.role === 'owner';
  const isManager = user?.role === 'manager';
  const isCashier = user?.role === 'cashier';

  const chartData = {
    labels: dailyData?.hourly_sales.map(h => `${h.hour}:00`) || [],
    datasets: [{
      data: dailyData?.hourly_sales.map(h => h.total) || [],
    }],
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Dashboard</Text>
      <Text style={styles.subHeader}>Welcome, {user?.name}</Text>

      <View style={styles.statsRow}>
        <StatCard
          label="Today's Revenue"
          value={`₹${dailyData?.total_revenue || 0}`}
          color="#4CAF50"
        />
        {isManager || isOwner ? (
          <StatCard
            label="Today's Profit"
            value={`₹${dailyData?.total_profit || 0}`}
            color="#2196F3"
          />
        ) : null}
      </View>

      {isCashier ? (
        <View style={styles.cashierCard}>
          <Text style={styles.cashierStat}>Your Transactions Today</Text>
          <Text style={styles.cashierValue}>{dailyData?.total_transactions || 0}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Today's sales by hour</Text>
          {dailyData?.hourly_sales?.length > 0 ? (
            <BarChart
              data={chartData}
              width={Dimensions.get('window').width - 40}
              height={220}
              yAxisSuffix="₹"
              chartConfig={{
                backgroundColor: '#fff',
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                style: { borderRadius: 16 },
                propsForDots: { r: '6', strokeWidth: '2', stroke: '#2196F3' },
              }}
              style={styles.chart}
            />
          ) : (
            <View style={styles.noData}><Text>No sales data today</Text></View>
          )}
        </>
      )}

      {lowStockCount > 0 && (
        <TouchableOpacity
          style={styles.alertBanner}
          onPress={() => navigation.navigate('Inventory', { low_stock: true })}
        >
          <Text style={styles.alertText}>
            ⚠️ {lowStockCount} product{lowStockCount > 1 ? 's' : ''} low on stock — tap to view
          </Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={[styles.quickButton, styles.primaryButton]}
          onPress={() => navigation.navigate('New Sale')}
        >
          <Text style={styles.quickButtonText}>New Sale</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickButton}
          onPress={() => navigation.navigate('Inventory')}
        >
          <Text style={styles.quickButtonText}>View Inventory</Text>
        </TouchableOpacity>
      </View>
      {isManager || isOwner ? (
        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[styles.quickButton, styles.addButton]}
            onPress={() => navigation.navigate('AddProduct')}
          >
            <Text style={styles.quickButtonText}>+ Add Product</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {isOwner ? (
        <TouchableOpacity
          style={styles.quickButton}
          onPress={() => navigation.navigate('Reports')}
        >
          <Text style={styles.quickButtonText}>Reports</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 24, fontWeight: 'bold', padding: 20, paddingBottom: 5 },
  subHeader: { fontSize: 14, color: '#666', paddingHorizontal: 20, paddingBottom: 15 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginHorizontal: 20, marginBottom: 10 },
  chart: { marginHorizontal: 20, borderRadius: 16, marginBottom: 20 },
  noData: { marginHorizontal: 20, padding: 20, backgroundColor: '#fff', borderRadius: 8, alignItems: 'center' },
  alertBanner: { marginHorizontal: 20, padding: 15, backgroundColor: '#ffebee', borderRadius: 8, marginBottom: 20 },
  alertText: { color: '#c62828', fontWeight: '600' },
  cashierCard: { marginHorizontal: 20, padding: 20, backgroundColor: '#e3f2fd', borderRadius: 8, marginBottom: 20, alignItems: 'center' },
  cashierStat: { fontSize: 14, color: '#1565c0' },
  cashierValue: { fontSize: 32, fontWeight: 'bold', color: '#1565c0', marginTop: 5 },
  buttonsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  quickButton: { backgroundColor: '#2196F3', padding: 15, borderRadius: 8, margin: 5, minWidth: 140, alignItems: 'center' },
  primaryButton: { backgroundColor: '#6c63ff' },
  addButton: { backgroundColor: '#e53935' },
  quickButtonText: { color: '#fff', fontWeight: '600' },
});
