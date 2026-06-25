import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { FindingsTable, type Finding } from '../findings-table';

const baseFindings: Finding[] = [
  { id: 'f1', scanId: 's1', severity: 'critical', dimension: 'secrets', file: 'src/auth/login.ts', line: 10, message: 'Hardcoded secret' },
  { id: 'f2', scanId: 's1', severity: 'warning', dimension: 'auth', file: 'src/api/router.ts', line: 42, message: 'Missing rate limit' },
  { id: 'f3', scanId: 's1', severity: 'blocker', dimension: 'secrets', file: 'src/config/env.ts', message: 'Plaintext token' },
  { id: 'f4', scanId: 's1', severity: 'info', dimension: 'standards', file: 'src/utils/helpers.ts', line: 7, message: 'Long function' },
];

describe('FindingsTable', () => {
  it('renders all findings when no filter is applied', () => {
    render(<FindingsTable findings={baseFindings} />);
    expect(screen.getByText('Hardcoded secret')).toBeTruthy();
    expect(screen.getByText('Missing rate limit')).toBeTruthy();
    expect(screen.getByText('Plaintext token')).toBeTruthy();
    expect(screen.getByText('Long function')).toBeTruthy();
  });

  it('shows empty state when there are no findings', () => {
    render(<FindingsTable findings={[]} />);
    expect(screen.getByText(/no findings/i)).toBeTruthy();
  });

  it('filters by severity', async () => {
    const user = userEvent.setup();
    render(<FindingsTable findings={baseFindings} />);

    await user.selectOptions(screen.getByLabelText(/severity/i), 'critical');

    expect(screen.getByText('Hardcoded secret')).toBeTruthy();
    expect(screen.queryByText('Missing rate limit')).toBeNull();
    expect(screen.queryByText('Plaintext token')).toBeNull();
    expect(screen.queryByText('Long function')).toBeNull();
  });

  it('filters by dimension', async () => {
    const user = userEvent.setup();
    render(<FindingsTable findings={baseFindings} />);

    await user.selectOptions(screen.getByLabelText(/dimension/i), 'secrets');

    expect(screen.getByText('Hardcoded secret')).toBeTruthy();
    expect(screen.getByText('Plaintext token')).toBeTruthy();
    expect(screen.queryByText('Missing rate limit')).toBeNull();
    expect(screen.queryByText('Long function')).toBeNull();
  });

  it('filters by file substring', async () => {
    const user = userEvent.setup();
    render(<FindingsTable findings={baseFindings} />);

    await user.type(screen.getByPlaceholderText(/filter by file/i), 'auth');

    expect(screen.getByText('Hardcoded secret')).toBeTruthy();
    expect(screen.queryByText('Missing rate limit')).toBeNull();
    expect(screen.queryByText('Plaintext token')).toBeNull();
    expect(screen.queryByText('Long function')).toBeNull();
  });

  it('ANDs severity + dimension + file filters together', async () => {
    const user = userEvent.setup();
    render(<FindingsTable findings={baseFindings} />);

    await user.selectOptions(screen.getByLabelText(/severity/i), 'critical');
    await user.selectOptions(screen.getByLabelText(/dimension/i), 'secrets');
    await user.type(screen.getByPlaceholderText(/filter by file/i), 'login');

    expect(screen.getByText('Hardcoded secret')).toBeTruthy();
    expect(screen.queryByText('Plaintext token')).toBeNull();
    expect(screen.queryByText('Missing rate limit')).toBeNull();
  });

  it('resets to all rows when severity is cleared back to All', async () => {
    const user = userEvent.setup();
    render(<FindingsTable findings={baseFindings} />);

    await user.selectOptions(screen.getByLabelText(/severity/i), 'warning');
    expect(screen.queryByText('Hardcoded secret')).toBeNull();

    await user.selectOptions(screen.getByLabelText(/severity/i), '');
    expect(screen.getByText('Hardcoded secret')).toBeTruthy();
    expect(screen.getByText('Missing rate limit')).toBeTruthy();
  });

  it('shows empty state when filters match no rows', async () => {
    const user = userEvent.setup();
    render(<FindingsTable findings={baseFindings} />);

    await user.type(screen.getByPlaceholderText(/filter by file/i), 'nonexistent-file');

    expect(screen.getByText(/no findings match/i)).toBeTruthy();
  });
});
