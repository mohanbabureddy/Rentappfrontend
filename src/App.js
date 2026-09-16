import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import TenantBills from './TenantBills';
import TenantComplaints from './TenantComplaints';
import TenantOccupants from './TenantOccupants';
import AdminAddBill from './AdminAddBill';
import AdminUsers from './AdminUsers';
import AdminViewBills from './AdminViewBills';
import AdminPaidBillsReport from './AdminPaidBillsReport';
import AdminComplaints from './AdminComplaints';
import AdminTenantDocuments from './AdminTenantDocuments';
import Login from './Login';
import Registration from './Registration';
import ForgotReset from './ForgotReset';
import Terms from './Terms';
import RefundPolicy from './RefundPolicy';
import ChatAssistant from './ChatAssistant';
import { API_BASE, API_PREFIX } from './apiClient';

// App version (exposed via environment variable REACT_APP_VERSION)
const APP_VERSION = process.env.REACT_APP_VERSION || '0.1.0';
// Commit actually baked into this build -- set from Render's own
// RENDER_GIT_COMMIT build arg, so it's always accurate with no manual bump.
const FRONTEND_COMMIT = process.env.REACT_APP_GIT_COMMIT || 'local-dev';

// Keep inactivity limit outside component so it's stable and excluded from hook dependency warnings
const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutes

function App() {
  const [user, setUser] = useState(null);
  const [backendCommit, setBackendCommit] = useState(null);
  const timerRef = useRef(null);

  // Fetch the backend's own deployed commit so the footer can show whether
  // frontend and backend are both on their latest deploy at a glance.
  useEffect(() => {
    fetch(`${API_BASE}${API_PREFIX}/version`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setBackendCommit(data.commit))
      .catch(() => {});
  }, []);

  // Load user from localStorage on app start
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) return;
    try {
      const parsed = JSON.parse(storedUser);
      // If we have lastActivity and it exceeded limit while app was closed, force logout
      if (parsed.lastActivity && Date.now() - parsed.lastActivity > INACTIVITY_LIMIT) {
        localStorage.removeItem('user');
      } else {
        setUser(parsed);
      }
    } catch {
      localStorage.removeItem('user');
    }
  }, []);

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    clearTimeout(timerRef.current);
  };

  const defaultRoute = user?.role === 'ADMIN' ? '/admin/view-bills' : '/';

  // Inactivity auto-logout logic
  useEffect(() => {
    if (!user) return;

    const logoutAfterInactivity = () => {
      handleLogout();
      alert('You have been logged out due to inactivity.');
    };

    const resetTimer = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(logoutAfterInactivity, INACTIVITY_LIMIT);
      // Persist latest activity timestamp so a full page reload / dev server restart can still evaluate expiry
      try {
        const stored = localStorage.getItem('user');
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.lastActivity = Date.now();
          localStorage.setItem('user', JSON.stringify(parsed));
        }
      } catch { /* ignore */ }
    };

    // List of events that indicate activity
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

    events.forEach(event =>
      window.addEventListener(event, resetTimer)
    );

    resetTimer(); // Start timer on mount

    return () => {
      clearTimeout(timerRef.current);
      events.forEach(event =>
        window.removeEventListener(event, resetTimer)
      );
    };
  }, [user]);

  return (
    <Router>
      {!user ? (
        <Routes>
          <Route path="/register" element={<Registration />} />
          <Route path="/forgot" element={<ForgotReset />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="*" element={
            <Login setUser={(u)=>{ setUser(u); localStorage.setItem('user',JSON.stringify(u)); }} />
          } />
        </Routes>
      ) : (
        <div
          style={{
            maxWidth: '1100px',
            margin: '40px auto',
            padding: '32px',
            background: '#f8fafc',
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
            }}
          >
            <div style={{ fontWeight: 'bold', color: '#2563eb', fontSize: '20px', letterSpacing: '1px' }}>
              Rent Management
            </div>
            <div>
              Logged in as: <strong>{user.username}</strong> ({user.role})
              <button
                style={{
                  marginLeft: '16px',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>

          <nav
            style={{
              marginBottom: '32px',
              padding: '12px 0',
              background: 'linear-gradient(90deg, #2563eb 0%, #38bdf8 100%)',
              borderRadius: '8px',
              textAlign: 'center',
            }}
          >
            {user.role === "ADMIN" ? (
              <>
                <Link to="/admin/add-bill" style={navLinkStyle}>Add Bill</Link>
                <Link to="/admin/view-bills" style={navLinkStyle}>View Bills</Link>
                <Link to="/admin/users" style={navLinkStyle}>Manage Users</Link>
                <Link to="/admin/paid-report" style={navLinkStyle}>Paid Report</Link>
                <Link to="/admin/complaints" style={navLinkStyle}>Complaints</Link>
                <Link to="/admin/tenant-docs" style={navLinkStyle}>Tenant Docs</Link>
              </>
            ) : (
              <>
                <Link to="/" style={navLinkStyle}>My Bills</Link>
                <Link to="/complaints" style={navLinkStyle}>Complaints</Link>
                <Link to="/occupants" style={navLinkStyle}>Occupants</Link>
              </>
            )}
          </nav>

          <Routes>
            <Route path="/" element={<TenantBills username={user.username} />} />
            <Route path="/complaints" element={<TenantComplaints username={user.username} />} />
            <Route path="/occupants" element={<TenantOccupants username={user.username} />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            {user.role === "ADMIN" && (
              <>
                <Route path="/admin/add-bill" element={<AdminAddBill />} />
                <Route path="/admin/view-bills" element={<AdminViewBills />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/paid-report" element={<AdminPaidBillsReport />} />
                <Route path="/admin/complaints" element={<AdminComplaints />} />
                {/* Redirect legacy occupants path to new tenant docs */}
                <Route path="/admin/occupants" element={<Navigate to="/admin/tenant-docs" replace />} />
                <Route path="/admin/tenant-docs" element={<AdminTenantDocuments />} />
              </>
            )}
            <Route path="*" element={<Navigate to={defaultRoute} replace />} />
          </Routes>
          <div style={{marginTop:48,fontSize:12,textAlign:'center',color:'#64748b'}}>
            <Link to="/terms" style={{color:'#2563eb',marginRight:16}}>Terms & Conditions</Link>
            <Link to="/refund-policy" style={{color:'#2563eb',marginRight:16}}>Cancellation & Refund Policy</Link>
            <span style={{opacity:0.8}}>Version {APP_VERSION} ({FRONTEND_COMMIT})</span>
            {backendCommit && <span style={{opacity:0.8,marginLeft:8}}>· API {backendCommit}</span>}
          </div>
          {user.role !== 'ADMIN' && <ChatAssistant />}
        </div>
      )}
    </Router>
  );
}

// Reusable link style
const navLinkStyle = {
  color: '#fff',
  textDecoration: 'none',
  fontWeight: 'bold',
  margin: '0 18px',
  fontSize: '16px',
  letterSpacing: '1px',
};

export default App;