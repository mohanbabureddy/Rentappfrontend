import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE as BASE_FROM_CLIENT, API_PREFIX, authFetch } from './apiClient';

const API_BASE = `${BASE_FROM_CLIENT}${API_PREFIX}/tenants`;

const styles = {
  container: {
    maxWidth: '1000px',
    margin: '40px auto',
    padding: '32px',
    background: '#f8fafc',
    borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  },
  header: {
    color: '#2563eb',
    textAlign: 'center',
    marginBottom: '24px',
    letterSpacing: '1px',
    fontWeight: 'bold',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    minWidth: '700px',
    borderCollapse: 'collapse',
    background: '#fff',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  th: {
    padding: '12px',
    background: 'linear-gradient(90deg, #2563eb 0%, #38bdf8 100%)',
    color: '#fff',
    minWidth: '80px',
    textAlign: 'center',
  },
  td: {
    padding: '10px',
    textAlign: 'center',
  },
  input: {
    padding: '6px',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    fontSize: '15px',
    maxWidth: '120px',
  },
  btn: {
    marginRight: '6px',
    padding: '6px 14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    borderRadius: '4px',
  },
  btnSave:   { background: 'linear-gradient(90deg, #2563eb 0%, #38bdf8 100%)', color: '#fff' },
  btnCancel: { background: '#f1f5f9', color: '#2563eb', border: '1px solid #2563eb' },
  btnEdit:   { background: '#38bdf8', color: '#fff' },
  btnDelete: { background: '#ef4444', color: '#fff' },
  loading:  { textAlign: 'center', margin: '20px 0' },
  error:    { color: 'red', textAlign: 'center', margin: '20px 0' },
};

export default function AdminViewBills() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({
    tenantName: '',
    monthYear: '',
    rent: '',
    water: '',
  electricity: '',
  miscellaneous: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auth guard: only ADMINs allowed
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) return navigate('/login', { replace: true });
    const { role } = JSON.parse(stored);
    if (role !== 'ADMIN') navigate('/', { replace: true });
  }, [navigate]);

  // Fetch all bills
  const fetchBills = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch(`${API_BASE}/all`);
      if (!res.ok) throw new Error('Failed to fetch bills');
  setBills(await res.json());
    } catch (err) {
      console.error(err);
      setError('Unable to load bills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  // Handlers
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this bill?')) return;
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/deleteBill/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      await fetchBills();
    } catch (err) {
      console.error(err);
      alert('Error deleting bill');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (b) => {
    setEditId(b.id);
    setEditForm({
      tenantName: b.tenantName,
      monthYear:  b.monthYear,
      rent:       b.rent,
      water:      b.water,
      electricity: b.electricity,
      miscellaneous: b.miscellaneous || ''
    });
  };

  const handleChange = (e) => {
    setEditForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleUpdate = async () => {
  // only pull out what you actually use
  const { tenantName, monthYear } = editForm;

  if (!tenantName || !monthYear) {
    return alert('Tenant name and Month-Year are required');
  }

  setLoading(true);
  try {
    const res = await authFetch(`${API_BASE}/updateBill/${editId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    if (!res.ok) throw new Error('Update failed');
    setEditId(null);
    await fetchBills();
  } catch (err) {
    console.error(err);
    alert('Error updating bill');
  } finally {
    setLoading(false);
  }
};


  return (
    <div style={styles.container}>
  <h2 style={styles.header}>All Tenant Bills</h2>
      {error && <div style={styles.error}>{error}</div>}
      {loading && <div style={styles.loading}>Loading…</div>}

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              {['ID','Tenant','Year–Month','Rent','Water','Electricity','Misc','Paid','Actions'].map((h,i) => (
                <th key={i} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bills.map((b, idx) => (
              <tr
                key={b.id}
                style={{
                  background: idx % 2 === 0 ? '#f1f5f9' : '#fff',
                  borderBottom: '1px solid #e2e8f0',
                }}
              >
                <td style={styles.td}>{b.id}</td>

                <td style={styles.td}>
                  {editId === b.id ? (
                    <input
                      name="tenantName"
                      value={editForm.tenantName}
                      onChange={handleChange}
                      style={{ ...styles.input, width: 90, fontSize: 14, padding: '4px 6px' }}
                      maxLength={20}
                    />
                  ) : (
                    b.tenantName
                  )}
                </td>
                <td style={styles.td}>
                  {editId === b.id ? (
                    <input
                      name="monthYear"
                      value={editForm.monthYear}
                      onChange={handleChange}
                      style={{ ...styles.input, width: 80, fontSize: 14, padding: '4px 6px' }}
                      maxLength={7}
                    />
                  ) : (
                    b.monthYear
                  )}
                </td>
                <td style={styles.td}>
                  {editId === b.id ? (
                    <input
                      name="rent"
                      value={editForm.rent}
                      onChange={handleChange}
                      style={{ ...styles.input, width: 60, fontSize: 14, padding: '4px 6px' }}
                      maxLength={7}
                    />
                  ) : (
                    b.rent
                  )}
                </td>
                <td style={styles.td}>
                  {editId === b.id ? (
                    <input
                      name="water"
                      value={editForm.water}
                      onChange={handleChange}
                      style={{ ...styles.input, width: 60, fontSize: 14, padding: '4px 6px' }}
                      maxLength={7}
                    />
                  ) : (
                    b.water
                  )}
                </td>
                <td style={styles.td}>
                  {editId === b.id ? (
                    <input
                      name="electricity"
                      value={editForm.electricity}
                      onChange={handleChange}
                      style={{ ...styles.input, width: 70, fontSize: 14, padding: '4px 6px' }}
                      maxLength={7}
                    />
                  ) : (
                    b.electricity
                  )}
                </td>
                <td style={styles.td}>
                  {editId === b.id ? (
                    <input
                      name="miscellaneous"
                      value={editForm.miscellaneous}
                      onChange={handleChange}
                      style={{ ...styles.input, width: 70, fontSize: 14, padding: '4px 6px' }}
                      maxLength={7}
                    />
                  ) : (
                    b.miscellaneous || '-'
                  )}
                </td>

                <td style={styles.td}>
                  {b.paid ? <span style={{ color:'#22c55e' }}>✅</span>
                          : <span style={{ color:'#ef4444' }}>❌</span>}
                </td>

                <td style={styles.td}>
                  {editId === b.id ? (
                    <>
                      <button
                        onClick={handleUpdate}
                        style={{ ...styles.btn, ...styles.btnSave }}
                        disabled={loading}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        style={{ ...styles.btn, ...styles.btnCancel }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEdit(b)}
                        style={{ ...styles.btn, ...styles.btnEdit }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(b.id)}
                        style={{ ...styles.btn, ...styles.btnDelete }}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}