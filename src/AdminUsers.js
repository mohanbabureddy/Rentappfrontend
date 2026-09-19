import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { url, authFetch, userMoveInDepositUrl } from './apiClient';

const ROLES = ['ADMIN', 'TENANT'];

const styles = {
  container: {
    maxWidth: '900px',
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
  },
  card: {
    marginBottom: '32px',
    padding: '20px',
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  input: {
    marginRight: '10px',
    padding: '8px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '15px',
  },
  btnPrimary: {
    background: 'linear-gradient(90deg, #2563eb 0%, #38bdf8 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 18px',
    fontWeight: 'bold',
    fontSize: '15px',
    cursor: 'pointer',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    minWidth: '860px',
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
  },
  td: {
    padding: '10px',
    textAlign: 'center',
  },
  actionBtn: {
    borderRadius: '4px',
    padding: '6px 14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginRight: '6px',
  },
  actionsCol: {
    width: '180px',
    minWidth: '180px',
    maxWidth: '180px',
  },
  usernameCol: {
    width: '180px',
    minWidth: '180px',
    maxWidth: '180px',
  },
  searchBar: {
    marginBottom: '18px',
    padding: '8px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '15px',
    width: '220px',
  },
  pagination: {
    marginTop: '18px',
    textAlign: 'center',
  },
  exportBtn: {
    marginLeft: '12px',
    padding: '7px 16px',
    borderRadius: '6px',
    background: '#38bdf8',
    color: '#fff',
    border: 'none',
    fontWeight: 'bold',
    cursor: 'pointer',
  }
};

function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: ROLES[0] });
  const [editId, setEditId] = useState(null);
  const [editUser, setEditUser] = useState({ username: '', role: ROLES[0], phone: '', moveInDate: '', demandedDeposit: '', manualDepositAmount: '', manualDepositNotes: '' });
  const [updatingMoveIn, setUpdatingMoveIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showPassword, setShowPassword] = useState(false); // only for add user form

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const filteredUsers = users.filter(
    u =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const pagedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  // Auth guard: must be ADMIN
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) return navigate('/login', { replace: true });
    const { role } = JSON.parse(stored);
    if (role !== 'ADMIN') navigate('/', { replace: true });
  }, [navigate]);

  // Fetch all users
  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
  const res = await authFetch(url.adminUsersAll());
      if (!res.ok) throw new Error('Failed to fetch users');
  const data = await res.json();
  setUsers(data);
    } catch (err) {
      console.error(err);
      setError('Unable to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Handlers
  const handleAddChange = e => {
    setNewUser(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.role) {
      return alert('All fields are required to add a user');
    }
    setLoading(true);
    try {
      const res = await authFetch(url.adminUserAdd(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      if (!res.ok) {
        // Try to extract backend error message (JSON or text) so duplicate user errors show up.
        let backendMsg = '';
        try {
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const data = await res.json();
            backendMsg = data.message || data.error || JSON.stringify(data);
          } else {
            backendMsg = (await res.text()) || res.statusText;
          }
        } catch (_) {
          backendMsg = res.statusText || 'Unknown error';
        }
        throw new Error(backendMsg ? `Add failed: ${backendMsg}` : 'Add failed');
      }
      setNewUser({ username: '', password: '', role: ROLES[0] });
      await fetchUsers();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error adding user');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = user => {
    setEditId(user.id);
    setEditUser({
      username: user.username,
      role: user.role,
      phone: user.phone || '',
      moveInDate: user.moveInDate || '',
      demandedDeposit: user.demandedDeposit != null ? user.demandedDeposit : '',
      // Deliberately blank, not pre-filled with the current total -- this
      // field adds a new deposit ledger entry, it doesn't overwrite the total.
      manualDepositAmount: '',
      manualDepositNotes: ''
    });
  };

  const handleEditChange = e => {
    setEditUser(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleUpdateUser = async () => {
    if (!editUser.username || !editUser.role) {
      return alert('Username and Role are required to update');
    }
    setLoading(true);
    try {
      // Exclude password from update (prevents sending hashed value back & double hashing backend)
      const { username, role, phone } = editUser;
      const basePayload = { username, role, ...(phone ? { phone } : {}) };
      const res = await authFetch(url.adminUserUpdate(editId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basePayload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Update failed');
      }
      // After basic update, optionally update move-in date and/or record a
      // manual deposit entry if provided
      if (editUser.role !== 'ADMIN' && (editUser.moveInDate || editUser.demandedDeposit !== '' || editUser.manualDepositAmount)) {
        try {
          setUpdatingMoveIn(true);
          const depositRes = await authFetch(userMoveInDepositUrl.update(editId), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...(editUser.moveInDate ? { moveInDate: editUser.moveInDate } : {}),
              ...(editUser.demandedDeposit !== '' ? { demandedDeposit: editUser.demandedDeposit } : {}),
              ...(editUser.manualDepositAmount ? {
                manualDepositAmount: editUser.manualDepositAmount,
                notes: editUser.manualDepositNotes || undefined
              } : {})
            })
          });
          if (!depositRes.ok) {
            const data = await depositRes.json().catch(() => ({}));
            throw new Error(data.error || 'Move-in/deposit update failed');
          }
        } catch (e) {
          console.warn('Move-in/deposit patch failed', e);
          alert(e.message || 'Move-in date or deposit update failed');
        }
        finally { setUpdatingMoveIn(false); }
      }
      setEditId(null);
      await fetchUsers();
    } catch (err) {
      console.error(err);
      alert(err.message && err.message !== 'Update failed' ? err.message : 'Error updating user');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async id => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    setLoading(true);
    try {
  const res = await authFetch(url.adminUserDelete(id), { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      await fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Error deleting user');
    } finally {
      setLoading(false);
    }
  };

  // Export users as CSV
  const handleExportCSV = () => {
    const csvRows = [
      ['ID', 'Username', 'Role'],
      ...users.map(u => [u.id, u.username, u.role])
    ];
    const csvContent = csvRows.map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.header}>User Management</h2>
      {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}

      <div style={styles.card}>
        <h4 style={{ color: '#2563eb', marginBottom: '16px' }}>Add New User</h4>
        <input
          name="username"
          placeholder="Username"
          value={newUser.username}
          onChange={handleAddChange}
          style={styles.input}
        />
        <input
          name="password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Password"
          value={newUser.password}
          onChange={handleAddChange}
          style={styles.input}
        />
        <button
          type="button"
          onClick={() => setShowPassword(v => !v)}
          style={{ ...styles.actionBtn, background: '#f1f5f9', color: '#2563eb', border: '1px solid #2563eb' }}
        >
          {showPassword ? 'Hide' : 'Show'}
        </button>
        <select
          name="role"
          value={newUser.role}
          onChange={handleAddChange}
          style={styles.input}
        >
          {ROLES.map(role => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
        <button disabled={loading} onClick={handleAddUser} style={styles.btnPrimary}>
          {loading ? 'Please wait…' : 'Add'}
        </button>
        <button onClick={handleExportCSV} style={styles.exportBtn}>Export CSV</button>
      </div>

      <input
        style={styles.searchBar}
        placeholder="Search by username or role"
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1); }}
      />

      {loading && <p style={{ textAlign: 'center' }}>Loading...</p>}

      <h4 style={{ color: '#2563eb', marginBottom: '16px' }}>Existing Users</h4>
      <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>ID</th>
            <th style={{ ...styles.th, ...styles.usernameCol }}>Username</th>
            {/* Password column removed to avoid editing hashed passwords */}
            <th style={styles.th}>Role</th>
            <th style={styles.th}>Phone</th>
            <th style={styles.th}>Move-In Date</th>
            <th style={styles.th}>Demanded Deposit</th>
            <th style={styles.th}>Total Deposit</th>
            <th style={{ ...styles.th, ...styles.actionsCol }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {pagedUsers.map((u, idx) => (
            <tr
              key={u.id}
              style={{
                background: idx % 2 === 0 ? '#f1f5f9' : '#fff',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <td style={styles.td}>{u.id}</td>

              <td style={{ ...styles.td, ...styles.usernameCol }}>
                {editId === u.id ? (
                  <input
                    name="username"
                    value={editUser.username}
                    onChange={handleEditChange}
                    style={styles.input}
                  />
                ) : (
                  u.username
                )}
              </td>

              {/* Password cell removed */}

              <td style={styles.td}>
                {editId === u.id ? (
                  <select
                    name="role"
                    value={editUser.role}
                    onChange={handleEditChange}
                    style={styles.input}
                  >
                    {ROLES.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                ) : (
                  u.role
                )}
              </td>
              <td style={styles.td}>
                {editId === u.id ? (
                  <input
                    type="tel"
                    name="phone"
                    placeholder="10-digit mobile"
                    value={editUser.phone}
                    onChange={handleEditChange}
                    style={{ ...styles.input, width: 110 }}
                  />
                ) : (
                  u.phone || '—'
                )}
              </td>
              <td style={styles.td}>
                {u.role === 'ADMIN' ? (
                  '—'
                ) : editId === u.id ? (
                  <input
                    type="date"
                    name="moveInDate"
                    value={editUser.moveInDate}
                    onChange={handleEditChange}
                    style={styles.input}
                  />
                ) : (
                  u.moveInDate ? new Date(u.moveInDate).toLocaleDateString() : '—'
                )}
              </td>
              <td style={styles.td}>
                {u.role === 'ADMIN' ? (
                  '—'
                ) : editId === u.id ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="demandedDeposit"
                    placeholder="e.g. 20000"
                    value={editUser.demandedDeposit}
                    onChange={handleEditChange}
                    style={{ ...styles.input, width: 100 }}
                  />
                ) : (
                  u.demandedDeposit != null ? `₹${u.demandedDeposit}` : '—'
                )}
              </td>
              <td style={styles.td}>
                {u.role === 'ADMIN' ? (
                  '—'
                ) : editId === u.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch' }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      Current: ₹{typeof u.totalAmountDeposited === 'number' ? u.totalAmountDeposited : (u.totalAmountDeposited || 0)}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="manualDepositAmount"
                      placeholder="Add amount"
                      value={editUser.manualDepositAmount}
                      onChange={handleEditChange}
                      style={{ ...styles.input, margin: 0, width: 100 }}
                    />
                    <input
                      type="text"
                      name="manualDepositNotes"
                      placeholder="Note (optional)"
                      value={editUser.manualDepositNotes}
                      onChange={handleEditChange}
                      style={{ ...styles.input, margin: 0, width: 100 }}
                    />
                  </div>
                ) : (
                  `₹${typeof u.totalAmountDeposited === 'number' ? u.totalAmountDeposited : (u.totalAmountDeposited || 0)}`
                )}
              </td>

              <td style={{ ...styles.td, ...styles.actionsCol }}>
                {editId === u.id ? (
                  <>
                    <button
                      onClick={handleUpdateUser}
                      disabled={loading || updatingMoveIn}
                      style={{ ...styles.actionBtn, background: '#2563eb', color: '#fff', opacity: (loading || updatingMoveIn) ? 0.7 : 1 }}
                    >
                      {(loading || updatingMoveIn) ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      style={{
                        ...styles.actionBtn,
                        background: '#f1f5f9',
                        color: '#2563eb',
                        border: '1px solid #2563eb',
                      }}
                      disabled={loading || updatingMoveIn}
                    >
                      Cancel
                    </button>
                    {updatingMoveIn && (
                      <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>Updating move-in & deposit…</div>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleEdit(u)}
                      style={{ ...styles.actionBtn, background: '#38bdf8', color: '#fff' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(u.id)}
                      style={{ ...styles.actionBtn, background: '#ef4444', color: '#fff' }}
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

      {/* Pagination */}
      <div style={styles.pagination}>
        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i + 1}
            onClick={() => setPage(i + 1)}
            style={{
              ...styles.actionBtn,
              background: page === i + 1 ? '#2563eb' : '#f1f5f9',
              color: page === i + 1 ? '#fff' : '#2563eb',
              border: '1px solid #2563eb',
              marginRight: 4,
            }}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

export default AdminUsers;