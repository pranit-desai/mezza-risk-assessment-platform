'use client';

export default function CaseSearchBox({ value, onChange, resultCount, totalCount }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        margin: '18px 0 22px',
        maxWidth: 680,
      }}
    >
      <div style={{ position: 'relative', flex: 1 }}>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 13,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--mz-muted)',
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Search
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Case ref, group, or venue"
          style={{
            width: '100%',
            height: 40,
            paddingLeft: 78,
            background: 'var(--mz-card)',
            borderColor: 'var(--mz-border-input)',
          }}
        />
      </div>
      <div
        className="mz-mono"
        style={{
          color: 'var(--mz-muted)',
          fontSize: 'var(--mz-fs-xs)',
          whiteSpace: 'nowrap',
        }}
      >
        {resultCount}/{totalCount}
      </div>
    </div>
  );
}
