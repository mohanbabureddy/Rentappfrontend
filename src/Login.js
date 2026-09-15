import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { url, FETCH_CREDENTIALS } from './apiClient';

function Login({ setUser }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError('');
    try {
      const endpoint = url.login();
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: FETCH_CREDENTIALS
      });
      const raw = await res.text();
      let data; try { data = raw ? JSON.parse(raw) : {}; } catch { data = { error: raw }; }
      if (!res.ok) {
        if (data.error === 'Registration incomplete') {
          setError('Registration incomplete. Click Register.');
          return;
        }
        throw new Error(data.error || `Login failed (HTTP ${res.status})`);
      }
      if (!data.role) data.role = 'TENANT';
      if (!data.username) data.username = data.userName || data.name || username;
      data.lastActivity = Date.now();
      setUser(data);
      localStorage.setItem('user', JSON.stringify(data));
      if (data.role === 'ADMIN') navigate('/admin/view-bills'); else navigate('/');
    } catch (e) {
      // Hide detailed network/backend errors from end users; show generic message.
      if (e.name === 'TypeError' && (e.message === 'Failed to fetch' || e.message === 'NetworkError when attempting to fetch resource.')) {
        setError('Server error');
      } else {
        // Keep specific UX for incomplete registration, else generic fallback (avoid leaking backend stack/messages)
        if ((e.message || '').toLowerCase().includes('registration incomplete')) {
          setError('Registration incomplete. Click Register.');
        } else {
          setError('Server error');
        }
      }
    }
  };

  const box = {
    maxWidth: '400px',
    margin: '80px auto',
    padding: '40px 34px',
    background: '#f8fafc',
    borderRadius: '18px',
    boxShadow: '0 6px 28px rgba(0,0,0,0.12)',
    textAlign: 'center'
  };
  const input = {
    width: '100%',
    padding: '14px',
    marginBottom: '18px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '16px',
    background: '#fff'
  };
  const mainBtn = {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(90deg,#2563eb 0%,#38bdf8 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '17px',
    letterSpacing: '0.5px',
    cursor: 'pointer'
  };
  const secondaryBtnBase = {
    flex: 1,
    padding: '12px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    border: 'none'
  };
  const registerBtn = {
    ...secondaryBtnBase,
    background: 'linear-gradient(90deg,#10b981,#34d399)',
    color: '#fff',
    marginRight: '10px'
  };
  const forgotBtn = {
    ...secondaryBtnBase,
    background: 'linear-gradient(90deg,#f59e0b,#fbbf24)',
    color: '#fff'
  };

  return (
    <div style={box}>
      <h2 style={{ color: '#2563eb', marginBottom: '30px', letterSpacing: '1px', fontWeight: 'bold' }}>Login</h2>
      {error && <div style={{ color: 'red', marginBottom: 14, fontSize: 14 }}>{error}</div>}
      <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={input} />
      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={input} />
      <button onClick={handleLogin} style={mainBtn}>Login</button>

      <div style={{ display: 'flex', gap: '0', marginTop: '24px' }}>
        <button onClick={() => navigate('/register')} style={registerBtn}>Register</button>
        <button onClick={() => navigate('/forgot')} style={forgotBtn}>Forgot Password</button>
      </div>
    </div>
  );
}

export default Login;