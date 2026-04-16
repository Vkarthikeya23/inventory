import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await login(email, password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      alert(result.error);
    }
  }

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '30px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', borderRadius: '8px', marginTop: 'clamp(20px, 10vh, 100px)' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px', fontSize: 'clamp(18px, 5vw, 28px)' }}>SRI MAHALAKSHMI TYRES</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Username</label>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
            required
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
            required
          />
        </div>
        <button type="submit" style={{ width: '100%', backgroundColor: '#2196F3', color: '#fff', border: 'none', padding: '12px', borderRadius: '4px', fontSize: '16px', cursor: 'pointer' }}>Login</button>
      </form>
    </div>
  );
}
