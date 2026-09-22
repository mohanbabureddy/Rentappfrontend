import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { url, authFetch } from './apiClient';
import './TenantBills.css';

export default function TenantBillsHistory({ username }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBills = useCallback(async () => {
    if (!username) return;
    try {
      const response = await authFetch(url.tenantBills(username));
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      const normalized = Array.isArray(data) ? data.map((b) => ({
        ...b,
        miscellaneous: b.miscellaneous ?? b.misc ?? b.balance ?? b.maintenance ?? b.otherCharges ?? b.otherCharge ?? b.extra ?? 0,
      })) : [];
      setBills(normalized.filter((b) => b.paid));
    } catch (error) {
      console.error('Error fetching bill history:', error);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (!username) {
      navigate('/login', { replace: true });
      return;
    }
    fetchBills();
  }, [username, fetchBills, navigate]);

  if (loading) {
    return <p style={{ textAlign: 'center', marginTop: '40px' }}>Loading…</p>;
  }

  return (
    <div className="bills-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 8 }}>
        <h2 style={{ color: '#2563eb', textAlign: 'center', letterSpacing: '1px', fontWeight: 'bold', margin: 0 }}>
          {t('history.heading')}
        </h2>
      </div>
      <p style={{ textAlign: 'center', color: '#64748b', marginBottom: 20 }}>{t('history.subheading')}</p>

      {bills.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#64748b' }}>{t('history.empty')}</p>
      ) : (
        <div className="bill-list">
          {bills.map((bill, idx) => {
            const total = Number(bill.rent || 0) + Number(bill.water || 0) + Number(bill.electricity || 0) + Number(bill.miscellaneous || 0);
            const isElectricity = bill.billType === 'ELECTRICITY';
            return (
              <div className="bill-card" key={bill.id || idx}>
                <div className="bill-card-header">
                  <span className="bill-month">
                    {bill.monthYear}
                    <span className="bill-type-tag">{isElectricity ? t('bills.electricityTag') : t('bills.rentTag')}</span>
                  </span>
                  <span className="bill-status-paid">
                    ✅ {t('bills.paid')}{bill.paidDate ? ` · ${t('history.paidOn')} ${new Date(bill.paidDate).toLocaleDateString()}` : ''}
                  </span>
                </div>
                <div className="bill-total-row">
                  <span className="bill-total-label">{t('bills.total')}</span>
                  <span className="bill-total-value">₹{total}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <Link to="/" className="bills-history-link">{t('history.back')}</Link>
      </div>
    </div>
  );
}
