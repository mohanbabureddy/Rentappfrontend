import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { url, authFetch, userMoveInDepositUrl } from './apiClient';
import './TenantBills.css';

function TenantBills({ username }) {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingBillId, setPayingBillId] = useState(null); // Track which bill is being paid
  const [moveInInfo, setMoveInInfo] = useState({ moveInDate: null, totalAmountDeposited: 0 });
  const [infoLoading, setInfoLoading] = useState(false);
  const navigate = useNavigate();

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
    (async () => {
      setInfoLoading(true);
      try {
        const res = await authFetch(userMoveInDepositUrl.self(username));
        if (res.ok) {
          const data = await res.json();
          if (!data.error) {
            setMoveInInfo({
              moveInDate: data.moveInDate || null,
              totalAmountDeposited: Number(data.totalAmountDeposited || 0)
            });
          }
        }
      } catch (e) {
        console.warn('Move-in/deposit load failed', e);
      } finally {
        setInfoLoading(false);
      }
    })();
  }, [username, fetchBills, navigate]);

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
          alert(`✅ Payment successful!\nPayment ID: ${response.razorpay_payment_id}`);
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

  if (loading) {
    return <p style={{ textAlign: 'center', marginTop: '40px' }}>Loading bills…</p>;
  }

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
        My Bills
      </h2>

      <div className="bills-summary">
        <div>
          <strong>Move-in Date:</strong>{' '}
          {moveInInfo.moveInDate ? new Date(moveInInfo.moveInDate).toLocaleDateString() : (
            infoLoading ? <em style={{ color:'#64748b' }}>Loading…</em> : <em style={{ color:'#64748b' }}>—</em>
          )}
        </div>
        <div>
          <strong>Total Deposit:</strong>{' '}
          {infoLoading ? '…' : `₹${moveInInfo.totalAmountDeposited}`}
        </div>
      </div>

      {bills.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#64748b' }}>
          No bills found for <strong>{username}</strong>.
        </p>
      ) : (
        <div className="bill-list">
          {bills.map((bill, idx) => {
            const total = Number(bill.rent || 0) + Number(bill.water || 0) + Number(bill.electricity || 0) + Number(bill.miscellaneous || 0);
            return (
              <div className="bill-card" key={bill.id || idx}>
                <div className="bill-card-header">
                  <span className="bill-month">{bill.monthYear}</span>
                  {bill.paid ? (
                    <span className="bill-status-paid">✅ Paid</span>
                  ) : (
                    <button
                      className="bill-pay-btn"
                      onClick={() => payNow(bill)}
                      disabled={payingBillId === bill.id}
                    >
                      {payingBillId === bill.id ? "Processing..." : "Pay"}
                    </button>
                  )}
                </div>
                <div className="bill-breakdown">
                  <div className="bill-item">
                    <span className="bill-item-label">Rent</span>
                    <span className="bill-item-value">₹{bill.rent}</span>
                  </div>
                  <div className="bill-item">
                    <span className="bill-item-label">Water</span>
                    <span className="bill-item-value">₹{bill.water}</span>
                  </div>
                  <div className="bill-item">
                    <span className="bill-item-label">Electricity</span>
                    <span className="bill-item-value">₹{bill.electricity}</span>
                  </div>
                  <div className="bill-item">
                    <span className="bill-item-label">Misc</span>
                    <span className="bill-item-value">₹{bill.miscellaneous || 0}</span>
                  </div>
                </div>
                <div className="bill-total-row">
                  <span className="bill-total-label">Total</span>
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