import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsView } from '../settings-view';

describe('SettingsView', () => {
  it('renders links to all config sections', () => {
    render(<SettingsView />);
    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/vault');
    expect(hrefs).toContain('/agents');
    expect(hrefs).toContain('/mcp-servers');
    expect(hrefs).toContain('/scheduler');
    expect(hrefs).toContain('/rules');
    expect(hrefs).toContain('/permissions');
    expect(hrefs).toContain('/channels');
    expect(hrefs).toContain('/usage');
  });
});
