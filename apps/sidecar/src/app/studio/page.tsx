/**
 * Open Design Studio — mount point.
 *
 * When vendor/open-design is added here, replace the placeholder with the
 * actual studio component from packages/design-tools.
 */

export default function StudioPage() {
  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem' }}>
      <div style={{ fontSize: '2rem' }}>🎨</div>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Open Design Studio</h1>
      <p style={{ fontSize: '0.875rem', color: '#888', margin: 0, textAlign: 'center', maxWidth: 360 }}>
        Design tools will be available here once{' '}
        <code style={{ fontFamily: 'monospace', background: '#1a1a1a', padding: '2px 6px', borderRadius: 4 }}>
          packages/design-tools
        </code>{' '}
        is integrated.
      </p>
    </main>
  );
}
