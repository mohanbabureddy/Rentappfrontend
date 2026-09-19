import { billTotal, forMonth, percent, summarize, unpaidList } from './dashboardStats';

const bills = [
  { tenantName: 'Room10', monthYear: '2026-09', billType: 'RENT', rent: 6000, water: 750, miscellaneous: 0, electricity: null, paid: true },
  { tenantName: 'Room2', monthYear: '2026-09', billType: 'RENT', rent: 5500, water: 500, miscellaneous: 100, electricity: null, paid: false },
  { tenantName: 'Room2', monthYear: '2026-09', billType: 'ELECTRICITY', rent: null, water: null, miscellaneous: null, electricity: 850, paid: false },
  { tenantName: 'Room10', monthYear: '2026-09', billType: 'ELECTRICITY', rent: null, water: null, miscellaneous: null, electricity: 600, paid: true },
  { tenantName: 'Room2', monthYear: '2026-10', billType: 'RENT', rent: 5500, water: 500, miscellaneous: 0, electricity: null, paid: false },
];

test('a bill total adds every amount and ignores empty ones', () => {
  expect(billTotal(bills[0])).toBe(6750);
  expect(billTotal(bills[2])).toBe(850);
  expect(billTotal({})).toBe(0);
});

test('rent and electricity are summed separately for a month', () => {
  const s = summarize(forMonth(bills, '2026-09'));
  expect(s.rent).toMatchObject({ raised: 6750 + 6100, collected: 6750, pending: 6100, count: 2, paidCount: 1, unpaidCount: 1 });
  expect(s.electricity).toMatchObject({ raised: 1450, collected: 600, pending: 850, count: 2 });
  expect(s.all).toMatchObject({ raised: 14300, collected: 7350, pending: 6950 });
});

test('other months are not mixed in', () => {
  expect(summarize(forMonth(bills, '2026-10')).rent.raised).toBe(6000);
  expect(summarize(forMonth(bills, '2026-10')).electricity.raised).toBe(0);
});

test('an empty month gives zeros and 0 percent', () => {
  const s = summarize([]);
  expect(s.all).toMatchObject({ raised: 0, collected: 0, pending: 0, count: 0 });
  expect(percent(0, 0)).toBe(0);
  expect(percent(6750, 12850)).toBe(53);
});

test('all months when no month is chosen', () => {
  expect(summarize(forMonth(bills, '')).all.count).toBe(5);
});

test('unpaid list is in natural tenant order', () => {
  const list = unpaidList(bills);
  expect(list.map((u) => `${u.tenant} ${u.month} ${u.type}`)).toEqual([
    'Room2 2026-09 electricity',
    'Room2 2026-09 rent',
    'Room2 2026-10 rent',
  ]);
});
