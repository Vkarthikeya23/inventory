import React, { useState, useEffect } from 'react';
import { 
  View, TextInput, FlatList, Text, TouchableOpacity, StyleSheet, 
  Alert, ScrollView, Linking, Clipboard 
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const API_BASE_URL = 'http://192.168.1.100:4000';

// Simple Indian number to words converter
function numberToWords(num) {
  const singleDigit = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const doubleDigit = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tensPlace = ['Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const placeName = ['', 'Thousand', 'Lakh', 'Crore'];

  if (num === 0) return 'Zero';
  
  function toWords(n) {
    if (n < 10) return singleDigit[n];
    if (n < 20) return doubleDigit[n - 10];
    if (n < 100) return tensPlace[Math.floor(n / 10) - 2] + (n % 10 !== 0 ? ' ' + singleDigit[n % 10] : '');
    if (n < 1000) return singleDigit[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + toWords(n % 100) : '');
    return n;
  }

  if (num < 1000) return toWords(num) + ' Only';

  let result = '';
  let numStr = num.toString();
  let count = 0;

  while (numStr.length > 0) {
    let sliceLength = (count === 0) ? 3 : 2;
    if (numStr.length < sliceLength) sliceLength = numStr.length;
    
    let currentSlice = parseInt(numStr.slice(-sliceLength));
    numStr = numStr.slice(0, -sliceLength);
    
    if (currentSlice !== 0) {
      result = toWords(currentSlice) + ' ' + placeName[count] + ' ' + result;
    }
    count++;
  }

  return result.trim() + ' Only';
}

export default function NewSaleScreen({ navigation }) {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [customer, setCustomer] = useState({ 
    name: '', 
    phone: '', 
    vehicle_reg: '' 
  });
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [lineItems, setLineItems] = useState([
    { id: Date.now(), product_id: '', display_name: '', qty: 1, unit_price: '', gst_rate: 12, amount: 0 }
  ]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(null);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [saleResult, setSaleResult] = useState(null);

  const GST_RATE = 12;
  const HALF_GST_RATE = 6;

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      const res = await api.get('/products');
      setProducts(res.data);
    } catch (err) {
      console.error('Fetch products error:', err);
    }
  }

  function addLineItem() {
    setLineItems([...lineItems, {
      id: Date.now(),
      product_id: '',
      display_name: '',
      qty: 1,
      unit_price: '',
      gst_rate: GST_RATE,
      amount: 0
    }]);
  }

  function removeLineItem(id) {
    setLineItems(lineItems.filter(item => item.id !== id));
  }

  function updateLineItem(id, field, value) {
    setLineItems(lineItems.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, [field]: value };
      
      if (field === 'qty' || field === 'unit_price') {
        const qty = field === 'qty' ? parseFloat(value) || 1 : item.qty;
        const price = field === 'unit_price' ? parseFloat(value) || 0 : parseFloat(item.unit_price) || 0;
        updated.amount = (qty * price * (1 + GST_RATE / 100));
      }
      
      return updated;
    }));
  }

  function selectProduct(lineId, product) {
    setLineItems(lineItems.map(item => {
      if (item.id !== lineId) return item;
      return {
        ...item,
        product_id: product.id,
        display_name: `${product.company_name} ${product.size_spec}`,
        unit_price: product.selling_price_excl_gst,
        gst_rate: product.gst_rate || GST_RATE,
        amount: product.selling_price_excl_gst * 1.12
      };
    }));
    setShowProductDropdown(null);
    setProductSearch('');
  }

  function getFilteredProducts(search) {
    if (!search) return [];
    return products.filter(p => 
      `${p.company_name} ${p.size_spec}`.toLowerCase().includes(search.toLowerCase())
    );
  }

  // Calculations
  const subtotal = lineItems.reduce((sum, item) => {
    const price = parseFloat(item.unit_price) || 0;
    const qty = parseFloat(item.qty) || 0;
    return sum + (price * qty);
  }, 0);

  const cgst = subtotal * (HALF_GST_RATE / 100);
  const sgst = subtotal * (HALF_GST_RATE / 100);
  const total = subtotal + cgst + sgst;
  const balance = total - (parseFloat(receivedAmount) || 0);
  const amountInWords = numberToWords(Math.round(total));

  async function submitSale() {
    if (!customer.name || !customer.phone) {
      Alert.alert('Error', 'Customer name and phone are required');
      return;
    }

    const validItems = lineItems.filter(item => item.product_id && item.qty > 0);
    if (validItems.length === 0) {
      Alert.alert('Error', 'Please add at least one product');
      return;
    }

    try {
      const res = await api.post('/sales', {
        customer_name: customer.name,
        customer_phone: customer.phone,
        vehicle_reg: customer.vehicle_reg,
        received_amount: parseFloat(receivedAmount) || 0,
        balance: balance,
        amount_in_words: amountInWords,
        items: validItems.map(item => ({
          product_id: item.product_id,
          qty: parseFloat(item.qty),
          unit_price: parseFloat(item.unit_price)
        }))
      });

      setSaleResult(res.data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Sale failed');
    }
  }

  function handleWhatsAppShare() {
    if (!saleResult) return;
    const invoiceUrl = `${API_BASE_URL}/invoice/${saleResult.invoice_number}`;
    const message = encodeURIComponent(`Hi, your invoice ${saleResult.invoice_number} is ready. View here: ${invoiceUrl}`);
    const phone = saleResult.customer_phone.replace(/[^0-9]/g, '');
    const waLink = `https://wa.me/91${phone}?text=${message}`;
    Linking.openURL(waLink);
  }

  function handleCopyLink() {
    if (!saleResult) return;
    const invoiceUrl = `${API_BASE_URL}/invoice/${saleResult.invoice_number}`;
    Clipboard.setString(invoiceUrl);
    Alert.alert('Copied', 'Invoice link copied to clipboard');
  }

  function handleNewSale() {
    setCustomer({ name: '', phone: '', vehicle_reg: '' });
    setLineItems([{ id: Date.now(), product_id: '', display_name: '', qty: 1, unit_price: '', gst_rate: GST_RATE, amount: 0 }]);
    setReceivedAmount('');
    setSaleResult(null);
  }

  if (saleResult) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>Sale Complete!</Text>
          <Text style={styles.successInvoice}>Invoice #{saleResult.invoice_number}</Text>
          <Text style={styles.successTotal}>₹{saleResult.total}</Text>
          
          <TouchableOpacity style={styles.whatsappButton} onPress={handleWhatsAppShare}>
            <Text style={styles.whatsappButtonText}>Send on WhatsApp</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.copyButton} onPress={handleCopyLink}>
            <Text style={styles.copyButtonText}>Copy Invoice Link</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.newSaleButton} onPress={handleNewSale}>
            <Text style={styles.newSaleButtonText}>New Sale</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>New Sale</Text>
      </View>

      {/* Customer Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Customer Details</Text>
        <TextInput
          style={styles.input}
          placeholder="Customer Name *"
          value={customer.name}
          onChangeText={t => setCustomer({ ...customer, name: t })}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone Number *"
          value={customer.phone}
          onChangeText={t => setCustomer({ ...customer, phone: t })}
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          placeholder="Vehicle Registration"
          value={customer.vehicle_reg}
          onChangeText={t => setCustomer({ ...customer, vehicle_reg: t })}
        />
      </View>

      {/* Invoice Date */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Invoice Details</Text>
        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>Date:</Text>
          <Text style={styles.dateValue}>{new Date(invoiceDate).toLocaleDateString('en-IN')}</Text>
        </View>
      </View>

      {/* Line Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items</Text>
        
        {lineItems.map((item, index) => (
          <View key={item.id} style={styles.lineItem}>
            <View style={styles.lineHeader}>
              <Text style={styles.lineNumber}>#{index + 1}</Text>
              {lineItems.length > 1 && (
                <TouchableOpacity onPress={() => removeLineItem(item.id)}>
                  <Text style={styles.removeBtn}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {/* Product Search */}
            <View style={styles.productSearchContainer}>
              <TextInput
                style={[styles.input, styles.productInput]}
                placeholder="Search product..."
                value={showProductDropdown === item.id ? productSearch : item.display_name}
                onFocus={() => setShowProductDropdown(item.id)}
                onChangeText={t => setProductSearch(t)}
              />
              {showProductDropdown === item.id && (
                <View style={styles.dropdown}>
                  {getFilteredProducts(productSearch).map(product => (
                    <TouchableOpacity
                      key={product.id}
                      style={styles.dropdownItem}
                      onPress={() => selectProduct(item.id, product)}
                    >
                      <Text>{product.company_name} {product.size_spec}</Text>
                      <Text style={styles.dropdownPrice}>₹{product.selling_price_incl_gst}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.lineInputs}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Qty</Text>
                <TextInput
                  style={[styles.input, styles.smallInput]}
                  value={String(item.qty)}
                  onChangeText={t => updateLineItem(item.id, 'qty', t)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Price (₹)</Text>
                <TextInput
                  style={[styles.input, styles.smallInput]}
                  value={String(item.unit_price)}
                  onChangeText={t => updateLineItem(item.id, 'unit_price', t)}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>GST %</Text>
                <Text style={styles.gstValue}>{item.gst_rate}%</Text>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Amount</Text>
                <Text style={styles.amountValue}>₹{item.amount.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addItemBtn} onPress={addLineItem}>
          <Text style={styles.addItemText}>+ Add Item</Text>
        </TouchableOpacity>
      </View>

      {/* Amount in Words */}
      <View style={styles.section}>
        <Text style={styles.wordsLabel}>Amount in Words:</Text>
        <Text style={styles.wordsValue}>{amountInWords}</Text>
      </View>

      {/* Totals */}
      <View style={styles.section}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Sub Total:</Text>
          <Text style={styles.totalValue}>₹{subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>CGST @{HALF_GST_RATE}%:</Text>
          <Text style={styles.totalValue}>₹{cgst.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>SGST @{HALF_GST_RATE}%:</Text>
          <Text style={styles.totalValue}>₹{sgst.toFixed(2)}</Text>
        </View>
        <View style={[styles.totalRow, styles.grandTotalRow]}>
          <Text style={styles.grandTotalLabel}>Total:</Text>
          <Text style={styles.grandTotalValue}>₹{total.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Received:</Text>
          <TextInput
            style={[styles.input, styles.totalInput]}
            value={receivedAmount}
            onChangeText={setReceivedAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Balance:</Text>
          <Text style={[styles.totalValue, balance < 0 && styles.negativeBalance]}>
            ₹{balance.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity style={styles.submitButton} onPress={submitSale}>
        <Text style={styles.submitButtonText}>Complete Sale</Text>
      </TouchableOpacity>
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
  section: { 
    backgroundColor: '#fff', 
    margin: 15, 
    padding: 15, 
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    marginBottom: 15,
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
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 14,
    color: '#666',
    width: 80,
  },
  dateValue: {
    fontSize: 16,
    color: '#333',
  },
  lineItem: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fafafa',
  },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  lineNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  removeBtn: {
    color: '#e53935',
    fontSize: 14,
  },
  productSearchContainer: {
    position: 'relative',
    zIndex: 1,
  },
  productInput: {
    marginBottom: 10,
  },
  dropdown: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    maxHeight: 150,
    zIndex: 1000,
    elevation: 5,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownPrice: {
    color: '#6c63ff',
    fontWeight: '600',
  },
  lineInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  smallInput: {
    marginBottom: 0,
    padding: 8,
    fontSize: 14,
  },
  gstValue: {
    fontSize: 14,
    color: '#333',
    paddingTop: 8,
  },
  amountValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6c63ff',
    paddingTop: 8,
  },
  addItemBtn: {
    borderWidth: 1,
    borderColor: '#6c63ff',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  addItemText: {
    color: '#6c63ff',
    fontWeight: '600',
  },
  wordsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  wordsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    fontStyle: 'italic',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalValue: {
    fontSize: 14,
    color: '#333',
  },
  grandTotalRow: {
    borderTopWidth: 2,
    borderTopColor: '#6c63ff',
    marginTop: 10,
    paddingTop: 10,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6c63ff',
  },
  totalInput: {
    marginBottom: 0,
    width: 100,
    textAlign: 'right',
  },
  negativeBalance: {
    color: '#e53935',
  },
  submitButton: { 
    backgroundColor: '#6c63ff', 
    padding: 15, 
    borderRadius: 8, 
    alignItems: 'center',
    margin: 15,
    marginBottom: 30,
  },
  submitButtonText: { 
    color: '#fff', 
    fontWeight: 'bold',
    fontSize: 16,
  },
  successCard: {
    margin: 15,
    padding: 30,
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
  },
  successTitle: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#4CAF50', 
    marginBottom: 20 
  },
  successInvoice: { 
    fontSize: 18, 
    color: '#333', 
    marginBottom: 10 
  },
  successTotal: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#6c63ff', 
    marginBottom: 30 
  },
  whatsappButton: { 
    backgroundColor: '#25D366', 
    padding: 15, 
    borderRadius: 8, 
    alignItems: 'center', 
    width: '100%', 
    marginBottom: 10 
  },
  whatsappButtonText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  copyButton: { 
    backgroundColor: '#6c63ff', 
    padding: 15, 
    borderRadius: 8, 
    alignItems: 'center', 
    width: '100%', 
    marginBottom: 10 
  },
  copyButtonText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  newSaleButton: { 
    backgroundColor: '#9E9E9E', 
    padding: 15, 
    borderRadius: 8, 
    alignItems: 'center', 
    width: '100%' 
  },
  newSaleButtonText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
});
