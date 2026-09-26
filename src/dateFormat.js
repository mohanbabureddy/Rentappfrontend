// Every date the app shows is day/month/year (25/09/2026), whatever the browser's locale.
const pad = (n) => String(n).padStart(2, '0');

// "2026-09-25" (a calendar date) must not go through new Date(), which reads it as UTC midnight.
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}[T ]/;

export function formatDate(value) {
  if (!value) return '';
  const only = typeof value === 'string' ? value.match(DATE_ONLY) : null;
  if (only) return `${only[3]}/${only[2]}/${only[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// 25/09/2026, 03:05 PM
export function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${formatDate(value)}, ${pad(h12)}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

// For generic tables: turn any date-looking string into d/m/y, leave everything else alone.
export function formatIfDate(value) {
  if (typeof value !== 'string') return value;
  if (DATE_ONLY.test(value)) return formatDate(value);
  if (ISO_DATE_PREFIX.test(value)) return formatDateTime(value);
  return value;
}
