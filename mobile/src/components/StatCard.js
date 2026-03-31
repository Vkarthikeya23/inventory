import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function StatCard({ label, value, color }) {
  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    width: '45%',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: { fontSize: 12, color: '#666', marginBottom: 5 },
  value: { fontSize: 18, fontWeight: 'bold', color: '#333' },
});
