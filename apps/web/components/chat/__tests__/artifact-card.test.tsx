import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ArtifactCard } from '../artifact-card';

const excalidrawData = JSON.stringify({
  type: 'excalidraw',
  elements: [
    { id: 'el1', type: 'rectangle' },
    { id: 'el2', type: 'ellipse' },
    { id: 'el3', type: 'text' },
  ],
  appState: { gridSize: null },
});

const jsonData = JSON.stringify({ name: 'wolfkrow', version: '1.0.0', active: true });

const codeData = '```typescript\nconst x: number = 42;\nconsole.log(x);\n```';

const textData = 'This is plain text output from the tool.';

describe('ArtifactCard — excalidraw', () => {
  it('renders Excalidraw Diagram title', () => {
    render(<ArtifactCard output={excalidrawData} artifactType="excalidraw" />);
    expect(screen.getByText('Excalidraw Diagram')).toBeTruthy();
  });

  it('renders Open in Excalidraw button', () => {
    render(<ArtifactCard output={excalidrawData} artifactType="excalidraw" />);
    expect(screen.getByRole('link', { name: /open in excalidraw/i })).toBeTruthy();
  });

  it('Open in Excalidraw link uses base64-encoded JSON URL', () => {
    render(<ArtifactCard output={excalidrawData} artifactType="excalidraw" />);
    const link = screen.getByRole('link', { name: /open in excalidraw/i }) as HTMLAnchorElement;
    const expected = `https://excalidraw.com/#json=${btoa(excalidrawData)}`;
    expect(link.href).toBe(expected);
  });

  it('renders element count', () => {
    render(<ArtifactCard output={excalidrawData} artifactType="excalidraw" />);
    expect(screen.getByText(/3 elements/i)).toBeTruthy();
  });

  it('renders shape types preview', () => {
    render(<ArtifactCard output={excalidrawData} artifactType="excalidraw" />);
    // Should show shape breakdown
    expect(screen.getByText(/rectangle|ellipse|text/i)).toBeTruthy();
  });

  it('link opens in new tab', () => {
    render(<ArtifactCard output={excalidrawData} artifactType="excalidraw" />);
    const link = screen.getByRole('link', { name: /open in excalidraw/i }) as HTMLAnchorElement;
    expect(link.target).toBe('_blank');
  });

  it('link has noopener noreferrer rel', () => {
    render(<ArtifactCard output={excalidrawData} artifactType="excalidraw" />);
    const link = screen.getByRole('link', { name: /open in excalidraw/i }) as HTMLAnchorElement;
    expect(link.rel).toContain('noopener');
  });
});

describe('ArtifactCard — json', () => {
  it('renders formatted JSON in a pre element', () => {
    render(<ArtifactCard output={jsonData} artifactType="json" />);
    const pre = document.querySelector('pre');
    expect(pre).toBeTruthy();
    expect(pre?.textContent).toContain('"name"');
    expect(pre?.textContent).toContain('"wolfkrow"');
  });

  it('renders JSON with indentation (pretty-printed)', () => {
    render(<ArtifactCard output={jsonData} artifactType="json" />);
    const pre = document.querySelector('pre');
    // Pretty-printed JSON has newlines
    expect(pre?.textContent).toContain('\n');
  });
});

describe('ArtifactCard — code', () => {
  it('renders code in a pre element', () => {
    render(<ArtifactCard output={codeData} artifactType="code" />);
    const pre = document.querySelector('pre');
    expect(pre).toBeTruthy();
  });

  it('renders code content', () => {
    render(<ArtifactCard output={codeData} artifactType="code" />);
    expect(screen.getByText(/const x/)).toBeTruthy();
  });
});

describe('ArtifactCard — text', () => {
  it('renders plain text in a pre element', () => {
    render(<ArtifactCard output={textData} artifactType="text" />);
    const pre = document.querySelector('pre');
    expect(pre).toBeTruthy();
    expect(pre?.textContent).toContain('This is plain text output');
  });
});
