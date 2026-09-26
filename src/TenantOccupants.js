import React, { useEffect, useState, useCallback } from 'react';
import { formatDateTime } from './dateFormat';
import { url, authFetch, openAuthenticatedFile } from './apiClient';

/*
  TenantOccupants component
  Purpose: Allow a tenant to maintain a sub‑list of occupants (family members / flatmates) with
           each person's name and their Aadhaar card file.

  Assumed backend REST API (adjust if your backend differs):
    GET    /api/tenants/occupants/{tenantName}
            -> [ { id, name, aadharFileName, aadharUrl, uploadedAt } ]
    POST   /api/tenants/occupants/{tenantName}
            (multipart/form-data: name, file) -> { id, name, aadharFileName, aadharUrl, uploadedAt }
    DELETE /api/tenants/occupants/{id}

  Notes:
    - Aadhaar file types restricted to PDF / JPEG / PNG. (Front-end validation only.)
    - Max file size default 2 MB (change MAX_FILE_MB below).
    - If backend does not yet exist, the UI will show a friendly error when calls fail.
*/

const MAX_FILE_MB = 2;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export default function TenantOccupants({ username }) {
  const [items, setItems] = useState([]); // existing occupants
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [formName, setFormName] = useState('');
  const [formFile, setFormFile] = useState(null);
  const [uploadMsg, setUploadMsg] = useState(null);
  // Preview removed; expecting optional 'verified' flag from backend for lock logic

  const load = useCallback(async () => {
    if (!username) return;
    setLoading(true); setError('');
    try {
      const res = await authFetch(url.occupantsList(username));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (Array.isArray(data.content) ? data.content : []);
      const sorted = arr.slice().sort((a,b)=>{
        const ad = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
        const bd = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
        if (bd !== ad) return bd - ad;
        if (typeof b.id === 'number' && typeof a.id === 'number') return b.id - a.id;
        return 0;
      });
      setItems(sorted);
    } catch (e) {
      const network = /Failed to fetch|NetworkError/i.test(e.message);
      setError(network ? 'Could not reach the server. Please check your connection and try again.' : e.message);
    }
    setLoading(false);
  }, [username]);

  useEffect(()=>{ load(); }, [load]);

  if (!username) {
    return (
      <div style={wrapper}>
        <h2 style={heading}>Occupants & Aadhaar</h2>
        <p style={{ color:'#475569', marginTop:-12, marginBottom:24, fontSize:14 }}>
          Tenant username is missing. Please log in again to view your occupant records.
        </p>
      </div>
    );
  }

  const resetForm = () => { setFormName(''); setFormFile(null); const f = document.getElementById('aadhar-file-input'); if (f) f.value=''; };

  const validate = () => {
    if (!formName.trim()) return 'Name required';
    if (!formFile) return 'Aadhaar file required';
    if (!ALLOWED_TYPES.includes(formFile.type)) return 'Only PDF / JPG / PNG allowed';
    if (formFile.size > MAX_FILE_MB * 1024 * 1024) {
      const isPdf = formFile.type === 'application/pdf';
      return isPdf ? `PDF must be <= ${MAX_FILE_MB}MB` : `File too large (>${MAX_FILE_MB}MB)`;
    }
    return null;
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setUploadMsg(null);
    const v = validate();
    if (v) { setUploadMsg({ type:'error', text: v }); return; }
    setAdding(true);
    try {
      const fd = new FormData();
      fd.append('name', formName.trim());
      fd.append('file', formFile);
      const res = await authFetch(url.occupantsList(username), { method:'POST', body: fd });
      if (!res.ok) {
        let extra='';
        try { const j=await res.json(); extra = j.message || j.error || ''; } catch {}
        throw new Error(extra || `HTTP ${res.status}`);
      }
      setUploadMsg({ type:'success', text:'Uploaded successfully.' });
      await load();
      resetForm();
    } catch (e) {
      console.error(e);
      setUploadMsg({ type:'error', text: /Failed to fetch|NetworkError/i.test(e.message) ? 'Could not reach the server. Please check your connection and try again.' : e.message });
    } finally { setAdding(false); }
  };

  return (
    <div style={wrapper}>
      <h2 style={heading}>Occupants & Aadhaar</h2>
      <p style={{ color:'#475569', marginTop:-12, marginBottom:24, fontSize:14 }}>
        Add household members or sub‑tenants with their Aadhaar card for record keeping.
      </p>

      <form onSubmit={handleAdd} style={formRow}>
        <input
          placeholder="Full Name"
          value={formName}
          onChange={e=>setFormName(e.target.value)}
          style={input}
          disabled={adding}
        />
        <input
          id="aadhar-file-input"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={e=>setFormFile(e.target.files?.[0]||null)}
            style={fileInput}
            disabled={adding}
        />
        <button type="submit" disabled={adding} style={primaryBtn}>{adding?'Uploading…':'Add'}</button>
        <button type="button" onClick={resetForm} disabled={adding} style={secondaryBtn}>Reset</button>
      </form>
      {uploadMsg && (
        <div style={{
          marginTop:12,
          padding:'10px 14px',
          borderRadius:6,
          background: uploadMsg.type==='success'? '#dcfce7':'#fee2e2',
          color: uploadMsg.type==='success'? '#166534':'#991b1b',
          fontWeight:'bold',
          fontSize:14
        }}>{uploadMsg.text}</div>
      )}

      <div style={{ marginTop:32 }}>
        <div style={{ marginBottom:12 }}>
          <h3 style={{ ...heading, fontSize:20, margin:0 }}>Existing Occupants {items.length>0 && <span style={{fontSize:14,color:'#475569'}}>({items.length})</span>}</h3>
        </div>
  {error && <div style={{ color:'#b91c1c', marginBottom:12 }}>{error}</div>}
        {loading ? <p>Loading…</p> : (!error && items.length === 0 ? <p style={{ color:'#64748b' }}>No occupants added yet.</p> : (
          <table style={table}>
            <thead>
              <tr style={{ background:'linear-gradient(90deg,#2563eb,#38bdf8)', color:'#fff' }}>
                <th style={thTd}>Name</th>
                <th style={thTd}>Aadhaar File</th>
                <th style={thTd}>Uploaded</th>
                <th style={thTd}>Verification Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx)=>{
                const fileName = it.aadharFileName || '';
                const verified = !!it.verified;
                return (
                  <tr key={it.id || idx} style={{ background:'#fff', borderBottom:'1px solid #e2e8f0' }}>
                    <td style={{ ...thTd, fontWeight:500 }}>{it.name}</td>
                    <td style={thTd}>
                      {it.aadharUrl ? (
                        <button
                          onClick={()=>openAuthenticatedFile(it.aadharUrl).catch(e=>alert(e.message || 'Could not open file'))}
                          title={fileName || 'Open'}
                          style={{ background:'none', border:'none', padding:0, color:'#2563eb', textDecoration:'underline', fontWeight:600, cursor:'pointer' }}
                        >
                          {truncate(fileName || 'Open File', 28)}
                        </button>
                      ) : (
                        <em style={{ color:'#94a3b8' }}>{fileName || 'N/A'}</em>
                      )}
                    </td>
                    <td style={thTd}>{it.uploadedAt ? formatDateTime(it.uploadedAt): ''}</td>
                    <td style={thTd}>
                      {verified ? (
                        <span style={{ display:'inline-block', padding:'4px 10px', borderRadius:20, background:'#dcfce7', color:'#166534', fontWeight:600, fontSize:12 }}>VERIFIED</span>
                      ) : (
                        <span style={{ display:'inline-block', padding:'4px 10px', borderRadius:20, background:'#fde68a', color:'#92400e', fontWeight:600, fontSize:12 }}>PENDING</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  );
}

// Helpers & styles
function truncate(str, len){ if(!str) return ''; return str.length>len? str.slice(0,len-1)+'…':str; }

const wrapper = {
  maxWidth:'900px', margin:'40px auto', padding:'32px', background:'#f8fafc', borderRadius:16, boxShadow:'0 4px 24px rgba(0,0,0,0.08)'
};
const heading = { color:'#2563eb', textAlign:'center', marginBottom:24, letterSpacing:'1px', fontWeight:'bold' };
const formRow = { display:'flex', flexWrap:'wrap', gap:'12px', alignItems:'center' };
const input = { flex:'1 1 200px', padding:'12px 14px', fontSize:15, borderRadius:8, border:'1px solid #cbd5e1' };
const fileInput = { flex:'1 1 260px', padding:'10px', fontSize:14, border:'1px solid #cbd5e1', borderRadius:8, background:'#fff' };
const primaryBtn = { background:'linear-gradient(90deg,#2563eb,#38bdf8)', color:'#fff', border:'none', borderRadius:6, padding:'10px 20px', fontWeight:'bold', fontSize:15, cursor:'pointer' };
const secondaryBtn = { background:'#e2e8f0', color:'#334155', border:'none', borderRadius:6, padding:'10px 20px', fontWeight:'bold', fontSize:14, cursor:'pointer' };
const table = { width:'100%', borderCollapse:'collapse', background:'#fff', borderRadius:12, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.04)', marginTop:16 };
const thTd = { padding:'10px', textAlign:'center', fontSize:14 };
