import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from '../login-form';

const mockPush = vi.fn();
const mockRefresh = vi.fn();

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
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'success', userId: 'u1' }),
    } as Response);

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/password/i), 'Password1');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/chat'));
  });

  it('shows TOTP step when requires_totp', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'requires_totp', userId: 'u1' }),
    } as Response);

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/password/i), 'Password1');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByLabelText(/authenticator code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument();
  });

  it('shows locked message on 423 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 423,
      json: async () => ({ status: 'locked', lockedUntil: '2099-01-01T12:05:00Z' }),
    } as Response);

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/password/i), 'Password1');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many failed attempts/i);
  });

  it('shows error message on failed credentials', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid credentials' }),
    } as Response);

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
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'requires_totp', userId: 'u1' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'success', userId: 'u1' }),
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
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'requires_totp', userId: 'u1' }),
    } as Response);

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/password/i), 'Password1');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await screen.findByLabelText(/authenticator code/i);
    await userEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });
});
