import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TenantBills from './TenantBills';
import './i18n';

const json = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), clone() { return this; } });

// Answers the two calls TenantBills makes on load: the bill list and the deposit summary.
function mockApi({ demanded, paid }) {
  global.fetch = jest.fn((input) => {
    if (String(input).includes('movein-deposit')) {
      return json({ moveInDate: null, demandedDeposit: demanded, totalAmountDeposited: paid, history: [] });
    }
    return json([]);
  });
}

async function renderPage() {
  localStorage.setItem('user', JSON.stringify({ username: 'Room1', role: 'TENANT', token: 't' }));
  render(<MemoryRouter><TenantBills username="Room1" /></MemoryRouter>);
  // The summary loads asynchronously; wait until the button has left its loading state.
  await waitFor(() => expect(screen.getByRole('button', { name: /Pay Deposit/i })).toBeInTheDocument());
}

afterEach(() => {
  localStorage.clear();
  delete global.fetch;
});

test('Pay Deposit is disabled once the demanded deposit has been fully paid', async () => {
  mockApi({ demanded: 20000, paid: 20000 });
  await renderPage();
  await waitFor(() => expect(screen.getByRole('button', { name: /Pay Deposit/i })).toBeDisabled());
  expect(screen.getByPlaceholderText(/Amount/i)).toBeDisabled();
  expect(screen.queryByText(/You can pay up to/i)).not.toBeInTheDocument();
});

test('Pay Deposit stays active while some deposit is still owed, and says how much', async () => {
  mockApi({ demanded: 20000, paid: 5000 });
  await renderPage();
  await waitFor(() => expect(screen.getByText(/You can pay up to ₹15000 more/i)).toBeInTheDocument());
  expect(screen.getByRole('button', { name: /Pay Deposit/i })).toBeEnabled();
  expect(screen.getByPlaceholderText(/Amount/i)).toHaveAttribute('max', '15000');
});

test('with no demanded amount set there is no limit', async () => {
  mockApi({ demanded: null, paid: 5000 });
  await renderPage();
  await waitFor(() => expect(screen.getByRole('button', { name: /Pay Deposit/i })).toBeEnabled());
  expect(screen.getByPlaceholderText(/Amount/i)).not.toHaveAttribute('max');
});

test('floating-point dust does not leave a fully paid deposit payable', async () => {
  mockApi({ demanded: 0.3, paid: 0.1 + 0.2 });   // 0.30000000000000004 paid
  await renderPage();
  await waitFor(() => expect(screen.getByRole('button', { name: /Pay Deposit/i })).toBeDisabled());
});
