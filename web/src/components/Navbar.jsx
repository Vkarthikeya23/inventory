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
      <nav style={{ backgroundColor: '#2196F3', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 'clamp(14px, 3vw, 18px)' }}>SRI MAHALAKSHMI TYRES</span>
          <Link to="/new-sale" style={{ color: '#fff', textDecoration: 'none', backgroundColor: '#4CAF50', padding: '8px 12px', borderRadius: '4px', fontWeight: '600' }}>+ New Sale</Link>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontSize: '14px' }}>{user?.name}</span>
          <button onClick={handleLogout} style={{ backgroundColor: '#fff', color: '#2196F3', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }}>Logout</button>
        </div>
      </nav>
    );
  }

  return (
    <nav style={{ backgroundColor: '#2196F3', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
      <div style={{ display: 'flex', gap: 'clamp(8px, 2vw, 20px)', alignItems: 'center', flexWrap: 'wrap', flex: '1 1 auto' }}>
        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 'clamp(14px, 3vw, 20px)' }}>SRI MAHALAKSHMI TYRES</span>
        <Link to="/dashboard" style={{ color: '#fff', textDecoration: 'none', padding: '8px 12px', borderRadius: '4px', fontSize: '14px' }}>Dashboard</Link>
        <Link to="/inventory" style={{ color: '#fff', textDecoration: 'none', padding: '8px 12px', borderRadius: '4px', fontSize: '14px' }}>Inventory</Link>
        <Link to="/new-sale" style={{ color: '#fff', textDecoration: 'none', backgroundColor: '#4CAF50', padding: '8px 12px', borderRadius: '4px', fontWeight: '600' }}>+ New Sale</Link>
        {(isManager || isOwner) && <Link to="/daily-report" style={{ color: '#fff', textDecoration: 'none', padding: '8px 12px', borderRadius: '4px', fontSize: '14px' }}>Daily Report</Link>}
      </div>
      
      <div style={{ display: 'flex', gap: 'clamp(8px, 2vw, 15px)', alignItems: 'center', flexWrap: 'wrap' }}>
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
        <span style={{ color: '#fff', fontSize: '14px' }}>{user?.name}</span>
        <button onClick={handleLogout} style={{ backgroundColor: '#fff', color: '#2196F3', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }}>Logout</button>
      </div>
    </nav>
  );
}
