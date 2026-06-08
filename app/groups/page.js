'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import RegionBadge from '../_components/RegionBadge';

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [state, setState] = useState('loading');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/groups', { cache: 'no-store' });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        setGroups(Array.isArray(data) ? data : []);
        setState('ok');
      } catch (e) {
        setMsg(e.message || 'Failed to load groups');
        setState('error');
      }
    })();
  }, []);

  return (
    <div style={{ padding: '32px 40px', color: 'var(--mz-text-on-page)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: 0 }}>Groups</h1>
          <p style={{ color: 'var(--mz-accent)', marginTop: 6, marginBottom: 0 }}>
            Registered borrower groups and their venues.
          </p>
        </div>
        <Link href="/new-case" className="mz-clickable" style={{ padding: '8px 16px', textDecoration: 'none' }}>
          + New Case
        </Link>
      </div>

      {state === 'loading' && (
        <div style={emptyBox}>Loading groups...</div>
      )}

      {state === 'error' && (
        <div style={{ ...emptyBox, background: 'var(--mz-red-bg)', border: '1px solid var(--mz-red-border)', color: 'var(--mz-red-text)' }}>
          Failed to load groups: {msg}
        </div>
      )}

      {state === 'ok' && groups.length === 0 && (
        <div style={emptyBox}>
          No registered groups yet.{' '}
          <Link href="/new-case" style={{ color: 'var(--mz-accent)' }}>Add the first case intake -&gt;</Link>
        </div>
      )}

      {state === 'ok' && groups.length > 0 && (
        <section className="mz-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={th}>Group Name</th>
                  <th style={th}>Region</th>
                  <th style={{ ...th, textAlign: 'right' }}>Venues</th>
                  <th style={th} />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td style={{ ...td, fontWeight: 900 }}>
                      <Link
                        href={`/groups/${g.group_key}`}
                        style={{ color: 'var(--mz-text)', textDecoration: 'none' }}
                      >
                        {g.group_name}
                      </Link>
                    </td>
                    <td style={td}>
                      <RegionBadge region={g.region} />
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mz-font-mono)' }}>
                      {g.venue_count}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <Link
                        href={`/groups/${g.group_key}`}
                        style={{ color: 'var(--mz-accent)', textDecoration: 'none' }}
                      >
                        Open -&gt;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

const emptyBox = {
  padding: 18,
  borderRadius: 8,
  background: 'var(--mz-card)',
  border: '1px solid var(--mz-border)',
  color: 'var(--mz-muted)',
};

const th = {
  padding: '12px 14px',
  textAlign: 'left',
  fontSize: 'var(--mz-fs-xxs)',
  fontWeight: 800,
  color: 'var(--mz-muted)',
  textTransform: 'uppercase',
  letterSpacing: 1.2,
  borderBottom: '1px solid var(--mz-border-soft)',
};

const td = {
  padding: '13px 14px',
  fontSize: 'var(--mz-fs-sm)',
  borderBottom: '1px solid var(--mz-border-subtle)',
  color: 'var(--mz-text)',
};
