import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import DailyReport from './pages/DailyReport';
import AddProduct from './pages/AddProduct';
import NewSale from './pages/NewSale';

// Cashier-only wrapper component
function CashierOnly({ children }) {
  const { user } = useAuth();
  
  if (user?.role === 'cashier') {
    return children;
  }
  
  // For non-cashiers, render nothing (they'll see full navigation)
  return null;
}

// Full access wrapper (for owner/manager)
function FullAccess({ children }) {
  const { user } = useAuth();
  
  if (user?.role === 'cashier') {
    // Cashiers get redirected to new-sale
    return <Navigate to="/new-sale" replace />;
  }
  
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  const isCashier = user?.role === 'cashier';

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Cashier-only routes */}
      <Route 
        path="/*" 
        element={
          isCashier ? (
            <Navigate to="/new-sale" replace />
          ) : (
            <Navigate to="/dashboard" replace />
          )
        } 
      />
      
      {/* Cashier gets New Sale and Daily Report */}
      <Route 
        path="/new-sale" 
        element={
          <PrivateRoute>
            <NewSale />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/daily-report" 
        element={
          <PrivateRoute>
            <DailyReport />
          </PrivateRoute>
        } 
      />
      
      {/* Owner/Manager routes */}
      <Route 
        path="/dashboard" 
        element={
          <PrivateRoute>
            <FullAccess><Dashboard /></FullAccess>
          </PrivateRoute>
        } 
      />
      <Route 
        path="/inventory" 
        element={
          <PrivateRoute>
            <FullAccess><Inventory /></FullAccess>
          </PrivateRoute>
        } 
      />
      <Route 
        path="/products/new" 
        element={
          <PrivateRoute>
            <FullAccess><AddProduct /></FullAccess>
          </PrivateRoute>
        } 
      />
      <Route 
        path="/daily-report" 
        element={
          <PrivateRoute>
            <FullAccess><DailyReport /></FullAccess>
          </PrivateRoute>
        } 
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
