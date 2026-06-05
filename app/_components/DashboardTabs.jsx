'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Summary' },
  { href: '/groups', label: 'Groups' },
  { href: '/cases', label: 'Tracker' },
  { href: '/analytics', label: 'Analytics' },
];

function isActive(pathname, href) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardTabs() {
  const pathname = usePathname();

  return (
    <div style={wrap}>
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`mz-clickable ${isActive(pathname, tab.href) ? 'active' : ''}`}
          style={tabStyle}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

const wrap = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  margin: '18px 0 20px',
};

const tabStyle = {
  minHeight: 34,
  padding: '8px 13px',
  display: 'inline-flex',
  alignItems: 'center',
};
