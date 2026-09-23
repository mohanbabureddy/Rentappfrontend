import React, { useEffect, useState } from 'react';
import { authFetch, url } from './apiClient';

const REFUND_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'UPI', label: 'UPI / Mobile' },
];

function SettleForm({ request, onDone, onCancel }) {
  const [deduction, setDeduction] = useState('0');
  const [refundMethod, setRefundMethod] = useState('CASH');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await authFetch(url.adminVacateSettle(request.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deduction: Number(deduction) || 0, refundMethod, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not record the settlement.');
      onDone(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={settleBox}>
      {error && <div style={errBox}>{error}</div>}
      <div style={depositBanner}>
        Total deposit on file for {request.tenantUsername}:{' '}
        <strong>₹{request.depositTotal != null ? request.depositTotal : '—'}</strong>
      </div>
      <label style={fieldLabel}>
        Deduct from deposit for damages (₹)
        <input type="number" min="0" step="0.01" value={deduction} onChange={(e) => setDeduction(e.target.value)} style={input} />
      </label>
      <label style={fieldLabel}>
        Refunded via
        <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} style={input}>
          {REFUND_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </label>
      <label style={fieldLabel}>
        Note (e.g. what was damaged) -- optional
        <textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ ...input, minHeight: 60, resize: 'vertical' }} />
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={submit} disabled={busy} style={primaryBtn}>
          {busy ? 'Saving…' : 'Confirm settlement'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} style={secondaryBtn}>Cancel</button>
      </div>
    </div>
  );
}

