import React, { useState, useEffect } from 'react';
import { url, authFetch } from './apiClient';

/*
  TenantComplaints component
  - Allows a tenant to submit a complaint with description
  - Lists previously submitted complaints (basic view)
  Backend expected endpoints:
    POST   http://localhost:5000/api/complaints        (body: { tenantName, description })
    GET    http://localhost:5000/api/complaints/tenant/{tenantName}
  Each complaint JSON shape assumed:
    { id, tenantName, description, status, createdDate }
*/

// Removed unused API_BASE/API_PREFIX constants (using centralized helpers in apiClient.js)

function TenantComplaints({ username }) {
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [message, setMessage] = useState(null); // success / error message
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL | OPEN | CLOSED
  const [listError, setListError] = useState(null);

  const fetchComplaints = async () => {
    if (!username) return;
    setLoadingList(true);
    try {
  // Backend controller is @RequestMapping("/api/tenants") + @GetMapping("/complaints/{tenant}") (needs to be implemented)
  setListError(null);
  const resp = await authFetch(url.complaintsList(username));
  if (!resp.ok) throw new Error('Failed to load complaints (HTTP ' + resp.status + ')');
      const data = await resp.json();
      setComplaints(Array.isArray(data) ? data.sort((a,b)=> new Date(b.createdDate) - new Date(a.createdDate)) : []);
    } catch (err) {
      console.error(err);
  setListError(err.message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { fetchComplaints(); // load on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const withdraw = async (c) => {
    if (!window.confirm('Withdraw this complaint?')) return;
    try {
      const resp = await authFetch(url.complaintsWithdraw(c.id), { method: 'PUT' });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Could not withdraw the complaint');
      }
      setMessage({ type: 'success', text: 'Complaint withdrawn.' });
      fetchComplaints();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Could not withdraw the complaint' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      setMessage({ type: 'error', text: 'Description is required.' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const resp = await authFetch(url.complaintsAdd(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantName: username, description })
      });
      if (!resp.ok) {
        let extra = '';
        try { extra = ` (status ${resp.status})`; } catch(_) {}
        throw new Error('Failed to submit complaint' + extra);
      }
      setDescription('');
      setMessage({ type: 'success', text: 'Complaint submitted successfully.' });
      // Optimistically append complaint (backend currently returns only message)
      const optimistic = {
        id: 'tmp-' + Date.now(),
        tenantName: username,
        description,
        status: 'OPEN',
        createdDate: new Date().toISOString()
      };
      setComplaints(prev => [optimistic, ...prev]);
      // Refresh list (will replace optimistic once GET works)
      fetchComplaints();
    } catch (err) {
      console.error('Complaint submission error:', err);
      const txt = /Failed to fetch|NetworkError/i.test(err.message)
        ? 'Could not reach the server. Please check your connection and try again.'
        : (err.message || 'Submission failed. Please try again.');
      setMessage({ type: 'error', text: txt });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={containerStyle}>
      <h2 style={headingStyle}>Complaints</h2>
      <form onSubmit={handleSubmit} style={formStyle}>
        <textarea
          placeholder="Describe your issue..."
          value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={textareaStyle}
            rows={4}
            disabled={submitting}
        />
        <button type="submit" disabled={submitting} style={buttonStyle}>
          {submitting ? 'Submitting…' : 'Submit Complaint'}
        </button>
      </form>
      {message && (
        <div style={{
          marginTop: '12px',
          padding: '10px 14px',
          borderRadius: '6px',
          fontWeight: 'bold',
          background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: message.type === 'success' ? '#166534' : '#991b1b',
          boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
        }}>{message.text}</div>
      )}

      <div style={{ marginTop: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
          <h3 style={{ ...headingStyle, fontSize: '20px', marginBottom: 0 }}>Previous Complaints</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['ALL','OPEN','CLOSED'].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(s)}
                style={{
                  background: filterStatus===s ? 'linear-gradient(90deg,#2563eb,#38bdf8)' : '#e2e8f0',
                  color: filterStatus===s ? '#fff' : '#334155',
                  border: 'none',
                  borderRadius: '18px',
                  padding: '6px 16px',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >{s} {s !== 'ALL' && `(${complaints.filter(c=>c.status===s).length})`}</button>
            ))}
            <button
              type="button"
              onClick={fetchComplaints}
              disabled={loadingList}
              style={{
                background: '#0f172a',
                color: '#fff',
                border: 'none',
                borderRadius: '18px',
                padding: '6px 16px',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer',
                opacity: loadingList ? 0.6 : 1
              }}
            >{loadingList ? 'Refreshing…' : 'Refresh'}</button>
          </div>
        </div>
        {loadingList ? (
          <p>Loading…</p>
        ) : complaints.length === 0 ? (
          <p style={{ color: '#64748b' }}>No complaints submitted yet.</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: 'linear-gradient(90deg,#2563eb,#38bdf8)', color: '#fff' }}>
                <th style={thTdStyle}>Created</th>
                <th style={thTdStyle}>Description</th>
                <th style={thTdStyle}>Status</th>
                <th style={thTdStyle}>Resolution</th>
              </tr>
            </thead>
            <tbody>
              {complaints
                .filter(c => filterStatus==='ALL' || c.status === filterStatus)
                .map((c) => (
                <tr key={c.id} style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
                  <td style={thTdStyle}>{c.createdDate ? new Date(c.createdDate).toLocaleString() : ''}</td>
                  <td style={{ ...thTdStyle, textAlign: 'left', maxWidth: '420px' }}>{c.description}</td>
                  <td style={thTdStyle}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '14px',
                      background: c.status === 'CLOSED' ? '#dcfce7' : '#fde68a',
                      color: c.status === 'CLOSED' ? '#166534' : '#92400e',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>{c.status}</span>
                    {c.status === 'OPEN' && typeof c.id === 'number' && (
                      <div style={{ marginTop: 6 }}>
                        <button
                          type="button"
                          onClick={() => withdraw(c)}
                          style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '12px', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                        >Withdraw</button>
                      </div>
                    )}
                  </td>
                  <td style={{ ...thTdStyle, textAlign: 'left', fontSize: '12px', color: '#475569' }}>
                    {c.status === 'CLOSED' && c.resolutionComment ? (
                      <span title={c.resolutionComment} style={{ display: 'inline-block', maxWidth: '260px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.resolutionComment}
                      </span>
                    ) : c.status === 'CLOSED' ? <em style={{ color: '#94a3b8' }}>No comment</em> : <em style={{ color: '#94a3b8' }}>—</em>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {listError && (
          <div style={{ marginTop: '12px', color: '#b91c1c', fontSize: '13px' }}>
            Could not load complaints. Please try again later.
          </div>
        )}
      </div>
    </div>
  );
}

// Inline styles (matching existing aesthetic)
const containerStyle = {
  maxWidth: '900px',
  margin: '40px auto',
  padding: '32px',
  background: '#f8fafc',
  borderRadius: '16px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.08)'
};
const headingStyle = {
  color: '#2563eb',
  textAlign: 'center',
  marginBottom: '24px',
  letterSpacing: '1px',
  fontWeight: 'bold'
};
const formStyle = { display: 'flex', flexDirection: 'column', gap: '12px' };
const textareaStyle = {
  resize: 'vertical',
  padding: '12px 14px',
  fontSize: '15px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  outline: 'none',
  fontFamily: 'inherit'
};
const buttonStyle = {
  background: 'linear-gradient(90deg, #2563eb 0%, #38bdf8 100%)',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  padding: '10px 20px',
  fontWeight: 'bold',
  fontSize: '15px',
  cursor: 'pointer',
  alignSelf: 'flex-start'
};
const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#fff',
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
};
const thTdStyle = { padding: '10px', textAlign: 'center', verticalAlign: 'top' };

export default TenantComplaints;
