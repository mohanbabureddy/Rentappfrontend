import { formatDate, formatDateTime, formatIfDate } from './dateFormat';

test('calendar dates are day/month/year without shifting a day', () => {
  expect(formatDate('2026-09-25')).toBe('25/09/2026');
  expect(formatDate('2026-01-05')).toBe('05/01/2026');
});

test('empty or unreadable values do not crash', () => {
  expect(formatDate(null)).toBe('');
  expect(formatDate('nonsense')).toBe('nonsense');
});

test('timestamps get a 12-hour time after the date', () => {
  expect(formatDateTime(new Date(2026, 8, 25, 15, 5))).toBe('25/09/2026, 03:05 PM');
  expect(formatDateTime(new Date(2026, 8, 25, 0, 7))).toBe('25/09/2026, 12:07 AM');
});

test('generic tables only touch date-looking strings', () => {
  expect(formatIfDate('2026-09-25')).toBe('25/09/2026');
  expect(formatIfDate('Wall paint')).toBe('Wall paint');
  expect(formatIfDate(500)).toBe(500);
  expect(formatIfDate('2026-09')).toBe('2026-09');
});
