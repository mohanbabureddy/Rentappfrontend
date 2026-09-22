import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { url, authFetch } from './apiClient';
import './TenantVacate.css';

const fmt = (iso, locale) => new Date(iso + 'T00:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
const fmtDateTime = (iso, locale) => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '');

const LOCALE_MAP = { en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN', ta: 'ta-IN' };

export default function TenantVacate() {
  const { t, i18n } = useTranslation();
  const locale = LOCALE_MAP[i18n.language] || 'en-IN';
  const [status, setStatus] = useState(undefined); // undefined = loading, null = none, object = request
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [acknowledging, setAcknowledging] = useState(false);

  const load = async () => {
    setError('');
    try {
      const [statusRes, previewRes] = await Promise.all([
        authFetch(url.vacateStatus()),
        authFetch(url.vacatePreview()),
      ]);
      if (statusRes.ok) setStatus(await statusRes.json());
      if (previewRes.ok) setPreview((await previewRes.json()).vacateDate);
    } catch {
      setError('Could not load vacate details. Please try again.');
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const requestVacate = async () => {
    if (!window.confirm(t('vacate.confirmRequest', { date: fmt(preview, locale) }))) return;
    setBusy(true);
    setError('');
    try {
      const res = await authFetch(url.vacateRequest(), { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not submit the request. Please try again.');
      setStatus(data);
    } catch (err) {
      setError(err.message || 'Could not submit the request. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const cancelVacate = async () => {
    if (!window.confirm(t('vacate.confirmCancel'))) return;
    setBusy(true);
    setError('');
    try {
      const res = await authFetch(url.vacateCancel(), { method: 'PUT' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not cancel the request. Please try again.');
      }
      setStatus(null);
      load();
    } catch (err) {
      setError(err.message || 'Could not cancel the request. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const acknowledgeSettlement = async () => {
    setAcknowledging(true);
    setError('');
    try {
      const res = await authFetch(url.vacateAcknowledge(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not submit your confirmation. Please try again.');
      setStatus(data);
      setFeedback('');
    } catch (err) {
      setError(err.message || 'Could not submit your confirmation. Please try again.');
    } finally {
      setAcknowledging(false);
    }
  };

  if (status === undefined) return null; // avoid a flash of empty state while loading

  // Once the owner has approved a request, the tenant can no longer back out
  // unilaterally -- the backend enforces this too (409 if attempted).
  const canCancel = status && status.status === 'PENDING';

  return (
    <div className="vacate-card">
      {error && <div className="vacate-error">{error}</div>}
      {status ? (
        <>
          <div className="vacate-title">
            {status.status === 'PENDING' && t('vacate.pendingTitle')}
            {status.status === 'APPROVED' && t('vacate.approvedTitle')}
            {status.status === 'SETTLED' && t('vacate.settledTitle')}
          </div>
          <div className="vacate-date">{t('vacate.moveOutDate')}: <strong>{fmt(status.vacateDate, locale)}</strong></div>
          <div className="vacate-note">
            {t('vacate.requestedOn', { date: fmt(status.requestedDate, locale) })}{' '}
            {status.approvedDate && t('vacate.approvedOn', { date: fmtDateTime(status.approvedDate, locale) })}
          </div>
          <div className="vacate-note">{t('vacate.noticeNote')}</div>
          <div className="vacate-note">{t('vacate.rentNote')}</div>

          {status.settlement && (
            <div className="vacate-settlement">
              <div className="vacate-title">{t('vacate.settlementTitle')}</div>
              <div className="vacate-settlement-row">
                <span>{t('vacate.deducted')}</span>
                <strong>₹{status.settlement.deduction}</strong>
              </div>
              <div className="vacate-settlement-row">
                <span>{t('vacate.refunded')}</span>
                <strong>₹{status.settlement.refundAmount}</strong>
              </div>
              <div className="vacate-settlement-row">
                <span>{t('vacate.refundMethod')}</span>
                <strong>{t(`vacate.method.${status.settlement.refundMethod}`)}</strong>
              </div>
              {status.settlement.note && (
                <div className="vacate-settlement-row">
                  <span>{t('vacate.settlementNote')}</span>
                  <span>{status.settlement.note}</span>
                </div>
              )}
              <div className="vacate-note">{t('vacate.settledOn', { date: fmtDateTime(status.settlement.settledDate, locale) })}</div>

              {status.settlement.tenantAcknowledged ? (
                <div className="vacate-note vacate-ack-done">
                  {t('vacate.ackConfirmed', { date: fmtDateTime(status.settlement.acknowledgedDate, locale) })}
                </div>
              ) : (
                <div className="vacate-ack-box">
                  <div className="vacate-title">{t('vacate.ackTitle', { amount: status.settlement.refundAmount })}</div>
                  <textarea
                    className="vacate-ack-textarea"
                    placeholder={t('vacate.ackFeedbackPlaceholder')}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    disabled={acknowledging}
                  />
                  <button className="vacate-btn" onClick={acknowledgeSettlement} disabled={acknowledging}>
                    {acknowledging ? t('vacate.ackSubmitting') : t('vacate.ackConfirmButton')}
                  </button>
                </div>
              )}
            </div>
          )}

          {canCancel && (
            <button className="vacate-btn vacate-btn-cancel" onClick={cancelVacate} disabled={busy}>
              {busy ? t('vacate.cancelling') : t('vacate.cancelButton')}
            </button>
          )}
        </>
      ) : (
        <>
          <div className="vacate-title">{t('vacate.planningTitle')}</div>
          {preview && (
            <div className="vacate-note">
              {t('vacate.previewNote', { date: fmt(preview, locale) })}
            </div>
          )}
          <button className="vacate-btn" onClick={requestVacate} disabled={busy || !preview}>
            {busy ? t('vacate.submitting') : t('vacate.requestButton')}
          </button>
        </>
      )}
    </div>
  );
}
