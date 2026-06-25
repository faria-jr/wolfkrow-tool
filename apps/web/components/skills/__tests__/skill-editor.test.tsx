import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SkillEditor } from '../skill-editor';

const noop = vi.fn();

describe('SkillEditor', () => {
  it('renders with empty state', () => {
    render(<SkillEditor onSave={noop} onCancel={noop} />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByText('Save skill')).toBeInTheDocument();
  });

  it('renders with initial values', () => {
    render(<SkillEditor initialValues={{ name: 'pdf', description: 'PDF proc', content: '# PDF', tags: ['docs'] }} onSave={noop} onCancel={noop} />);
    expect(screen.getByDisplayValue('pdf')).toBeInTheDocument();
    expect(screen.getByDisplayValue('PDF proc')).toBeInTheDocument();
    expect(screen.getByText(/docs/)).toBeInTheDocument();
  });

  it('calls onSave with current values', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<SkillEditor onSave={save} onCancel={noop} />);
    await userEvent.type(screen.getByLabelText('Name'), 'my-skill');
    await userEvent.type(screen.getByLabelText('Description'), 'My skill');
    await userEvent.type(screen.getByPlaceholderText(/Describe the skill/), 'body');
    await userEvent.click(screen.getByText('Save skill'));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: 'my-skill', description: 'My skill' }));
  });

  it('calls onCancel when cancel clicked', async () => {
    const cancel = vi.fn();
    render(<SkillEditor onSave={noop} onCancel={cancel} />);
    await userEvent.click(screen.getByText('Cancel'));
    expect(cancel).toHaveBeenCalled();
  });

  it('disables inputs in readOnly mode', () => {
    render(<SkillEditor onSave={noop} onCancel={noop} readOnly />);
    expect(screen.getByLabelText('Name')).toBeDisabled();
    expect(screen.queryByText('Save skill')).not.toBeInTheDocument();
  });

  it('shows loading state on save button', () => {
    render(<SkillEditor onSave={noop} onCancel={noop} loading />);
    expect(screen.getByText('Saving…')).toBeInTheDocument();
  });

  it('adds tag on Enter key', async () => {
    render(<SkillEditor onSave={noop} onCancel={noop} />);
    const tagInput = screen.getByPlaceholderText('Type tag + Enter');
    await userEvent.type(tagInput, 'mytag{Enter}');
    expect(screen.getByText(/mytag/)).toBeInTheDocument();
  });
});
