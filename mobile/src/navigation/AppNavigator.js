import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import DashboardScreen from '../screens/DashboardScreen';
import InventoryScreen from '../screens/InventoryScreen';
import NewSaleScreen from '../screens/NewSaleScreen';
import AddProductScreen from '../screens/AddProductScreen';
import UpdateProductScreen from '../screens/UpdateProductScreen';
import LoginScreen from '../screens/LoginScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs({ user }) {
  const isOwner = user?.role === 'owner';
  const isManager = user?.role === 'manager';
  const isCashier = user?.role === 'cashier';

  // Cashiers see only New Sale
  if (isCashier) {
    return (
      <Tab.Navigator screenOptions={{ headerShown: false }}>
        <Tab.Screen name="New Sale" component={NewSaleScreen} />
      </Tab.Navigator>
    );
  }

  // Owners and managers see full navigation
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="New Sale" component={NewSaleScreen} />
      <Tab.Screen name="Inventory" component={InventoryScreen} />
      {isOwner ? <Tab.Screen name="Reports" component={DashboardScreen} /> : null}
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  const isCashier = user?.role === 'cashier';
  const isManager = user?.role === 'manager';
  const isOwner = user?.role === 'owner';

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="Main">
            {(props) => <MainTabs {...props} user={user} />}
          </Stack.Screen>
          {/* Add Product Screen - accessible to owners and managers only */}
          {(isOwner || isManager) && (
            <Stack.Screen name="AddProduct" component={AddProductScreen} />
          )}
          {/* Update Product Screen - accessible to owners and managers only */}
          {(isOwner || isManager) && (
            <Stack.Screen name="UpdateProduct" component={UpdateProductScreen} />
          )}
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
