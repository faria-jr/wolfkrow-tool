import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AskQuestionDialog } from '../ask-question-dialog';

describe('AskQuestionDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <AskQuestionDialog open={false} question="What do you mean?" onAnswer={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders question when open', () => {
    render(
      <AskQuestionDialog open={true} question="What do you mean?" onAnswer={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('What do you mean?')).toBeTruthy();
  });

  it('submit is disabled when answer empty', () => {
    render(
      <AskQuestionDialog open={true} question="Q?" onAnswer={vi.fn()} onCancel={vi.fn()} />,
    );
    const btn = screen.getByRole('button', { name: /send answer/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('calls onAnswer with typed text on submit', async () => {
    const onAnswer = vi.fn();
    const user = userEvent.setup();
    render(
      <AskQuestionDialog open={true} question="Q?" onAnswer={onAnswer} onCancel={vi.fn()} />,
    );
    await user.type(screen.getByRole('textbox'), 'My answer here');
    await user.click(screen.getByRole('button', { name: /send answer/i }));
    expect(onAnswer).toHaveBeenCalledWith('My answer here');
  });

  it('clears answer field after submit', async () => {
    const user = userEvent.setup();
    render(
      <AskQuestionDialog open={true} question="Q?" onAnswer={vi.fn()} onCancel={vi.fn()} />,
    );
    await user.type(screen.getByRole('textbox'), 'answer');
    await user.click(screen.getByRole('button', { name: /send answer/i }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  });

  it('calls onCancel when cancel button clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <AskQuestionDialog open={true} question="Q?" onAnswer={vi.fn()} onCancel={onCancel} />,
    );
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
