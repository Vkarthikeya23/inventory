import React, { useState, useEffect } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch } from 'react-native';
import api from '../services/api';

export default function AddProductScreen({ navigation }) {
  const [product, setProduct] = useState({
    company_name: '',
    size_spec: '',
    stock_qty: '',
    cost_price: '',
    price_entry_mode: 'excl', // 'excl' or 'incl'
    selling_price_excl_gst: '',
    selling_price_incl_gst: '',
    gst_rate: '12',
  });

  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  // Calculate display name and prices whenever inputs change
  useEffect(() => {
    const name = product.company_name && product.size_spec 
      ? `${product.company_name} ${product.size_spec}`
      : '';
    setDisplayName(name);

    // Calculate other price field based on mode
    const price = parseFloat(product.price_entry_mode === 'excl' 
      ? product.selling_price_excl_gst 
      : product.selling_price_incl_gst);

    if (!isNaN(price) && price >= 0) {
      const gstMultiplier = 1 + (parseFloat(product.gst_rate) / 100);
      if (product.price_entry_mode === 'excl') {
        const inclPrice = (price * gstMultiplier).toFixed(2);
        setProduct(prev => ({ ...prev, selling_price_incl_gst: inclPrice }));
      } else {
        const exclPrice = (price / gstMultiplier).toFixed(2);
        setProduct(prev => ({ ...prev, selling_price_excl_gst: exclPrice }));
      }
    }
  }, [product.company_name, product.size_spec, product.selling_price_excl_gst, product.selling_price_incl_gst, product.price_entry_mode]);

  function handlePriceChange(value, mode) {
    const price = parseFloat(value);
    if (isNaN(price) && value !== '') return;

    const gstRate = parseFloat(product.gst_rate) / 100;
    
    if (mode === 'excl') {
      setProduct(prev => ({
        ...prev,
        selling_price_excl_gst: value,
        selling_price_incl_gst: !isNaN(price) ? (price * (1 + gstRate)).toFixed(2) : ''
      }));
    } else {
      setProduct(prev => ({
        ...prev,
        selling_price_incl_gst: value,
        selling_price_excl_gst: !isNaN(price) ? (price / (1 + gstRate)).toFixed(2) : ''
      }));
    }
  }

  async function handleSubmit() {
    if (!product.company_name || !product.size_spec) {
      Alert.alert('Error', 'Company name and size/spec are required');
      return;
    }

    if (!product.selling_price_excl_gst || !product.selling_price_incl_gst) {
      Alert.alert('Error', 'Selling price is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        company_name: product.company_name,
        size_spec: product.size_spec,
        stock_qty: parseInt(product.stock_qty) || 0,
        cost_price: parseFloat(product.cost_price) || 0,
        selling_price_excl_gst: parseFloat(product.selling_price_excl_gst),
        selling_price_incl_gst: parseFloat(product.selling_price_incl_gst),
        gst_rate: parseFloat(product.gst_rate),
        price_entry_mode: product.price_entry_mode,
      };

      await api.post('/products', payload);
      Alert.alert('Success', 'Product added successfully', [
        { text: 'Add Another', onPress: () => resetForm() },
        { text: 'Go to Inventory', onPress: () => navigation.navigate('Inventory') }
      ]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to add product');
    }
    setSaving(false);
  }

  function resetForm() {
    setProduct({
      company_name: '',
      size_spec: '',
      stock_qty: '',
      cost_price: '',
      price_entry_mode: 'excl',
      selling_price_excl_gst: '',
      selling_price_incl_gst: '',
      gst_rate: '12',
    });
    setDisplayName('');
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Add Product</Text>
      </View>

      {/* Live Preview */}
      {displayName ? (
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>Preview</Text>
          <Text style={styles.previewName}>{displayName}</Text>
          <Text style={styles.previewPrice}>
            ₹{product.selling_price_incl_gst} (Incl. GST @ {product.gst_rate}%)
          </Text>
        </View>
      ) : null}

      <View style={styles.form}>
        <Text style={styles.sectionTitle}>Product Details</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Company Name *"
          value={product.company_name}
          onChangeText={t => setProduct({ ...product, company_name: t })}
        />
        
        <TextInput
          style={styles.input}
          placeholder="Size / Specification *"
          value={product.size_spec}
          onChangeText={t => setProduct({ ...product, size_spec: t })}
        />
        
        <TextInput
          style={styles.input}
          placeholder="Stock Quantity"
          value={product.stock_qty}
          onChangeText={t => setProduct({ ...product, stock_qty: t })}
          keyboardType="numeric"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Cost Price (₹)"
          value={product.cost_price}
          onChangeText={t => setProduct({ ...product, cost_price: t })}
          keyboardType="decimal-pad"
        />

        <Text style={styles.sectionTitle}>Pricing</Text>
        
        {/* Price Entry Mode Toggle */}
        <View style={styles.toggleContainer}>
          <Text style={styles.toggleLabel}>Price Entry Mode:</Text>
          <View style={styles.toggleButtons}>
            <TouchableOpacity
              style={[styles.toggleButton, product.price_entry_mode === 'excl' && styles.toggleButtonActive]}
              onPress={() => setProduct({ ...product, price_entry_mode: 'excl' })}
            >
              <Text style={[styles.toggleText, product.price_entry_mode === 'excl' && styles.toggleTextActive]}>
                Excl. GST
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, product.price_entry_mode === 'incl' && styles.toggleButtonActive]}
              onPress={() => setProduct({ ...product, price_entry_mode: 'incl' })}
            >
              <Text style={[styles.toggleText, product.price_entry_mode === 'incl' && styles.toggleTextActive]}>
                Incl. GST
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* GST Rate */}
        <TextInput
          style={styles.input}
          placeholder="GST Rate (%)"
          value={product.gst_rate}
          onChangeText={t => setProduct({ ...product, gst_rate: t })}
          keyboardType="numeric"
        />

        {/* Selling Price - based on mode */}
        {product.price_entry_mode === 'excl' ? (
          <TextInput
            style={styles.input}
            placeholder="Selling Price (Excl. GST) *"
            value={product.selling_price_excl_gst}
            onChangeText={t => handlePriceChange(t, 'excl')}
            keyboardType="decimal-pad"
          />
        ) : (
          <TextInput
            style={styles.input}
            placeholder="Selling Price (Incl. GST) *"
            value={product.selling_price_incl_gst}
            onChangeText={t => handlePriceChange(t, 'incl')}
            keyboardType="decimal-pad"
          />
        )}

        {/* Display calculated price */}
        <View style={styles.calculatedPrice}>
          <Text style={styles.calculatedLabel}>
            {product.price_entry_mode === 'excl' ? 'Price Incl. GST:' : 'Price Excl. GST:'}
          </Text>
          <Text style={styles.calculatedValue}>
            ₹{product.price_entry_mode === 'excl' ? product.selling_price_incl_gst : product.selling_price_excl_gst}
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.submitButton, saving && styles.submitButtonDisabled]} 
          onPress={handleSubmit}
          disabled={saving}
        >
          <Text style={styles.submitButtonText}>
            {saving ? 'Saving...' : 'Add Product'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.cancelButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { 
    backgroundColor: '#6c63ff', 
    padding: 20, 
    paddingTop: 50,
  },
  headerTitle: { 
    color: '#fff', 
    fontSize: 20, 
    fontWeight: 'bold' 
  },
  previewCard: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#6c63ff',
  },
  previewLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  previewName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  previewPrice: {
    fontSize: 14,
    color: '#6c63ff',
    marginTop: 5,
  },
  form: { 
    padding: 15 
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    marginBottom: 15,
    marginTop: 10,
    color: '#333',
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#ddd', 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 15, 
    backgroundColor: '#fff',
    fontSize: 16,
  },
  toggleContainer: {
    marginBottom: 15,
  },
  toggleLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  toggleButtons: {
    flexDirection: 'row',
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#6c63ff',
  },
  toggleText: {
    fontSize: 14,
    color: '#666',
  },
  toggleTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  calculatedPrice: {
    backgroundColor: '#e8e8e8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calculatedLabel: {
    fontSize: 14,
    color: '#666',
  },
  calculatedValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6c63ff',
  },
  submitButton: { 
    backgroundColor: '#e53935', 
    padding: 15, 
    borderRadius: 8, 
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: { 
    color: '#fff', 
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
});
