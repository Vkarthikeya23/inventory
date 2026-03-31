import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isOwner = user?.role === 'owner';
  const isManager = user?.role === 'manager';
  const isCashier = user?.role === 'cashier';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  // Cashier sees only New Sale
  if (isCashier) {
    return (
      <nav style={{ backgroundColor: '#2196F3', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '18px' }}>TyreShop Pro</span>
          <Link to="/new-sale" style={{ color: '#fff', textDecoration: 'none', backgroundColor: '#4CAF50', padding: '5px 10px', borderRadius: '4px' }}>+ New Sale</Link>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <span style={{ color: '#fff' }}>{user?.name} ({user?.role})</span>
          <button onClick={handleLogout} style={{ backgroundColor: '#fff', color: '#2196F3', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer' }}>Logout</button>
        </div>
      </nav>
    );
  }

  return (
    <nav style={{ backgroundColor: '#2196F3', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '18px' }}>TyreShop Pro</span>
        <Link to="/dashboard" style={{ color: '#fff', textDecoration: 'none' }}>Dashboard</Link>
        <Link to="/inventory" style={{ color: '#fff', textDecoration: 'none' }}>Inventory</Link>
        <Link to="/new-sale" style={{ color: '#fff', textDecoration: 'none', backgroundColor: '#4CAF50', padding: '5px 10px', borderRadius: '4px' }}>+ New Sale</Link>
        {(isManager || isOwner) && <Link to="/daily-report" style={{ color: '#fff', textDecoration: 'none' }}>Daily Report</Link>}
      </div>
      
      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
        {(isManager || isOwner) && (
          <button 
            onClick={() => navigate('/products/new')}
            style={{
              backgroundColor: '#e53e3e',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            + Add Product
          </button>
        )}
        <span style={{ color: '#fff' }}>{user?.name} ({user?.role})</span>
        <button onClick={handleLogout} style={{ backgroundColor: '#fff', color: '#2196F3', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer' }}>Logout</button>
      </div>
    </nav>
  );
}
