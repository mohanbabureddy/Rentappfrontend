import React, { useEffect, useState, useCallback } from 'react';
import { formatDateTime } from './dateFormat';
import { authFetch } from './apiClient';

/* AdminComplaints
   Features:
   - List all complaints (optionally filter by status / tenant)
   - Close (mark CLOSED) an OPEN complaint
   Backend endpoints expected:
     GET  /api/tenants/complaints (all)  OR implement specific endpoint
     PUT  /api/tenants/complaints/{id}/close
   If you only have per-tenant GET now, create a new admin GET that returns all.
*/

const API_BASE = (process.env.REACT_APP_API_BASE || 'http://localhost:5000').replace(/\/$/, '');
const API_PREFIX = process.env.REACT_APP_API_PREFIX || '/api';

function AdminComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('OPEN');
  const [searchTenant, setSearchTenant] = useState('');
  const [closingId, setClosingId] = useState(null);
  const [reopeningId, setReopeningId] = useState(null);
  const [closingCommentId, setClosingCommentId] = useState(null);
  const [closingCommentText, setClosingCommentText] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const resp = await authFetch(`${API_BASE}${API_PREFIX}/tenants/complaints`); // needs backend endpoint
      if (!resp.ok) throw new Error('Failed to load complaints (HTTP ' + resp.status + ')');
      const data = await resp.json();
      setComplaints(Array.isArray(data) ? data.sort((a,b)=> new Date(b.createdDate) - new Date(a.createdDate)) : []);
    } catch (e) {
      console.error(e); setError(e.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const closeComplaint = async (id) => {
    if (closingCommentText.trim().length === 0) {
      alert('Please enter a comment / resolution before closing.');
      return;
    }
    setClosingId(id);
    try {
      const resp = await authFetch(`${API_BASE}${API_PREFIX}/tenants/complaints/${id}/close`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionComment: closingCommentText })
      });
      if (!resp.ok) throw new Error('Failed to close (HTTP ' + resp.status + ')');
      setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: 'CLOSED', resolutionComment: closingCommentText } : c));
      setClosingCommentId(null);
      setClosingCommentText('');
    } catch (e) {
      alert(e.message);
    } finally { setClosingId(null); }
  };

  const reopenComplaint = async (id) => {
    if (!window.confirm('Re-open this complaint?')) return;
    setReopeningId(id);
    try {
      const resp = await authFetch(`${API_BASE}${API_PREFIX}/tenants/complaints/${id}/reopen`, { method: 'PUT' });
      if (!resp.ok) throw new Error('Failed to re-open (HTTP ' + resp.status + ')');
      setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: 'OPEN' } : c));
    } catch (e) {
      alert(e.message);
    } finally { setReopeningId(null); }
  };

  const visible = complaints.filter(c =>
    (filterStatus === 'ALL' || c.status === filterStatus) &&
    (searchTenant.trim() === '' || c.tenantName.toLowerCase().includes(searchTenant.trim().toLowerCase()))
  );

  return (
    <div style={containerStyle}>
      <h2 style={headingStyle}>Tenant Complaints</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        {['OPEN','CLOSED','ALL'].map(s => (
          <button key={s} onClick={()=>setFilterStatus(s)} style={{
            background: filterStatus===s ? 'linear-gradient(90deg,#2563eb,#38bdf8)' : '#e2e8f0',
            color: filterStatus===s ? '#fff' : '#334155',
            border: 'none', borderRadius: '18px', padding: '6px 16px',
            fontWeight: 'bold', fontSize: '13px', cursor: 'pointer'
          }}>{s} {s!=='ALL' && `(${complaints.filter(c=>c.status===s).length})`}</button>
        ))}
        <input
          placeholder="Filter by tenant"
          value={searchTenant}
          onChange={e=>setSearchTenant(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', flex: '1 1 180px' }}
        />
        <button onClick={fetchAll} disabled={loading} style={refreshBtnStyle}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      {error && <div style={{ color: '#b91c1c', marginBottom: '12px' }}>{error}</div>}
      {loading ? (
        <p>Loading…</p>
      ) : visible.length === 0 ? (
        <div style={{ color: '#64748b' }}>
          <p style={{ margin: 0 }}>
            {complaints.length === 0 ? 'No complaints found.' : 'No complaints match this filter.'}
          </p>
        </div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr style={{ background: 'linear-gradient(90deg,#2563eb,#38bdf8)', color: '#fff' }}>
              <th style={thTdStyle}>Created</th>
              <th style={thTdStyle}>Tenant</th>
              <th style={thTdStyle}>Description</th>
              <th style={thTdStyle}>Status / Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(c => (
              <tr key={c.id} style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
                <td style={thTdStyle}>{c.createdDate ? formatDateTime(c.createdDate) : ''}</td>
                <td style={thTdStyle}>{c.tenantName}</td>
                <td style={{ ...thTdStyle, textAlign: 'left', maxWidth: '400px' }}>{c.description}</td>
                <td style={thTdStyle}>
                  {c.status === 'OPEN' ? (
                    closingCommentId === c.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px' }}>
                        <textarea
                          value={closingCommentText}
                          onChange={e=>setClosingCommentText(e.target.value)}
                          placeholder="Resolution comment"
                          rows={3}
                          style={{ resize: 'vertical', padding: '6px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        />
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={()=>closeComplaint(c.id)}
                            disabled={closingId===c.id}
                            style={{
                              background: 'linear-gradient(90deg,#16a34a,#4ade80)',
                              color: '#fff', border: 'none', borderRadius: '6px',
                              padding: '6px 10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer',
                              opacity: closingId===c.id ? 0.6 : 1
                            }}
                          >{closingId===c.id ? 'Closing…' : 'Submit'}</button>
                          <button
                            onClick={()=>{ setClosingCommentId(null); setClosingCommentText(''); }}
                            type="button"
                            style={{
                              background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px',
                              padding: '6px 10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer'
                            }}
                          >Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={()=>{ setClosingCommentId(c.id); setClosingCommentText(''); }}
                        disabled={closingId===c.id}
                        style={{
                          background: 'linear-gradient(90deg,#16a34a,#4ade80)',
                          color: '#fff', border: 'none', borderRadius: '6px',
                          padding: '6px 14px', fontWeight: 'bold', cursor: 'pointer',
                          opacity: closingId===c.id ? 0.6 : 1
                        }}
                      >Close</button>
                    )
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: '14px',
                          background: '#dcfce7', color: '#166534', fontSize: '12px', fontWeight: 'bold'
                        }}>CLOSED</span>
                        <button
                          onClick={()=>reopenComplaint(c.id)}
                          disabled={reopeningId===c.id}
                          style={{
                            background: 'linear-gradient(90deg,#2563eb,#38bdf8)',
                            color: '#fff', border: 'none', borderRadius: '6px',
                            padding: '6px 14px', fontWeight: 'bold', cursor: 'pointer',
                            opacity: reopeningId===c.id ? 0.6 : 1
                          }}
                        >{reopeningId===c.id ? 'Re-opening…' : 'Re-open'}</button>
                      </div>
                      {c.resolutionComment && (
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px', maxWidth: '260px' }}>
                          <strong>Comment:</strong> {c.resolutionComment}
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const containerStyle = { maxWidth: '1000px', margin: '40px auto', padding: '32px', background: '#f8fafc', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' };
const headingStyle = { color: '#2563eb', textAlign: 'center', marginBottom: '24px', letterSpacing: '1px', fontWeight: 'bold' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' };
const thTdStyle = { padding: '10px', textAlign: 'center', verticalAlign: 'top' };
const refreshBtnStyle = { background: '#0f172a', color: '#fff', border: 'none', borderRadius: '18px', padding: '6px 16px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' };

export default AdminComplaints;
