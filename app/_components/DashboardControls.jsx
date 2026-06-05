'use client';

const REGIONS = ['All', 'UAE', 'USA'];

export default function DashboardControls({ region = 'All', onRegionChange, mode = 'Recommended', onModeChange }) {
  return (
    <div style={wrap}>
      <div style={group}>
        {REGIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onRegionChange?.(r)}
            className={`mz-clickable ${region === r ? 'active' : ''}`}
            style={button}
          >
            {r}
          </button>
        ))}
      </div>

      <div style={group}>
        <span style={label}>Default:</span>
        {['Recommended', 'Custom'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange?.(m)}
            className={`mz-clickable ${mode === m ? 'active' : ''}`}
            style={button}
          >
            {m}
          </button>
        ))}
      </div>

      <div style={{ ...group, marginLeft: 'auto' }}>
        <button type="button" className="mz-clickable active" style={button}>+ Add</button>
        <button
          type="button"
          className="mz-clickable active"
          style={{
            ...button,
            color: 'var(--mz-ai-accent)',
            borderColor: 'rgba(139, 92, 246, 0.45)',
            background: 'rgba(139, 92, 246, 0.13)',
          }}
        >
          AI Import
        </button>
        <button type="button" className="mz-clickable" style={button}>CSV</button>
      </div>
    </div>
  );
}

const wrap = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  margin: '0 0 18px',
};

const group = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  flexWrap: 'wrap',
};

const label = {
  color: 'var(--mz-muted)',
  fontSize: 'var(--mz-fs-xs)',
};

const button = {
  minHeight: 28,
  padding: '6px 11px',
  fontSize: 'var(--mz-fs-xs)',
  fontWeight: 800,
};
