import React, { useState, useEffect } from 'react';
import { View, TextInput, FlatList, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StockBadge from '../components/StockBadge';

export default function InventoryScreen({ route, navigation }) {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const lowStockFilter = route.params?.low_stock;
  const refresh = route.params?.refresh;
  const isOwner = user?.role === 'owner';
  const isManager = user?.role === 'manager';
  const canEdit = isOwner || isManager;

  useEffect(() => {
    fetchProducts();
  }, [lowStockFilter, refresh]);

  async function fetchProducts() {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (lowStockFilter) params.low_stock = 'true';
      
      const res = await api.get('/products', { params });
      setProducts(res.data);
    } catch (err) {
      console.error('Fetch products error:', err);
    }
    setLoading(false);
  }

  function getDisplayName(product) {
    return `${product.company_name} ${product.size_spec}`;
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Header with Add Product button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventory</Text>
        {(isOwner || isManager) && (
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => navigation.navigate('AddProduct')}
          >
            <Text style={styles.addButtonText}>+ Add Product</Text>
          </TouchableOpacity>
        )}
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search products..."
        value={search}
        onChangeText={(text) => {
          setSearch(text);
          fetchProducts();
        }}
      />
      
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.name}>{getDisplayName(item)}</Text>
              <StockBadge stockQty={item.stock_qty} threshold={item.low_stock_threshold || 5} />
            </View>
            <Text style={styles.detail}>Company: {item.company_name}</Text>
            <Text style={styles.detail}>Size/Spec: {item.size_spec}</Text>
            <Text style={styles.detail}>Price: ₹{item.selling_price_incl_gst} (Incl. GST)</Text>
            <Text style={styles.detail}>Cost: ₹{item.cost_price || 'N/A'}</Text>
            <Text style={styles.detail}>Stock: {item.stock_qty} units</Text>
            
            {canEdit && (
              <TouchableOpacity 
                style={styles.updateButton}
                onPress={() => navigation.navigate('UpdateProduct', { product: item })}
              >
                <Text style={styles.updateButtonText}>Update</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    padding: 15,
    paddingTop: 50,
    backgroundColor: '#6c63ff',
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#fff' 
  },
  addButton: { 
    backgroundColor: '#e53935', 
    paddingHorizontal: 15, 
    paddingVertical: 8, 
    borderRadius: 6 
  },
  addButtonText: { 
    color: '#fff', 
    fontWeight: '600',
    fontSize: 14,
  },
  searchInput: { 
    margin: 15, 
    padding: 12, 
    backgroundColor: '#fff', 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#ddd' 
  },
  card: { 
    backgroundColor: '#fff', 
    marginHorizontal: 15, 
    marginVertical: 8, 
    padding: 15, 
    borderRadius: 8, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 3 
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  name: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    flex: 1 
  },
  detail: { 
    fontSize: 13, 
    color: '#666', 
    marginBottom: 3 
  },
  updateButton: {
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  updateButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