export default function AdminVacateRequests() {
  const [requests, setRequests] = useState([]);
  const [settled, setSettled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settlingId, setSettlingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [finalizingId, setFinalizingId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [openRes, settledRes] = await Promise.all([
        authFetch(url.adminVacateAll()),
        authFetch(url.adminVacateSettled()),
      ]);
      if (!openRes.ok) throw new Error('Could not load vacate requests.');
      setRequests(await openRes.json());
      if (settledRes.ok) setSettled(await settledRes.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const finalize = async (r) => {
    if (!window.confirm(
      `Free up "${r.tenantUsername}" for a new tenant?\n\nThis archives all of their bills, complaints, occupants and deposit history, clears the account, and generates a new registration key. This cannot be undone.`
    )) return;
    setFinalizingId(r.id);
    try {
      const res = await authFetch(url.adminVacateFinalize(r.id), { method: 'PUT' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not free up this username.');
      alert(`"${data.username}" is now free for a new tenant.\n\nRegistration key: ${data.registrationKey}\n\nGive this to the new tenant -- they need it to register.`);
      setSettled((rs) => rs.filter((x) => x.id !== r.id));
    } catch (err) {
      alert(err.message);
    } finally {
      setFinalizingId(null);
    }
  };

  const approve = async (id) => {
    setBusyId(id);
    try {
      const res = await authFetch(url.adminVacateApprove(id), { method: 'PUT' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not approve the request.');
      setRequests((rs) => rs.map((r) => (r.id === id ? data : r)));
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const onSettled = (settledData) => {
    setRequests((rs) => rs.filter((r) => r.id !== settlingId));
    setSettled((rs) => [...rs, settledData]);
    setSettlingId(null);
  };

  const pending = requests.filter((r) => r.status === 'PENDING');
  const approved = requests.filter((r) => r.status === 'APPROVED');

  return (
    <div style={box}>
      <h2 style={heading}>Vacate Requests</h2>

      {error && <div style={errBox}>{error}</div>}
      {loading ? (
        <p style={{ textAlign: 'center', color: '#64748b' }}>Loading…</p>
      ) : requests.length === 0 && settled.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#64748b' }}>No open vacate requests right now.</p>
      ) : (
        <>
          <h3 style={sectionHeading}>Awaiting your approval ({pending.length})</h3>
          {pending.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 14 }}>Nothing waiting on you.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {pending.map((r) => (
                <div key={r.id} style={row}>
                  <div>
                    <strong>{r.tenantUsername}</strong>
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                      Requested {r.requestedDate} · Proposed move-out {r.vacateDate}
                    </div>
                  </div>
                  <button type="button" onClick={() => approve(r.id)} disabled={busyId === r.id} style={primaryBtn}>
                    {busyId === r.id ? 'Approving…' : 'Approve'}
                  </button>
                </div>
              ))}
            </div>
          )}

          <h3 style={sectionHeading}>Approved -- awaiting move-out ({approved.length})</h3>
          {approved.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 14 }}>Nobody is currently approved to move out.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {approved.map((r) => (
                <div key={r.id} style={{ ...row, flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <strong>{r.tenantUsername}</strong>
                      <div style={{ fontSize: 13, color: '#64748b' }}>
                        Move-out date <strong>{r.vacateDate}</strong> · Rent still billed as usual until then
                      </div>
                      <div style={{ fontSize: 13, color: '#0f172a', marginTop: 2 }}>
                        Deposit on file: <strong>₹{r.depositTotal != null ? r.depositTotal : '—'}</strong>
                      </div>
                    </div>
                    {settlingId !== r.id && (
                      <button type="button" onClick={() => setSettlingId(r.id)} style={primaryBtn}>Record settlement</button>
                    )}
                  </div>
                  {settlingId === r.id && (
                    <SettleForm request={r} onDone={onSettled} onCancel={() => setSettlingId(null)} />
                  )}
                </div>
              ))}
            </div>
          )}

          <h3 style={{ ...sectionHeading, marginTop: 24 }}>Settled -- ready to free up ({settled.length})</h3>
          {settled.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 14 }}>No settled move-outs waiting to be freed up.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {settled.map((r) => {
                const acknowledged = !!r.settlement?.tenantAcknowledged;
                const openComplaints = r.openComplaints || 0;
                const unverifiedOccupants = r.unverifiedOccupants || 0;
                const unpaidBills = r.unpaidBills || 0;
                const blockers = [];
                if (!acknowledged) blockers.push('waiting for tenant to confirm the refund');
                if (openComplaints > 0) blockers.push(`${openComplaints} complaint(s) still open`);
                if (unverifiedOccupants > 0) blockers.push(`${unverifiedOccupants} occupant photo(s) not verified`);
                if (unpaidBills > 0) blockers.push(`${unpaidBills} bill(s) still unpaid`);
                const canFreeUp = blockers.length === 0;
                return (
                  <div key={r.id} style={row}>
                    <div>
                      <strong>{r.tenantUsername}</strong>
                      <div style={{ fontSize: 13, color: '#64748b' }}>
                        Moved out {r.vacateDate} · Refunded ₹{r.settlement?.refundAmount} via {r.settlement?.refundMethod}
                      </div>
                      <div style={{ fontSize: 13, marginTop: 4, color: acknowledged ? '#166534' : '#92400e', fontWeight: 600 }}>
                        {acknowledged ? '✅ Tenant confirmed receiving the refund' : '⏳ Waiting for tenant to confirm'}
                      </div>
                      <div style={{ fontSize: 13, marginTop: 2, color: openComplaints > 0 ? '#92400e' : '#166534', fontWeight: 600 }}>
                        {openComplaints > 0 ? `⏳ ${openComplaints} complaint(s) still open` : '✅ All complaints closed'}
                      </div>
                      <div style={{ fontSize: 13, marginTop: 2, color: unverifiedOccupants > 0 ? '#92400e' : '#166534', fontWeight: 600 }}>
                        {unverifiedOccupants > 0 ? `⏳ ${unverifiedOccupants} occupant photo(s) not verified` : '✅ All occupant photos verified'}
                      </div>
                      <div style={{ fontSize: 13, marginTop: 2, color: unpaidBills > 0 ? '#dc2626' : '#166534', fontWeight: 600 }}>
                        {unpaidBills > 0 ? `⏳ ${unpaidBills} bill(s) still unpaid -- tenant must pay first` : '✅ All bills paid'}
                      </div>
                      {r.settlement?.tenantFeedback && (
                        <div style={{ fontSize: 13, color: '#334155', marginTop: 4, fontStyle: 'italic' }}>
                          "{r.settlement.tenantFeedback}"
                        </div>
                      )}
                    </div>
                    {canFreeUp ? (
                      <button type="button" onClick={() => finalize(r)} disabled={finalizingId === r.id} style={primaryBtn}>
                        {finalizingId === r.id ? 'Freeing up…' : 'Free up this username'}
                      </button>
                    ) : (
                      <span style={{ fontSize: 13, color: '#92400e', maxWidth: 180, textAlign: 'right' }}>
                        Can't free up yet -- {blockers.join(', ')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const box = { maxWidth: 900, margin: '40px auto', padding: 32, background: '#f8fafc', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' };
const heading = { color: '#2563eb', textAlign: 'center', marginBottom: 24, letterSpacing: '1px', fontWeight: 'bold' };
const sectionHeading = { color: '#0f172a', margin: '0 0 10px' };
const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', flexWrap: 'wrap' };
const errBox = { background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 6, fontWeight: 600, marginBottom: 12, textAlign: 'center' };
const primaryBtn = { background: 'linear-gradient(90deg,#2563eb,#38bdf8)', color: '#fff', border: 'none', borderRadius: 999, padding: '8px 18px', fontWeight: 'bold', fontSize: 13, cursor: 'pointer' };
const secondaryBtn = { background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: 999, padding: '8px 18px', fontWeight: 'bold', fontSize: 13, cursor: 'pointer' };
const settleBox = { marginTop: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 };
const depositBanner = { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: 8, padding: '8px 12px', fontSize: 14 };
const fieldLabel = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600, color: '#334155' };
const input = { padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, background: '#fff', color: '#0f172a', fontWeight: 400 };
