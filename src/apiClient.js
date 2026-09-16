// Centralized API endpoint helpers & fetch wrappers
// Configure via environment variables:
//   REACT_APP_API_BASE   e.g. http://localhost:5000
//   REACT_APP_API_PREFIX e.g. /api  (set to '' if backend has no /api)

// Default backend host changed from localhost to deployed host
// API base must be supplied via environment (.env) so there's a single source of truth.
const RAW_BASE = process.env.REACT_APP_API_BASE;
if (!RAW_BASE) {
  // Fail fast: developer must set REACT_APP_API_BASE in .env or build env.
  throw new Error('REACT_APP_API_BASE not set. Define it in .env before building.');
}
export const API_BASE = RAW_BASE.replace(/\/$/, '');
export const API_PREFIX = process.env.REACT_APP_API_PREFIX || '/api';
// Set REACT_APP_WITH_CREDENTIALS=true to send cookies (session auth) to API on different origin
export const FETCH_CREDENTIALS = (process.env.REACT_APP_WITH_CREDENTIALS === 'true') ? 'include' : 'same-origin';

// The backend returns file links (e.g. occupant Aadhaar uploads) as host-relative paths
// like "/uploads/...". Used as-is in an <a href>, the browser resolves that against the
// frontend's own origin instead of the backend, so the file never loads. Prefix with
// API_BASE to point it at the backend. Already-absolute URLs are returned unchanged.
export function resolveFileUrl(path) {
  if (!path) return path;
  return /^https?:\/\//i.test(path) ? path : `${API_BASE}${path}`;
}

// URL builders
export const url = {
  occupantsList: (tenant) => `${API_BASE}${API_PREFIX}/tenants/occupants/${encodeURIComponent(tenant)}`,
  occupantDelete: (id) => `${API_BASE}${API_PREFIX}/tenants/occupants/${id}`,
  // (Removed alternates after confirming controller mapping)
  tenantBills: (username) => `${API_BASE}${API_PREFIX}/tenants/${encodeURIComponent(username)}`,
  markBillPaid: (billId) => `${API_BASE}${API_PREFIX}/tenants/markPaid/${billId}`,
  createOrder: (billId) => `${API_BASE}${API_PREFIX}/tenants/createOrder/${billId}`,
  logPaymentSuccess: () => `${API_BASE}${API_PREFIX}/tenants/logSuccess`,
  logPaymentFailure: () => `${API_BASE}${API_PREFIX}/tenants/logFailure`,
  complaintsList: (tenant) => `${API_BASE}${API_PREFIX}/tenants/complaints/${encodeURIComponent(tenant)}`,
  complaintsAdd: () => `${API_BASE}${API_PREFIX}/tenants/complaints`,
  adminUsersAll: () => `${API_BASE}${API_PREFIX}/users/all`,
  adminUserAdd: () => `${API_BASE}${API_PREFIX}/users/add`,
  adminUserUpdate: (id) => `${API_BASE}${API_PREFIX}/users/update/${id}`,
  adminUserDelete: (id) => `${API_BASE}${API_PREFIX}/users/delete/${id}`,
  // Admin occupants & verify
  adminOccupantsAll: () => `${API_BASE}${API_PREFIX}/admin/occupants`,
  occupantVerify: (id) => `${API_BASE}${API_PREFIX}/tenants/occupants/verify/${id}`,
  assistantAsk: () => `${API_BASE}${API_PREFIX}/assistant/ask`,
  login: () => `${API_BASE}${API_PREFIX}/users/login`,
  registrationStart: () => `${API_BASE}${API_PREFIX}/users/registration/start`,
  registrationFinish: () => `${API_BASE}${API_PREFIX}/users/registration/finish`
};

// Extended user move-in & deposit specific helpers
export const userMoveInDepositUrl = {
  self: (username) => `${API_BASE}${API_PREFIX}/users/me/movein-deposit?username=${encodeURIComponent(username)}`,
  update: (id) => `${API_BASE}${API_PREFIX}/users/${id}/movein-deposit`
};

// The backend requires a Bearer token (issued at login) on every protected route.
// Login.js stores the whole login response -- including the token -- under
// localStorage['user'], so we just read it back out here.
export function getToken() {
  try {
    const stored = localStorage.getItem('user');
    return stored ? (JSON.parse(stored).token || null) : null;
  } catch (_) {
    return null;
  }
}

export function authHeaders(extra = {}) {
  const token = getToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

// Drop-in replacement for fetch() that attaches the Authorization header.
export async function authFetch(input, init = {}) {
  return fetch(input, { credentials: FETCH_CREDENTIALS, ...init, headers: authHeaders(init.headers || {}) });
}

// Opens a protected backend file (e.g. an occupant's Aadhaar upload) in a new tab.
// A plain <a href> can't carry the Authorization header the backend now requires for
// /uploads/*, so this fetches the file with the header, then opens the resulting blob.
export async function openAuthenticatedFile(path) {
  const res = await authFetch(resolveFileUrl(path));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank', 'noopener');
}
