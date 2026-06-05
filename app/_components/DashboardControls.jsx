'use client';

const REGIONS = ['All', 'UAE', 'USA'];

export default function DashboardControls({ region = 'All', onRegionChange }) {
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

const button = {
  minHeight: 28,
  padding: '6px 11px',
  fontSize: 'var(--mz-fs-xs)',
  fontWeight: 800,
};
