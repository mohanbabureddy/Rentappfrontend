import React, { useState, useEffect } from 'react';
import { API_BASE, API_PREFIX, authFetch } from './apiClient';

// Helper to get previous, current, and next month in YYYY-MM format
function getThreeMonths() {
  const months = [];
  const now = new Date();

  // Previous month
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // Current month
  const curr = new Date(now.getFullYear(), now.getMonth(), 1);
  // Next month
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  [prev, curr, next].forEach(d => {
    const month = d.getMonth() + 1;
    months.push(`${d.getFullYear()}-${month < 10 ? '0' : ''}${month}`);
  });

  return months;
}

const AdminAddBill = () => {
  const recentMonths = getThreeMonths();
  const [formData, setFormData] = useState({
    tenantName: '',
    monthYear: recentMonths[1], // Default to current month
    rent: '',
    water: '',
    electricity: '',
  miscellaneous: '' // optional maintenance / balance / other charges
  });

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    authFetch(`${API_BASE}${API_PREFIX}/users/names`)
      .then(res => res.json())
      .then(data => setTenants(data))
      .catch(err => console.error('Failed to fetch tenants', err));
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
  const res = await authFetch(`${API_BASE}${API_PREFIX}/tenants/addBill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        // Try to read error message from backend
        let msg = 'Failed to add bill';
        try {
          const data = await res.json();
          if (data && data.error) msg = data.error;
        } catch {}
        throw new Error(msg);
      }

      setFormData({
        tenantName: '',
        monthYear: recentMonths[1],
        rent: '',
        water: '',
  electricity: '',
  miscellaneous: ''
      });
      alert('Bill added and email sent!');
    } catch (err) {
      setError(err.message || 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: '400px',
        margin: '40px auto',
        padding: '32px',
        background: '#f8fafc',
        borderRadius: '16px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}
    >
      <h2 style={{ color: '#2563eb', textAlign: 'center', marginBottom: '24px', letterSpacing: '1px' }}>
        Add Bill
      </h2>
      <form onSubmit={handleSubmit}>
        {/* Show loading message */}
        {loading && (
          <div style={{ color: '#2563eb', marginBottom: '12px', textAlign: 'center' }}>
            Adding bill...
          </div>
        )}
        {/* Show error message */}
        {error && (
          <div style={{ color: 'red', marginBottom: '12px', textAlign: 'center' }}>
            {error}
          </div>
        )}
        <select
          name="tenantName"
          value={formData.tenantName}
          onChange={handleChange}
          required
          style={{
            color: formData.tenantName ? '#0f172a' : '#64748b',
            backgroundColor: '#fff',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '10px',
            width: '100%',
            marginBottom: '16px',
            fontSize: '16px',
          }}
        >
          <option value="">Select Tenant</option>
          {tenants.map((tenant, idx) => {
            const name =
              typeof tenant === 'string'
                ? tenant
                : tenant.tenantName || tenant.name || tenant.username || '';
            return (
              <option key={idx} value={name}>
                {name || `Tenant ${idx + 1}`}
              </option>
            );
          })}
        </select>
        <select
          name="monthYear"
          value={formData.monthYear}
          onChange={handleChange}
          required
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '12px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            fontSize: '16px',
            background: '#fff',
            color: '#0f172a',
          }}
        >
          {recentMonths.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          name="rent"
          placeholder="Rent"
          value={formData.rent}
          onChange={handleChange}
          required
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '12px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            fontSize: '16px',
          }}
        />
        <input
          name="water"
          placeholder="Water Bill"
          value={formData.water}
          onChange={handleChange}
          required
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '12px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            fontSize: '16px',
          }}
        />
        <input
          name="electricity"
          placeholder="Electricity Bill"
          value={formData.electricity}
          onChange={handleChange}
          required
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '20px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            fontSize: '16px',
          }}
        />
        <input
          name="miscellaneous"
          placeholder="Miscellaneous / Maintenance (optional)"
          value={formData.miscellaneous}
          onChange={handleChange}
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '20px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            fontSize: '16px',
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            background: 'linear-gradient(90deg, #2563eb 0%, #38bdf8 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            fontSize: '17px',
            letterSpacing: '1px',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Adding...' : 'Add Bill'}
        </button>
      </form>
    </div>
  );
};

export default AdminAddBill;
