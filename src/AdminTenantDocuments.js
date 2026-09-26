import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { formatDateTime } from './dateFormat';
import { url, authFetch, openAuthenticatedFile } from './apiClient';

// AdminTenantDocuments
// Groups occupant KYC/doc records by tenant and lets admin browse per-tenant
// Uses existing adminOccupantsAll endpoint to avoid introducing a new API.

export default function AdminTenantDocuments(){
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTenant, setSelectedTenant] = useState('');
  const [q, setQ] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);

  const load = useCallback(async ()=>{
    setLoading(true); setError('');
    try{
      const res = await authFetch(url.adminOccupantsAll());
      if(!res.ok){
        const t = await res.text().catch(()=> '');
        throw new Error(`HTTP ${res.status} ${res.statusText} ${t.slice(0,120)}`);
      }
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (Array.isArray(data.content) ? data.content : []);
      // Normalize important fields
      const norm = arr.map((r, i)=>({
        id: r.id ?? i,
        tenantUsername: r.tenantUsername || '',
        name: r.name || '-',
        aadharFileName: r.aadharFileName || '',
        aadharUrl: r.aadharUrl || '',
        uploadedAt: r.uploadedAt || null,
        verified: !!r.verified
      }));
      setRows(norm);
      if(norm.length && !selectedTenant){
        setSelectedTenant(norm[0].tenantUsername);
      }
    }catch(e){
      const isNet = /Failed to fetch|NetworkError/i.test(e.message);
      setError(isNet ? 'Could not reach the server. Please check your connection and try again.' : e.message);
    }finally{ setLoading(false); }
  }, [selectedTenant]);

  useEffect(()=>{ load(); }, [load]);

  const handleDelete = async (id) => {
    if(!window.confirm('Delete this document? This cannot be undone.')) return;
    setDeletingId(id);
    try{
      const res = await authFetch(url.occupantDelete(id), { method:'DELETE' });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    }catch(e){
      alert(e.message || 'Could not delete');
    }finally{ setDeletingId(null); }
  };

  const handleVerify = async (id) => {
    setVerifyingId(id);
    try{
      const res = await authFetch(url.occupantVerify(id), { method:'PATCH' });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    }catch(e){
      alert(e.message || 'Could not verify');
    }finally{ setVerifyingId(null); }
  };

  const tenants = useMemo(()=>{
    const uniq = new Map();
    rows.forEach(r=>{
      const k = r.tenantUsername || '-';
      uniq.set(k, (uniq.get(k) || 0) + 1);
    });
    return Array.from(uniq.entries())
      .map(([tenant, count])=>({tenant, count}))
      .sort((a,b)=> a.tenant.localeCompare(b.tenant));
  }, [rows]);

  const filteredDocs = useMemo(()=>{
    const base = rows.filter(r=> r.tenantUsername === selectedTenant);
    if(!q.trim()) return base;
    const t = q.toLowerCase();
    return base.filter(r=> (r.name||'').toLowerCase().includes(t) || (r.aadharFileName||'').toLowerCase().includes(t));
  }, [rows, selectedTenant, q]);

  return (
    <div style={wrap}>
      <h2 style={heading}>Tenant Documents</h2>
      {error && <div style={{color:'#b91c1c',marginBottom:12,fontSize:13}}>{error}</div>}
      <div style={layout}> 
        <aside style={sidebar}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <strong style={{color:'#0f172a'}}>Tenants</strong>
            <button onClick={load} disabled={loading} style={refreshBtn}>{loading?'…':'↻'}</button>
          </div>
          <div style={{maxHeight:420,overflowY:'auto'}}>
            {tenants.map(t => (
              <div key={t.tenant}
                   onClick={()=> setSelectedTenant(t.tenant)}
                   style={{
                     padding:'8px 10px',
                     borderRadius:8,
                     marginBottom:6,
                     cursor:'pointer',
                     background: selectedTenant===t.tenant ? '#dbeafe' : '#f1f5f9',
                     color: selectedTenant===t.tenant ? '#1d4ed8' : '#0f172a',
                     display:'flex', justifyContent:'space-between', alignItems:'center',
                   }}>
                <span style={{fontWeight:600}}>{t.tenant || '-'}</span>
                <span style={{fontSize:12,background:'#e2e8f0',color:'#475569',borderRadius:20,padding:'2px 8px'}}>{t.count}</span>
              </div>
            ))}
            {!tenants.length && <div style={{fontSize:13,color:'#64748b'}}>No tenants found.</div>}
          </div>
        </aside>
        <main style={content}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div>
              <div style={{fontSize:12,color:'#64748b'}}>Selected tenant</div>
              <div style={{fontWeight:'bold',color:'#1d4ed8'}}>{selectedTenant || '-'}</div>
            </div>
            <input placeholder="Search by name or file" value={q} onChange={e=>setQ(e.target.value)} style={searchInput}/>
          </div>

          <div style={{fontSize:13,color:'#475569',marginBottom:8}}>{filteredDocs.length} record(s)</div>
          <table style={table}>
            <thead>
              <tr style={{background:'linear-gradient(90deg,#2563eb,#38bdf8)',color:'#fff'}}>
                <th style={thTd}>Name</th>
                <th style={thTd}>File</th>
                <th style={thTd}>Uploaded</th>
                <th style={thTd}>Status</th>
                <th style={thTd}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((r,idx)=> (
                <tr key={r.id || idx} style={{ background: idx%2? '#fff':'#f1f5f9', borderBottom:'1px solid #e2e8f0' }}>
                  <td style={{...thTd,fontWeight:600}}>{r.name}</td>
                  <td style={thTd}>
                    {r.aadharUrl ? (
                      <button
                        onClick={()=>openAuthenticatedFile(r.aadharUrl).catch(e=>alert(e.message || 'Could not open file'))}
                        style={{ background:'none', border:'none', padding:0, color:'#2563eb', fontWeight:600, textDecoration:'underline', cursor:'pointer' }}
                      >
                        {truncate(r.aadharFileName || 'Open', 28)}
                      </button>
                    ) : <em style={{ color:'#94a3b8' }}>N/A</em>}
                  </td>
                  <td style={thTd}>{r.uploadedAt ? formatDateTime(r.uploadedAt) : ''}</td>
                  <td style={thTd}>
                    {r.verified ? (
                      <span style={{ background:'#dcfce7', color:'#166534', padding:'4px 10px', borderRadius:20, fontSize:12, fontWeight:600 }}>VERIFIED</span>
                    ) : (
                      <button
                        onClick={()=>handleVerify(r.id)}
                        disabled={verifyingId===r.id}
                        style={{
                          background:'#fde68a', color:'#92400e', border:'none', borderRadius:20,
                          padding:'4px 10px', fontSize:12, fontWeight:600,
                          cursor: verifyingId===r.id ? 'not-allowed':'pointer',
                          opacity: verifyingId===r.id ? 0.6 : 1
                        }}
                        title="Click to verify this document"
                      >{verifyingId===r.id ? 'Verifying…' : 'PENDING · Verify'}</button>
                    )}
                  </td>
                  <td style={thTd}>
                    <button
                      onClick={()=>handleDelete(r.id)}
                      disabled={deletingId===r.id}
                      style={{
                        background:'#ef4444', color:'#fff', border:'none', borderRadius:6,
                        padding:'6px 14px', fontWeight:'bold',
                        cursor: deletingId===r.id ? 'not-allowed':'pointer',
                        opacity: deletingId===r.id ? 0.6 : 1
                      }}
                    >{deletingId===r.id ? 'Deleting…' : 'Delete'}</button>
                  </td>
                </tr>
              ))}
              {!filteredDocs.length && (
                <tr><td colSpan={5} style={{...thTd,color:'#64748b'}}>No documents for this tenant.</td></tr>
              )}
            </tbody>
          </table>
        </main>
      </div>
    </div>
  );
}

