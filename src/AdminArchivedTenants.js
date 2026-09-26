import React, { useEffect, useState } from 'react';
import { formatDate, formatIfDate } from './dateFormat';
import { authFetch, url } from './apiClient';

function Section({ title, rows, columns }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>{title} ({rows.length})</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={table}>
          <thead>
            <tr>{columns.map(([, label]) => <th key={label} style={th}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 ? '#fff' : '#f8fafc' }}>
                {columns.map(([key]) => <td key={key} style={td}>{formatValue(row[key])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatValue(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(formatIfDate(v));
}

function ArchiveDetail({ data }) {
  return (
    <div style={detailBox}>
      <div style={{ fontSize: 13, color: '#334155' }}>
        <strong>{data.fullName || 'Unnamed'}</strong>
        {data.mail && <> · {data.mail}</>}
        {data.phone && <> · {data.phone}</>}
        {data.moveInDate && <> · Moved in {formatDate(data.moveInDate)}</>}
        {data.demandedDeposit != null && <> · Demanded deposit ₹{data.demandedDeposit}</>}
      </div>
      <Section title="Bills" rows={data.bills} columns={[['monthYear', 'Month'], ['billType', 'Type'], ['rent', 'Rent'], ['water', 'Water'], ['electricity', 'Electricity'], ['miscellaneous', 'Misc'], ['paid', 'Paid'], ['paidDate', 'Paid Date']]} />
      <Section title="Complaints" rows={data.complaints} columns={[['description', 'Description'], ['status', 'Status'], ['createdDate', 'Created'], ['resolutionComment', 'Resolution']]} />
      <Section title="Occupants" rows={data.occupants} columns={[['name', 'Name'], ['verified', 'Verified'], ['uploadedAt', 'Uploaded']]} />
      <Section title="Deposit Payments" rows={data.depositPayments} columns={[['amount', 'Amount'], ['source', 'Source'], ['notes', 'Notes'], ['paidDate', 'Paid Date']]} />
      <Section title="Vacate History" rows={data.vacateRequests} columns={[
        ['requestedDate', 'Requested'], ['vacateDate', 'Move-out'], ['status', 'Status'],
        ['settlementDeduction', 'Deducted'], ['settlementRefundAmount', 'Refunded'], ['settlementRefundMethod', 'Method'],
        ['settlementNote', 'Owner Note'], ['tenantAcknowledged', 'Tenant Confirmed'], ['tenantFeedback', 'Tenant Feedback'],
      ]} />
    </div>
  );
}

export default function AdminArchivedTenants() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(url.adminArchivedTenants());
        if (!res.ok) throw new Error('Could not load archived tenants.');
        setRecords(await res.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div style={box}>
      <h2 style={heading}>Archived Tenants</h2>
      <p style={{ textAlign: 'center', color: '#64748b', fontSize: 13, marginTop: -12, marginBottom: 20 }}>
        Full history of tenants who have moved out and had their username freed up for reuse.
      </p>

      {error && <div style={errBox}>{error}</div>}
      {loading ? (
        <p style={{ textAlign: 'center', color: '#64748b' }}>Loading…</p>
      ) : records.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#64748b' }}>No archived tenants yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {records.map((r) => (
            <div key={r.id} style={row}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <strong>{r.username}</strong>
                  <div style={{ fontSize: 13, color: '#64748b' }}>
                    Archived {r.archivedDate ? formatDate(r.archivedDate) : '—'}
                    {r.archivedBy && <> by {r.archivedBy}</>}
                  </div>
                </div>
                <button type="button" onClick={() => setOpenId(openId === r.id ? null : r.id)} style={secondaryBtn}>
                  {openId === r.id ? 'Hide details' : 'View details'}
                </button>
              </div>
              {openId === r.id && <ArchiveDetail data={r.data} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const box = { maxWidth: 900, margin: '40px auto', padding: 32, background: '#f8fafc', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' };
const heading = { color: '#2563eb', textAlign: 'center', marginBottom: 8, letterSpacing: '1px', fontWeight: 'bold' };
const row = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px' };
const errBox = { background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 6, fontWeight: 600, marginBottom: 12, textAlign: 'center' };
const secondaryBtn = { background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: 999, padding: '8px 18px', fontWeight: 'bold', fontSize: 13, cursor: 'pointer' };
const detailBox = { marginTop: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 };
const table = { width: '100%', minWidth: 420, borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden' };
const th = { padding: 8, background: 'linear-gradient(90deg,#2563eb,#38bdf8)', color: '#fff', textAlign: 'center', fontSize: 12 };
const td = { padding: 6, textAlign: 'center', fontSize: 13, borderBottom: '1px solid #e2e8f0' };
