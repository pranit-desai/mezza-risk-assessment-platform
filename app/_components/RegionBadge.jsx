export default function RegionBadge({ region }) {
  const uae = region === 'UAE';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--mz-radius-sm)',
        fontSize: 'var(--mz-fs-xs)',
        fontWeight: 700,
        letterSpacing: '0.4px',
        background: uae ? 'var(--mz-region-uae-bg)' : 'var(--mz-region-usa-bg)',
        border: `1px solid ${uae ? 'var(--mz-region-uae-border)' : 'var(--mz-region-usa-border)'}`,
        color: uae ? 'var(--mz-region-uae-text)' : 'var(--mz-region-usa-text)',
      }}
    >
      {region || '—'}
    </span>
  );
}
