// Pure helpers for the admin dashboard (kept separate so they can be unit tested).

export const billTotal = (b) =>
  (Number(b.rent) || 0) + (Number(b.water) || 0) + (Number(b.electricity) || 0) + (Number(b.miscellaneous) || 0);

const typeOf = (b) => (b.billType === 'ELECTRICITY' ? 'electricity' : 'rent');

const emptyGroup = () => ({ raised: 0, collected: 0, pending: 0, count: 0, paidCount: 0, unpaidCount: 0 });

export function forMonth(bills, month) {
  return month ? bills.filter((b) => b.monthYear === month) : bills;
}

// Bills are all-or-nothing (no part payments), so "collected" is the total of paid bills.
export function summarize(bills) {
  const out = { rent: emptyGroup(), electricity: emptyGroup(), all: emptyGroup() };
  for (const b of bills) {
    const total = billTotal(b);
    for (const g of [out[typeOf(b)], out.all]) {
      g.raised += total;
      g.count += 1;
      if (b.paid) {
        g.collected += total;
        g.paidCount += 1;
      } else {
        g.pending += total;
        g.unpaidCount += 1;
      }
    }
  }
  return out;
}

export const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// Unpaid bills, Room1, Room2, ... Room10 order, rent before electricity.
export function unpaidList(bills) {
  return bills
    .filter((b) => !b.paid)
    .map((b) => ({ tenant: b.tenantName, month: b.monthYear, type: typeOf(b), amount: billTotal(b) }))
    .sort((a, b) =>
      a.tenant.localeCompare(b.tenant, undefined, { numeric: true, sensitivity: 'base' }) ||
      a.month.localeCompare(b.month) ||
      a.type.localeCompare(b.type)
    );
}

export const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
