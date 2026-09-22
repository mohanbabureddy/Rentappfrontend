import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { url, authFetch, userMoveInDepositUrl } from './apiClient';
import './TenantBills.css';

function TenantBills({ username }) {
  const { t } = useTranslation();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingBillId, setPayingBillId] = useState(null); // Track which bill is being paid
  const [moveInInfo, setMoveInInfo] = useState({ moveInDate: null, demandedDeposit: null, totalAmountDeposited: 0, history: [] });
  const [infoLoading, setInfoLoading] = useState(false);
  const [showDepositHistory, setShowDepositHistory] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [payingDeposit, setPayingDeposit] = useState(false);
  const navigate = useNavigate();

  const fetchDepositInfo = useCallback(async () => {
    if (!username) return;
    setInfoLoading(true);
    try {
      const res = await authFetch(userMoveInDepositUrl.self(username));
      if (res.ok) {
        const data = await res.json();
        if (!data.error) {
          setMoveInInfo({
            moveInDate: data.moveInDate || null,
            demandedDeposit: data.demandedDeposit != null ? Number(data.demandedDeposit) : null,
            totalAmountDeposited: Number(data.totalAmountDeposited || 0),
            history: Array.isArray(data.history) ? data.history : []
          });
        }
      }
    } catch (e) {
      console.warn('Move-in/deposit load failed', e);
    } finally {
      setInfoLoading(false);
    }
  }, [username]);

  const fetchBills = useCallback(async () => {
    if (!username) return;
    try {
  const response = await authFetch(url.tenantBills(username));
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      // Normalize miscellaneous field naming (miscellaneous | misc | balance | maintenance | otherCharges)
      const normalized = Array.isArray(data) ? data.map(b => ({
        ...b,
        miscellaneous: b.miscellaneous ?? b.misc ?? b.balance ?? b.maintenance ?? b.otherCharges ?? b.otherCharge ?? b.extra ?? 0
      })) : [];
      setBills(normalized);
    } catch (error) {
      console.error("Error fetching bills:", error);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (!username) {
      // If username missing, force back to login
      navigate('/login', { replace: true });
      return;
    }
    fetchBills();
    fetchDepositInfo();
  }, [username, fetchBills, fetchDepositInfo, navigate]);

  const payNow = async (bill) => {
    // Prevent duplicate payment triggers for the same bill
    if (payingBillId === bill.id) return;
    setPayingBillId(bill.id);

    // The order is created server-side (amount computed from the bill itself, not
    // trusted from the browser) so Razorpay's post-payment signature can later be
    // verified against a specific order/amount instead of just taking our word for it.
    let order;
    try {
      const res = await authFetch(url.createOrder(bill.id), { method: 'POST' });
      order = await res.json();
      if (!res.ok) throw new Error(order.error || `HTTP ${res.status}`);
    } catch (err) {
      alert(`Could not start payment: ${err.message}`);
      setPayingBillId(null);
      return;
    }

    const options = {
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: "Tenant Rent Billing",
      description: `Payment for ${bill.monthYear}`,
      handler: async (response) => {
        try {
          const res = await authFetch(url.markBillPaid(bill.id), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature
            })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
          alert(`✅ ${t('bills.paymentSuccessful')}\n${t('bills.paymentId')}: ${response.razorpay_payment_id}`);
          await authFetch(url.logPaymentSuccess(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantName: username, paymentId: response.razorpay_payment_id })
          });
          fetchBills();
        } catch (err) {
          alert(`Payment could not be verified: ${err.message}`);
          console.error("Error after payment success:", err);
        } finally {
          setPayingBillId(null); // Reset after payment
        }
      },
      prefill: { name: username, email: '', contact: '' },
      theme: { color: "#3399cc" }
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', (resp) => {
      alert(`❌ Payment failed: ${resp.error.description}`);
      authFetch(url.logPaymentFailure(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resp.error)
      });
      setPayingBillId(null); // Reset if failed
    });
    rzp.open();
  };

  const payDeposit = async () => {
    const amount = Number(depositAmount);
    if (!amount || amount <= 0) {
      alert('Enter an amount greater than zero');
      return;
    }
    if (payingDeposit) return;
    setPayingDeposit(true);

    // Same pattern as bill payment: the order amount is decided server-side
    // from what we send here, then re-verified against Razorpay's own order
    // record after payment -- so the amount can't be tampered with in transit.
    let order;
    try {
      const res = await authFetch(userMoveInDepositUrl.createOrder(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      order = await res.json();
      if (!res.ok) throw new Error(order.error || `HTTP ${res.status}`);
    } catch (err) {
      alert(`Could not start payment: ${err.message}`);
      setPayingDeposit(false);
      return;
    }

    const options = {
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: "Tenant Rent Billing",
      description: "Security deposit payment",
      handler: async (response) => {
        try {
          const res = await authFetch(userMoveInDepositUrl.verify(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature
            })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
          alert(`✅ Deposit payment successful!\nPayment ID: ${response.razorpay_payment_id}`);
          setDepositAmount('');
          await fetchDepositInfo();
        } catch (err) {
          alert(`Payment could not be verified: ${err.message}`);
          console.error("Error after deposit payment success:", err);
        } finally {
          setPayingDeposit(false);
        }
      },
      prefill: { name: username, email: '', contact: '' },
      theme: { color: "#3399cc" }
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', (resp) => {
      alert(`❌ Payment failed: ${resp.error.description}`);
      setPayingDeposit(false);
    });
    rzp.open();
  };

  if (loading) {
    return <p style={{ textAlign: 'center', marginTop: '40px' }}>Loading bills…</p>;
  }

  const unpaidBills = bills.filter((b) => !b.paid);

  return (
    <div className="bills-page">
      <h2
        style={{
          color: '#2563eb',
          textAlign: 'center',
          marginBottom: '20px',
          letterSpacing: '1px',
          fontWeight: 'bold',
        }}
      >
        {t('bills.heading')}
      </h2>

      <div className="bills-summary">
        <div>
          <strong>{t('bills.moveInDate')}:</strong>{' '}
          {moveInInfo.moveInDate ? new Date(moveInInfo.moveInDate).toLocaleDateString() : (
            infoLoading ? <em style={{ color:'#64748b' }}>Loading…</em> : <em style={{ color:'#64748b' }}>—</em>
          )}
        </div>
        <div>
          <strong>{t('bills.depositPaid')}:</strong>{' '}
          {infoLoading ? '…' : `₹${moveInInfo.totalAmountDeposited}`}
          {!infoLoading && moveInInfo.demandedDeposit != null && (
            <span style={{ color: '#64748b' }}> / ₹{moveInInfo.demandedDeposit} {t('bills.demanded')}</span>
          )}
        </div>
        {!infoLoading && moveInInfo.demandedDeposit != null && (
          <div>
            {moveInInfo.totalAmountDeposited >= moveInInfo.demandedDeposit ? (
              <span style={{ color: '#16a34a', fontWeight: 600 }}>✅ {t('bills.fullyPaid')}</span>
            ) : (
              <span style={{ color: '#dc2626', fontWeight: 600 }}>
                ₹{(moveInInfo.demandedDeposit - moveInInfo.totalAmountDeposited).toFixed(2)} {t('bills.remaining')}
              </span>
            )}
          </div>
        )}
        <div className="deposit-pay-row">
          <input
            type="number"
            min="1"
            step="0.01"
            placeholder={t('bills.amountPlaceholder')}
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            className="deposit-pay-input"
            disabled={payingDeposit}
          />
          <button
            className="deposit-pay-btn"
            onClick={payDeposit}
            disabled={payingDeposit}
          >
            {payingDeposit ? t('bills.processing') : t('bills.payDeposit')}
          </button>
        </div>
        {moveInInfo.history.length > 0 && (
          <button
            type="button"
            className="deposit-history-toggle"
            onClick={() => setShowDepositHistory(v => !v)}
          >
            {showDepositHistory ? t('bills.hideDepositHistory') : t('bills.viewDepositHistory')} ({moveInInfo.history.length})
          </button>
        )}
        {showDepositHistory && moveInInfo.history.length > 0 && (
          <div className="deposit-history-list">
            {moveInInfo.history.map((entry) => (
              <div className="deposit-history-row" key={entry.id}>
                <span className="deposit-history-date">
                  {entry.paidDate ? new Date(entry.paidDate).toLocaleDateString() : '—'}
                </span>
                <span className="deposit-history-source">
                  {entry.source === 'razorpay' ? t('bills.paidOnline') : t('bills.recordedByAdmin')}
                  {entry.notes ? ` · ${entry.notes}` : ''}
                </span>
                <span className="deposit-history-amount">₹{entry.amount}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {unpaidBills.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#64748b' }}>
          {bills.length === 0 ? (
            <>{t('bills.noBillsAtAll')} <strong>{username}</strong>.</>
          ) : t('bills.noUnpaidBills')}
        </p>
      ) : (
        <div className="bill-list">
          {unpaidBills.map((bill, idx) => {
            const total = Number(bill.rent || 0) + Number(bill.water || 0) + Number(bill.electricity || 0) + Number(bill.miscellaneous || 0);
            const isElectricity = bill.billType === 'ELECTRICITY';
            return (
              <div className="bill-card" key={bill.id || idx}>
                <div className="bill-card-header">
                  <span className="bill-month">
                    {bill.monthYear}
                    <span className="bill-type-tag">{isElectricity ? t('bills.electricityTag') : t('bills.rentTag')}</span>
                  </span>
                  <button
                    className="bill-pay-btn"
                    onClick={() => payNow(bill)}
                    disabled={payingBillId === bill.id}
                  >
                    {payingBillId === bill.id ? t('bills.processing') : t('bills.pay')}
                  </button>
                </div>
                <div className="bill-breakdown">
                  {!isElectricity && (
                    <>
                      <div className="bill-item">
                        <span className="bill-item-label">{t('bills.rent')}</span>
                        <span className="bill-item-value">₹{bill.rent || 0}</span>
                      </div>
                      <div className="bill-item">
                        <span className="bill-item-label">{t('bills.water')}</span>
                        <span className="bill-item-value">₹{bill.water || 0}</span>
                      </div>
                    </>
                  )}
                  {(isElectricity || bill.electricity) && (
                    <div className="bill-item">
                      <span className="bill-item-label">{t('bills.electricity')}</span>
                      <span className="bill-item-value">₹{bill.electricity || 0}</span>
                    </div>
                  )}
                  {!isElectricity && (
                    <div className="bill-item">
                      <span className="bill-item-label">{t('bills.misc')}</span>
                      <span className="bill-item-value">₹{bill.miscellaneous || 0}</span>
                    </div>
                  )}
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
    </div>
  );
}

export default TenantBills;