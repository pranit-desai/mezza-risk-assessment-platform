'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import SignOutButton from './SignOutButton';

const NAV = [
  { href: '/', label: 'Portfolio' },
  { href: '/cases', label: 'Tracker' },
  { href: '/analytics', label: 'Analytics' },
];

const REGIONS = ['All', 'UAE', 'USA'];

function isActive(pathname, href) {
  if (href === '/') return pathname === '/' || pathname === '/groups' || pathname.startsWith('/groups/');
  return pathname === href || pathname.startsWith(`${href}/`);
}

function hrefWithRegion(pathname, searchParams, region) {
  const params = new URLSearchParams(searchParams.toString());
  if (region === 'All') params.delete('region');
  else params.set('region', region);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ''}`;
}

export default function TopCommandBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeRegion = (searchParams.get('region') || 'All').toUpperCase();

  return (
    <header style={bar}>
      <Link href="/" style={brand}>
        <span style={mark}>M</span>
        <span style={wordmark}>MEZZA</span>
      </Link>

      <nav style={nav}>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`mz-clickable ${isActive(pathname, item.href) ? 'active' : ''}`}
            style={navButton}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div style={controls}>
        <div style={segment}>
          {REGIONS.map((region) => (
            <Link
              key={region}
              href={hrefWithRegion(pathname, searchParams, region)}
              className={`mz-clickable ${(activeRegion || 'ALL') === region.toUpperCase() ? 'active' : ''}`}
              style={smallButton}
            >
              {region}
            </Link>
          ))}
        </div>

        <div style={defaultGroup}>
          <span style={defaultLabel}>Default:</span>
          <button className="mz-clickable active" style={smallButton}>Recommended</button>
          <button className="mz-clickable" style={smallButton}>Custom</button>
        </div>

        <button className="mz-clickable active" style={actionButton}>+ Add</button>
        <button className="mz-clickable active" style={{ ...actionButton, color: 'var(--mz-ai-accent)', borderColor: 'rgba(139, 92, 246, 0.45)', background: 'rgba(139, 92, 246, 0.13)' }}>
          AI Import
        </button>
        <button className="mz-clickable" style={smallButton}>CSV</button>
        <button className="mz-clickable" style={smallButton}>JSON</button>
        <SignOutButton compact style={{ height: 28, fontSize: 10, fontWeight: 800 }} />
      </div>
    </header>
  );
}

const bar = {
  position: 'sticky',
  top: 0,
  zIndex: 20,
  minHeight: 52,
  background: '#121212',
  borderBottom: '1px solid var(--mz-border-on-page)',
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto',
  alignItems: 'center',
  gap: 18,
  padding: '8px 20px 8px 24px',
};

const brand = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 11,
  minWidth: 170,
};

const mark = {
  width: 32,
  height: 32,
  borderRadius: 8,
  background: 'linear-gradient(135deg, var(--mz-accent), var(--mz-accent-light))',
  color: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 900,
  fontSize: 15,
};

const wordmark = {
  color: 'var(--mz-accent)',
  letterSpacing: 3,
  fontWeight: 900,
  fontSize: 16,
};

const nav = {
  display: 'flex',
  justifyContent: 'center',
  gap: 7,
};

const navButton = {
  minWidth: 98,
  height: 30,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textTransform: 'uppercase',
  letterSpacing: 1.7,
  fontSize: 11,
};

const controls = {
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
};

const segment = {
  display: 'flex',
  gap: 6,
};

const defaultGroup = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  borderLeft: '1px solid var(--mz-border-input)',
  paddingLeft: 10,
};

const defaultLabel = {
  color: 'var(--mz-muted)',
  fontSize: 10,
};

const smallButton = {
  height: 28,
  minWidth: 52,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '5px 11px',
  fontSize: 10,
  fontWeight: 800,
};

const actionButton = {
  height: 30,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '6px 12px',
  fontSize: 11,
  fontWeight: 900,
};
