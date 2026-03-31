import React, { useState, useEffect } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import api from '../services/api';

export default function UpdateProductScreen({ route, navigation }) {
  const { product } = route.params;
  
  const [formData, setFormData] = useState({
    stock_qty: product.stock_qty.toString(),
    selling_price_excl_gst: product.selling_price_excl_gst?.toString() || ''
  });
  
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Calculate incl. GST price from excl. GST price
  const computedInclPrice = () => {
    const price = parseFloat(formData.selling_price_excl_gst) || 0;
    const gstRate = parseFloat(product.gst_rate) || 12;
    return Math.round(price * (1 + gstRate / 100) * 100) / 100;
  };

  function validateForm() {
    const newErrors = {};
    
    const stockQty = parseInt(formData.stock_qty);
    if (isNaN(stockQty) || stockQty < 0) {
      newErrors.stock_qty = 'Stock quantity must be a non-negative number';
    }
    
    const sellingPrice = parseFloat(formData.selling_price_excl_gst);
    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      newErrors.selling_price_excl_gst = 'Selling price must be a positive number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    setApiError(null);
    
    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      const payload = {
        stock_qty: parseInt(formData.stock_qty),
        selling_price_excl_gst: parseFloat(formData.selling_price_excl_gst)
      };

      const res = await api.put(`/products/${product.id}`, payload);
      
      // Check if product was soft-deleted (stock set to 0)
      if (res.data.deleted) {
        // Show alert
        Alert.alert(
          'Product Removed',
          `${res.data.display_name} has been removed from inventory.`,
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Inventory', { refresh: true })
            }
          ]
        );
      } else {
        // Navigate back and refresh
        navigation.navigate('Inventory', { refresh: true });
      }
    } catch (err) {
      setApiError(err.response?.data?.error || 'Failed to update product');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Update Product</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>
            {product.company_name} {product.size_spec}
          </Text>
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Stock quantity</Text>
          <TextInput
            style={[styles.input, errors.stock_qty && styles.inputError]}
            value={formData.stock_qty}
            onChangeText={(text) => {
              setFormData({ ...formData, stock_qty: text });
              if (errors.stock_qty) {
                setErrors({ ...errors, stock_qty: null });
              }
            }}
            keyboardType="numeric"
            placeholder="Enter stock quantity"
          />
          {errors.stock_qty && (
            <Text style={styles.errorText}>{errors.stock_qty}</Text>
          )}
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Selling price excl GST (₹)</Text>
          <TextInput
            style={[styles.input, errors.selling_price_excl_gst && styles.inputError]}
            value={formData.selling_price_excl_gst}
            onChangeText={(text) => {
              setFormData({ ...formData, selling_price_excl_gst: text });
              if (errors.selling_price_excl_gst) {
                setErrors({ ...errors, selling_price_excl_gst: null });
              }
            }}
            keyboardType="decimal-pad"
            placeholder="Enter selling price"
          />
          {errors.selling_price_excl_gst && (
            <Text style={styles.errorText}>{errors.selling_price_excl_gst}</Text>
          )}
        </View>

        <View style={styles.computedContainer}>
          <Text style={styles.computedLabel}>
            Incl. GST ({product.gst_rate}%): ₹ {computedInclPrice().toFixed(2)}
          </Text>
        </View>

        {apiError && (
          <Text style={styles.apiError}>{apiError}</Text>
        )}

        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save'}
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
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#6c63ff',
    padding: 20,
    paddingTop: 50,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  form: {
    padding: 15,
  },
  productInfo: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#6c63ff',
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  inputError: {
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginTop: 5,
  },
  computedContainer: {
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  computedLabel: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '500',
  },
  apiError: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveButtonDisabled: {
    backgroundColor: '#a5d6a7',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    padding: 15,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
});
