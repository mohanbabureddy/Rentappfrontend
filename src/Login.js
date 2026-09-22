import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { url, FETCH_CREDENTIALS } from './apiClient';
import LanguageSwitcher from './LanguageSwitcher';

function Login({ setUser }) {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // Shown once when authFetch redirected here after a 401 (e.g. logged out
  // because this account signed in elsewhere) -- read once, then discarded.
  const [error, setError] = useState(() => {
    const notice = sessionStorage.getItem('loginNotice');
    if (notice) sessionStorage.removeItem('loginNotice');
    return notice || '';
  });
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
      if (data.role === 'ADMIN') navigate('/admin/dashboard'); else navigate('/');
    } catch (e) {
      if (e.name === 'TypeError' && (e.message === 'Failed to fetch' || e.message === 'NetworkError when attempting to fetch resource.')) {
        setError('Could not reach the server. Please check your connection and try again.');
        return;
      }
      // The backend's own message is already user-facing (e.g. "Invalid
      // credentials", or "Too many failed login attempts. Try again in Ns."
      // from the account lockout) -- swallowing it into a generic "Server
      // error" would make a locked-out user think the whole server is down.
      if ((e.message || '').toLowerCase().includes('registration incomplete')) {
        setError('Registration incomplete. Click Register.');
      } else {
        setError(e.message || 'Something went wrong. Please try again.');
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <LanguageSwitcher />
      </div>
      <h2 style={{ color: '#2563eb', marginBottom: '30px', letterSpacing: '1px', fontWeight: 'bold' }}>{t('login.login')}</h2>
      {error && <div style={{ color: 'red', marginBottom: 14, fontSize: 14 }}>{error}</div>}
      <input placeholder={t('login.username')} value={username} onChange={e => setUsername(e.target.value)} style={input} />
      <input type="password" placeholder={t('login.password')} value={password} onChange={e => setPassword(e.target.value)} style={input} />
      <button onClick={handleLogin} style={mainBtn}>{t('login.login')}</button>

      <div style={{ display: 'flex', gap: '0', marginTop: '24px' }}>
        <button onClick={() => navigate('/register')} style={registerBtn}>{t('login.register')}</button>
        <button onClick={() => navigate('/forgot')} style={forgotBtn}>{t('login.forgot')}</button>
      </div>
    </div>
  );
}

export default Login;