function truncate(str,len){ if(!str) return ''; return str.length>len? str.slice(0,len-1)+'…':str; }

const wrap = { maxWidth:'1100px', margin:'40px auto', padding:'32px', background:'#f8fafc', borderRadius:16, boxShadow:'0 4px 24px rgba(0,0,0,0.08)' };
const heading = { color:'#2563eb', marginBottom:16, textAlign:'center', fontWeight:'bold' };
const layout = { display:'grid', gridTemplateColumns:'260px 1fr', gap:16 };
const sidebar = { background:'#fff', borderRadius:12, padding:12, boxShadow:'0 2px 8px rgba(0,0,0,0.05)' };
const content = { background:'#fff', borderRadius:12, padding:16, boxShadow:'0 2px 8px rgba(0,0,0,0.05)' };
const table = { width:'100%', borderCollapse:'collapse', background:'#fff', borderRadius:12, overflow:'hidden' };
const thTd = { padding:'10px', textAlign:'center', fontSize:14 };
const searchInput = { padding:'10px 14px', border:'1px solid #cbd5e1', borderRadius:8, fontSize:14 };
const refreshBtn = { background:'#38bdf8', color:'#fff', border:'none', borderRadius:8, padding:'6px 10px', fontWeight:'bold', cursor:'pointer' };
