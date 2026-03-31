import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function StockBadge({ stockQty, threshold }) {
  let color;
  let label;

  if (stockQty === 0) {
    color = '#f44336';
    label = 'Out of Stock';
  } else if (stockQty <= threshold) {
    color = '#ff9800';
    label = 'Low Stock';
  } else {
    color = '#4caf50';
    label = 'In Stock';
  }

  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
