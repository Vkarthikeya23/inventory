import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isOwner = user?.role === 'owner';
  const isManager = user?.role === 'manager';
  const isCashier = user?.role === 'cashier';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const baseNavStyle = {
    backgroundColor: '#4A8A62',
    padding: '12px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const linkStyle = {
    color: '#fff',
    textDecoration: 'none',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  };

  const primaryBtnStyle = {
    ...linkStyle,
    backgroundColor: '#3d7a52',
    fontWeight: '600',
  };

  const addBtnStyle = {
    backgroundColor: '#C4956A',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '14px',
  };

  const logoutBtnStyle = {
    backgroundColor: '#fff',
    color: '#4A8A62',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '15px',
  };

  const desktopLinks = (
    <>
      {isCashier ? (
        <>
          <Link to="/new-sale" style={primaryBtnStyle}>+ New Sale</Link>
          <Link to="/inventory" style={linkStyle}>Inventory</Link>
          <Link to="/daily-report" style={linkStyle}>Daily Report</Link>
          <button onClick={() => navigate('/products/new')} style={addBtnStyle}>+ Add Product</button>
          <button onClick={() => navigate('/services/new')} style={addBtnStyle}>+ Add Service</button>
        </>
      ) : (
        <>
          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '18px', marginRight: '10px' }}>SRI MAHALAKSHMI TYRES</span>
          <Link to="/dashboard" style={linkStyle}>Dashboard</Link>
          <Link to="/inventory" style={linkStyle}>Inventory</Link>
          <Link to="/new-sale" style={primaryBtnStyle}>+ New Sale</Link>
          {(isManager || isOwner) && <Link to="/daily-report" style={linkStyle}>Daily Report</Link>}
          {(isManager || isOwner) && (
            <>
              <button onClick={() => navigate('/services/new')} style={addBtnStyle}>+ Add Service</button>
              <button onClick={() => navigate('/products/new')} style={addBtnStyle}>+ Add Product</button>
            </>
          )}
        </>
      )}
    </>
  );

  const mobileMenu = (
    <div style={{
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: '#4A8A62',
      padding: '15px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      zIndex: 100,
    }}>
      {isCashier ? (
        <>
          <Link to="/new-sale" style={{ ...linkStyle, backgroundColor: '#3d7a52', textAlign: 'center' }}>+ New Sale</Link>
          <Link to="/inventory" style={linkStyle}>Inventory</Link>
          <Link to="/daily-report" style={linkStyle}>Daily Report</Link>
          <button onClick={() => navigate('/products/new')} style={addBtnStyle}>+ Add Product</button>
          <button onClick={() => navigate('/services/new')} style={addBtnStyle}>+ Add Service</button>
        </>
      ) : (
        <>
          <Link to="/dashboard" style={linkStyle}>Dashboard</Link>
          <Link to="/inventory" style={linkStyle}>Inventory</Link>
          <Link to="/new-sale" style={{ ...linkStyle, backgroundColor: '#3d7a52' }}>+ New Sale</Link>
          {(isManager || isOwner) && <Link to="/daily-report" style={linkStyle}>Daily Report</Link>}
          {(isManager || isOwner) && (
            <>
              <button onClick={() => navigate('/services/new')} style={addBtnStyle}>+ Add Service</button>
              <button onClick={() => navigate('/products/new')} style={addBtnStyle}>+ Add Product</button>
            </>
          )}
        </>
      )}
    </div>
  );

  return (
    <nav style={baseNavStyle, { position: 'relative', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '5px',
            display: 'none',
          }}
          className="mobile-menu-btn"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
        
        {/* Desktop links */}
        <div className="desktop-links" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {!isCashier && (
            <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '18px', marginRight: '5px' }}>SRI MAHALAKSHMI TYRES</span>
          )}
          {desktopLinks}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <span style={{ color: '#fff', fontSize: '15px', fontWeight: '500' }}>{user?.name}</span>
        <button onClick={handleLogout} style={logoutBtnStyle}>Logout</button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && mobileMenu}

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn {
            display: block !important;
          }
          .desktop-links {
            display: none !important;
          }
        }
      `}</style>
    </nav>
  );
}
