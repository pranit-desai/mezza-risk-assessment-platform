'use client';

import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import TopCommandBar from './TopCommandBar';

const PUBLIC_FULL_PAGE_PREFIXES = ['/connect', '/login'];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const fullPage = PUBLIC_FULL_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (fullPage) {
    return children;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mz-page)' }}>
      <Suspense fallback={null}>
        <TopCommandBar />
      </Suspense>
      <main style={{ minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
