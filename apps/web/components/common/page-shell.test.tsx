import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageContent, PageShell } from './page-shell';

describe('PageShell', () => {
  it('renders children in the default variant with content padding', () => {
    render(
      <PageShell>
        <span data-testid="child" />
      </PageShell>
    );
    expect(screen.getByTestId('child')).toBeDefined();
  });

  it('flush variant omits padding (full-bleed)', () => {
    const { container } = render(
      <PageShell variant="flush">
        <span data-testid="child" />
      </PageShell>
    );
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).not.toMatch(/p-4|sm:p-6/);
    expect(shell.className).toMatch(/h-full/);
  });

  it('default variant includes content padding and column layout', () => {
    const { container } = render(
      <PageShell>
        <span data-testid="child" />
      </PageShell>
    );
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toMatch(/flex/);
    expect(shell.className).toMatch(/p-4/);
  });

  it('narrow variant constrains max width', () => {
    const { container } = render(
      <PageShell variant="narrow">
        <span data-testid="child" />
      </PageShell>
    );
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toMatch(/max-w-content|max-w-3xl/);
  });

  it('merges custom className', () => {
    const { container } = render(
      <PageShell className="custom-x">
        <span data-testid="child" />
      </PageShell>
    );
    expect((container.firstElementChild as HTMLElement).className).toMatch(/custom-x/);
  });
});

describe('PageContent', () => {
  it('renders as a scroll region', () => {
    const { container } = render(
      <PageContent>
        <span data-testid="child" />
      </PageContent>
    );
    const region = container.firstElementChild as HTMLElement;
    expect(region.className).toMatch(/overflow-auto/);
    expect(region.className).toMatch(/min-h-0/);
    expect(screen.getByTestId('child')).toBeDefined();
  });
});
