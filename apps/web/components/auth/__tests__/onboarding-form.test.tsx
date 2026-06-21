import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OnboardingForm } from '../onboarding-form';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

describe('OnboardingForm', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    mockPush.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders step 1 with password fields', () => {
    render(<OnboardingForm />);
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    render(<OnboardingForm />);
    await userEvent.type(screen.getByLabelText(/^password$/i), 'Password1');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Different1');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it('shows password strength error for weak password', async () => {
    render(<OnboardingForm />);
    await userEvent.type(screen.getByLabelText(/^password$/i), 'weak');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'weak');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it('advances to step 2 on successful setup', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ userId: 'u1' }),
    } as Response);

    render(<OnboardingForm />);
    await userEvent.type(screen.getByLabelText(/^password$/i), 'Password1');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Password1');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/you're all set/i)).toBeInTheDocument();
  });

  it('redirects to /chat when continuing from step 2', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ userId: 'u1' }),
    } as Response);

    render(<OnboardingForm />);
    await userEvent.type(screen.getByLabelText(/^password$/i), 'Password1');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Password1');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await screen.findByText(/you're all set/i);
    await userEvent.click(screen.getByRole('button', { name: /go to app/i }));

    expect(mockPush).toHaveBeenCalledWith('/chat');
  });

  it('shows 409 conflict error when owner already exists', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Owner already exists' }),
    } as Response);

    render(<OnboardingForm />);
    await userEvent.type(screen.getByLabelText(/^password$/i), 'Password1');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Password1');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/i);
  });

  it('shows validation error from server', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Must contain at least one number' }),
    } as Response);

    render(<OnboardingForm />);
    await userEvent.type(screen.getByLabelText(/^password$/i), 'Password1');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Password1');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/number/i);
  });
});
