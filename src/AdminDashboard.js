import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE, API_PREFIX, authFetch } from './apiClient';
import { forMonth, percent, rupees, summarize, unpaidList } from './dashboardStats';

const BASE = `${API_BASE}${API_PREFIX}/tenants`;

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function StatCard({ title, accent, group }) {
  const pct = percent(group.collected, group.raised);
  return (
    <div style={{ ...card, borderTop: `4px solid ${accent}` }}>
      <div style={cardTitle}>{title}</div>
      <div style={rowBetween}>
        <span style={muted}>Raised (to collect)</span>
        <strong style={{ fontSize: 22 }}>{rupees(group.raised)}</strong>
      </div>
      <div style={rowBetween}>
        <span style={muted}>Collected so far</span>
        <strong style={{ color: '#16a34a', fontSize: 18 }}>{rupees(group.collected)}</strong>
      </div>
      <div style={rowBetween}>
        <span style={muted}>Pending</span>
        <strong style={{ color: group.pending > 0 ? '#dc2626' : '#64748b', fontSize: 18 }}>{rupees(group.pending)}</strong>
      </div>
      <div style={barTrack} aria-label={`${pct}% collected`}>
        <div style={{ ...barFill, width: `${pct}%`, background: accent }} />
      </div>
      <div style={{ ...rowBetween, fontSize: 12, color: '#64748b' }}>
        <span>{pct}% collected</span>
        <span>{group.paidCount} of {group.count} bills paid</span>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [bills, setBills] = useState([]);
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch(`${BASE}/all`);
      if (!res.ok) throw new Error('Could not load the bills');
      setBills(await res.json());
    } catch (err) {
      setError(err.message || 'Could not load the bills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const months = useMemo(() => Array.from(new Set(bills.map((b) => b.monthYear))).sort().reverse(), [bills]);
  const scoped = useMemo(() => forMonth(bills, month), [bills, month]);
  const stats = useMemo(() => summarize(scoped), [scoped]);
  const unpaid = useMemo(() => unpaidList(scoped), [scoped]);

  return (
    <div style={box}>
      <h2 style={heading}>Dashboard</h2>

      <div style={{ ...rowBetween, justifyContent: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>
          Month{' '}
          <select id="dash-month" value={month} onChange={(e) => setMonth(e.target.value)} style={select}>
            <option value="">All months</option>
            {[...new Set([currentMonth(), ...months])].sort().reverse().map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={load} disabled={loading} style={refreshBtn}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>

      {error && <div style={errBox}>{error}</div>}

      {!loading && !error && stats.all.count === 0 ? (
        <p style={{ textAlign: 'center', color: '#64748b' }}>
          No bills raised for {month || 'any month'} yet. Add them from Add Bill or Bulk Bills.
        </p>
      ) : (
        <>
          <div style={grid}>
            <StatCard title="Rent bills" accent="#2563eb" group={stats.rent} />
            <StatCard title="Electricity bills" accent="#f59e0b" group={stats.electricity} />
          </div>

          <div style={totalBar}>
            <strong>Both together:</strong>{' '}
            raised {rupees(stats.all.raised)} · collected <span style={{ color: '#16a34a', fontWeight: 700 }}>{rupees(stats.all.collected)}</span> · pending{' '}
            <span style={{ color: stats.all.pending > 0 ? '#dc2626' : '#64748b', fontWeight: 700 }}>{rupees(stats.all.pending)}</span>
          </div>

          <h3 style={{ color: '#2563eb', margin: '24px 0 10px' }}>Still to collect ({unpaid.length})</h3>
          {unpaid.length === 0 ? (
            <p style={{ color: '#16a34a', fontWeight: 600 }}>Everything for {month || 'these months'} has been collected.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={table}>
                <thead>
                  <tr>{['Tenant', ...(month ? [] : ['Month']), 'Bill', 'Amount'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {unpaid.map((u, i) => (
                    <tr key={`${u.tenant}-${u.month}-${u.type}`} style={{ background: i % 2 ? '#fff' : '#f1f5f9' }}>
                      <td style={td}>{u.tenant}</td>
                      {!month && <td style={td}>{u.month}</td>}
                      <td style={td}>
                        <span style={{ ...tag, background: u.type === 'electricity' ? '#fef3c7' : '#dbeafe', color: u.type === 'electricity' ? '#92400e' : '#1e40af' }}>
                          {u.type === 'electricity' ? 'Electricity' : 'Rent'}
                        </span>
                      </td>
                      <td style={td}>{rupees(u.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const box = { maxWidth: 1000, margin: '40px auto', padding: 32, background: '#f8fafc', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' };
const heading = { color: '#2563eb', textAlign: 'center', marginBottom: 16, letterSpacing: '1px', fontWeight: 'bold' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 };
const card = { background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 10 };
const cardTitle = { fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: '0.3px' };
const rowBetween = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 };
const muted = { fontSize: 14, color: '#475569' };
const barTrack = { height: 10, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' };
const barFill = { height: '100%', borderRadius: 999, transition: 'width 0.3s' };
const totalBar = { marginTop: 16, background: '#e0f2fe', color: '#075985', padding: '10px 14px', borderRadius: 8, fontSize: 14 };
const select = { padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, background: '#fff', color: '#0f172a' };
const refreshBtn = { background: '#0f172a', color: '#fff', border: 'none', borderRadius: 18, padding: '7px 16px', fontWeight: 'bold', fontSize: 13, cursor: 'pointer' };
const errBox = { background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 6, fontWeight: 600, marginBottom: 12, textAlign: 'center' };
const table = { width: '100%', minWidth: 420, borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden' };
const th = { padding: 10, background: 'linear-gradient(90deg,#2563eb,#38bdf8)', color: '#fff', textAlign: 'center', fontSize: 13 };
const td = { padding: 8, textAlign: 'center', fontSize: 14, borderBottom: '1px solid #e2e8f0' };
const tag = { padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 };
