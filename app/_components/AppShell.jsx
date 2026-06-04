'use client';

import { usePathname } from 'next/navigation';
import ApiStatusPill from './ApiStatusPill';
import Sidebar from './Sidebar';

const PUBLIC_FULL_PAGE_PREFIXES = ['/connect'];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const fullPage = PUBLIC_FULL_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (fullPage) {
    return children;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--mz-page)' }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid var(--mz-border-on-page)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'var(--mz-page)',
          }}
        >
          <ApiStatusPill />
        </div>
        {children}
      </main>
    </div>
  );
}
