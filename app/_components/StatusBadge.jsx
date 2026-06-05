import { statusLabel, statusStyle } from '../_lib/casePresentation';

export default function StatusBadge({ status, value }) {
  const badgeStatus = status ?? value;
  const style = statusStyle(badgeStatus);
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 9px',
        borderRadius: 6,
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.color,
        fontSize: 'var(--mz-fs-xs)',
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {statusLabel(badgeStatus)}
    </span>
  );
}
