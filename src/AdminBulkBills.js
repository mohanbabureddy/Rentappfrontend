import React, { useState } from 'react';
import { API_BASE, API_PREFIX, authFetch } from './apiClient';

const BASE = `${API_BASE}${API_PREFIX}/tenants`;

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const KINDS = {
  rent: {
    title: 'Rent bills',
    columns: 'Username, Rent, Water, Miscellaneous',
    hint: 'Rent is required. Water and Miscellaneous are optional. No electricity here.',
  },
  electricity: {
    title: 'Electricity bills',
    columns: 'Username, Electricity Bill Amount',
    hint: 'Only the electricity amount for each room. No rent here.',
  },
};

const BADGE = {
  ok: { bg: '#dbeafe', fg: '#1e40af', label: 'Ready' },
  added: { bg: '#dcfce7', fg: '#166534', label: 'Added' },
  duplicate: { bg: '#fef3c7', fg: '#92400e', label: 'Skipped' },
  error: { bg: '#fee2e2', fg: '#991b1b', label: 'Error' },
};

export default function AdminBulkBills() {
  const [kind, setKind] = useState('rent');
  const [file, setFile] = useState(null);
  const [month, setMonth] = useState(currentMonth());
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setResult(null); setError(''); };

  const chooseKind = (k) => {
    setKind(k);
    setFile(null);
    reset();
    const input = document.getElementById('bulk-file');
    if (input) input.value = '';
  };

  const send = async (dryRun) => {
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);
      form.append('month', month);
      form.append('dryRun', dryRun ? 'true' : 'false');
      const res = await authFetch(`${BASE}/bulkBills`, { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Upload failed (HTTP ${res.status})`);
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const importNow = () => {
    const n = result?.summary?.ok || 0;
    if (!window.confirm(`Add ${n} ${kind} bill(s) for ${month} and email each tenant? This cannot be undone in bulk.`)) return;
    send(false);
  };

  const downloadTemplate = async () => {
    setError('');
    try {
      const res = await authFetch(`${BASE}/bulkBills/template?type=${kind}`);
      if (!res.ok) throw new Error('Could not download the template');
      const blobUrl = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `bills-${kind}-template.xlsx`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err.message);
    }
  };

  const summary = result?.summary || {};
  const readyCount = summary.ok || 0;
  const imported = result && result.dryRun === false;
  const info = KINDS[kind];
  // Each amount has its own column; the total is worked out on the bill itself.
  const amountColumns = kind === 'rent'
    ? [{ key: 'rent', label: 'Rent' }, { key: 'water', label: 'Water' }, { key: 'miscellaneous', label: 'Miscellaneous' }]
    : [{ key: 'electricity', label: 'Electricity' }];

  return (
    <div style={box}>
      <h2 style={heading}>Bulk Upload Bills</h2>
      <p style={note}>
        Rent and electricity are uploaded separately. Each bill is saved and emailed to the tenant on its own.
        Nothing is saved until you press Import.
      </p>

      <div style={{ ...row, justifyContent: 'center' }}>
        {Object.entries(KINDS).map(([k, v]) => (
          <button key={k} type="button" onClick={() => chooseKind(k)} style={kind === k ? tabOn : tabOff}>{v.title}</button>
        ))}
      </div>

      <div style={infoBox}>
        <div><strong>Columns:</strong> {info.columns}</div>
        <div style={{ color: '#64748b' }}>{info.hint}</div>
        <button type="button" style={{ ...btnLight, marginTop: 10 }} onClick={downloadTemplate}>
          Download {info.title.toLowerCase()} template
        </button>
      </div>

      <div style={row}>
        <label style={label}>
          Month for every row
          <input id="bulk-month" type="month" value={month} onChange={e => { setMonth(e.target.value); reset(); }} style={input} />
        </label>
        <label style={label}>
          {info.title} file (.xlsx or .csv)
          <input
            id="bulk-file"
            type="file"
            accept=".xlsx,.csv"
            onChange={e => { setFile(e.target.files?.[0] || null); reset(); }}
            style={input}
          />
        </label>
        <button type="button" style={btnPrimary} disabled={!file || !month || busy} onClick={() => send(true)}>
          {busy && !imported ? 'Checking…' : 'Preview'}
        </button>
      </div>

      {error && <div style={errBox}>{error}</div>}

      {result && (
        <>
          <div style={summaryBar}>
            {imported ? 'Import finished' : 'Preview'} for {month}:{' '}
            {Object.entries(summary).map(([k, v]) => `${v} ${(BADGE[k] || { label: k }).label.toLowerCase()}`).join(', ')}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={table}>
              <thead>
                <tr>{['Row', 'Username', ...amountColumns.map(c => c.label), 'Status', 'Details'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {result.rows.map((r, i) => {
                  const b = BADGE[r.status] || BADGE.error;
                  return (
                    <tr key={i} style={{ background: i % 2 ? '#fff' : '#f1f5f9' }}>
                      <td style={td}>{r.row}</td>
                      <td style={td}>{r.tenant || '-'}</td>
                      {amountColumns.map(c => (
                        <td key={c.key} style={td}>{r[c.key] != null ? `₹${r[c.key]}` : '-'}</td>
                      ))}
                      <td style={td}><span style={{ background: b.bg, color: b.fg, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{b.label}</span></td>
                      <td style={{ ...td, textAlign: 'left' }}>{r.message}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!imported && (
            <div style={{ marginTop: 16 }}>
              <button type="button" style={btnPrimary} disabled={!readyCount || busy} onClick={importNow}>
                {busy ? 'Importing…' : readyCount ? `Import ${readyCount} ${kind} bill(s) and send emails` : 'Nothing to import'}
              </button>
              {readyCount > 0 && (summary.error || summary.duplicate) ? (
                <span style={{ marginLeft: 12, fontSize: 13, color: '#64748b' }}>Rows with errors or duplicates will be skipped.</span>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const box = { maxWidth: 1000, margin: '40px auto', padding: 32, background: '#f8fafc', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' };
const heading = { color: '#2563eb', textAlign: 'center', marginBottom: 12, letterSpacing: '1px', fontWeight: 'bold' };
const note = { color: '#475569', fontSize: 14, textAlign: 'center', margin: '0 0 20px' };
const row = { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 };
const label = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600, color: '#334155' };
const input = { padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, background: '#fff' };
const btnPrimary = { background: 'linear-gradient(90deg,#2563eb,#38bdf8)', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 20px', fontWeight: 'bold', fontSize: 14, cursor: 'pointer' };
const btnLight = { background: '#f1f5f9', color: '#2563eb', border: '1px solid #2563eb', borderRadius: 6, padding: '9px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const tabBase = { padding: '9px 22px', borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: 'pointer', border: '1px solid #2563eb' };
const tabOn = { ...tabBase, background: 'linear-gradient(90deg,#2563eb,#38bdf8)', color: '#fff' };
const tabOff = { ...tabBase, background: '#fff', color: '#2563eb' };
const infoBox = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#0f172a', marginBottom: 16 };
const errBox = { background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 6, fontWeight: 600, marginBottom: 12 };
const summaryBar = { background: '#e0f2fe', color: '#075985', padding: '10px 14px', borderRadius: 6, fontWeight: 600, margin: '8px 0 12px' };
const table = { width: '100%', minWidth: 640, borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden' };
const th = { padding: 10, background: 'linear-gradient(90deg,#2563eb,#38bdf8)', color: '#fff', textAlign: 'center', fontSize: 13 };
const td = { padding: 8, textAlign: 'center', fontSize: 13, borderBottom: '1px solid #e2e8f0' };
