import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from '../login-form';

const mockPush = vi.fn();
const mockRefresh = vi.fn();

const VALID_UUID = '12345678-1234-4123-8123-123456789012';

/** Build a mock Response the typed api-client can consume (uses .text()). */
function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

describe('LoginForm', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    mockPush.mockClear();
    mockRefresh.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders password input', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation error on empty submit', async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
  });

  it('redirects to /chat on successful login', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, { status: 'success', userId: VALID_UUID }));

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/password/i), 'Password1');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/chat'));
  });

  it('shows TOTP step when requires_totp', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, { status: 'requires_totp', userId: VALID_UUID }));

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/password/i), 'Password1');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByLabelText(/authenticator code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument();
  });

  it('shows locked message on 423 response', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(423, { status: 'locked', lockedUntil: '2099-01-01T12:05:00Z' }));

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/password/i), 'Password1');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many failed attempts/i);
  });

  it('shows error message on failed credentials', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(401, { error: 'Invalid credentials' }));

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/password/i), 'Password1');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
  });

  it('has link to onboarding', () => {
    render(<LoginForm />);
    const link = screen.getByRole('link', { name: /set up your account/i });
    expect(link).toHaveAttribute('href', '/onboarding');
  });

  it('submits TOTP code and redirects on success', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(200, { status: 'requires_totp', userId: VALID_UUID }))
      // TOTP step still uses raw fetch with .json() — provide both methods.
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
        json: async () => ({ ok: true }),
      } as Response);

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/password/i), 'Password1');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await screen.findByLabelText(/authenticator code/i);
    await userEvent.type(screen.getByLabelText(/authenticator code/i), '123456');
    await userEvent.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/chat'));
  });

  it('back button returns to password step from TOTP', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, { status: 'requires_totp', userId: VALID_UUID }));

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/password/i), 'Password1');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await screen.findByLabelText(/authenticator code/i);
    await userEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });
});
