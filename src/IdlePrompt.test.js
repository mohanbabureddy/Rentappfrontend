import { act, render, screen, fireEvent } from '@testing-library/react';
import App from './App';

const FIVE_MIN = 5 * 60 * 1000;

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('user', JSON.stringify({ username: 'alice', role: 'TENANT' }));
});

afterEach(() => {
  jest.useRealTimers();
});

test('no prompt before 5 minutes of inactivity', () => {
  render(<App />);
  act(() => { jest.advanceTimersByTime(FIVE_MIN - 1000); });
  expect(screen.queryByText(/Are you still there/i)).not.toBeInTheDocument();
});

test('asks to resume after 5 minutes, and Resume dismisses it', () => {
  render(<App />);
  act(() => { jest.advanceTimersByTime(FIVE_MIN); });
  expect(screen.getByText(/Are you still there/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Resume/i }));
  expect(screen.queryByText(/Are you still there/i)).not.toBeInTheDocument();
  // Still logged in, and the 5-minute clock has restarted.
  expect(localStorage.getItem('user')).not.toBeNull();
  act(() => { jest.advanceTimersByTime(FIVE_MIN - 1000); });
  expect(screen.queryByText(/Are you still there/i)).not.toBeInTheDocument();
});

test('stray mouse movement does not dismiss the prompt', () => {
  render(<App />);
  act(() => { jest.advanceTimersByTime(FIVE_MIN); });
  fireEvent.mouseMove(window);
  expect(screen.getByText(/Are you still there/i)).toBeInTheDocument();
});

test('logs out if nobody answers within the grace period', () => {
  render(<App />);
  act(() => { jest.advanceTimersByTime(FIVE_MIN); });
  act(() => { jest.advanceTimersByTime(61 * 1000); });
  expect(localStorage.getItem('user')).toBeNull();
  expect(screen.queryByText(/Are you still there/i)).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Login/i })).toBeInTheDocument();
});
