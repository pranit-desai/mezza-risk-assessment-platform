'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { slugifyGroupName } from '@/app/_lib/casePresentation';

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 'var(--mz-radius-sm)',
  border: '1px solid var(--mz-border-input)',
  background: 'var(--mz-card-nested)',
  color: 'var(--mz-text)',
  fontFamily: 'var(--mz-font-sans)',
  fontSize: 'var(--mz-fs-body)',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  marginBottom: 6,
  fontSize: 'var(--mz-fs-sm)',
  fontWeight: 700,
  color: 'var(--mz-muted)',
};

function NewGroupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillKey = searchParams.get('group_key') || '';
  const prefillName = searchParams.get('group_name') || '';

  const derivedKey = prefillKey || (prefillName ? slugifyGroupName(prefillName) : '');
  const [form, setForm] = useState({
    group_name: prefillName,
    group_key: derivedKey,
    region: '',
    commercial_poc: '',
  });
  const [keyTouched, setKeyTouched] = useState(!!prefillKey);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handleNameChange(value) {
    const derived = value.trim() ? slugifyGroupName(value) : '';
    setForm((f) => ({
      ...f,
      group_name: value,
      group_key: keyTouched ? f.group_key : derived,
    }));
  }

  function handleKeyChange(value) {
    setKeyTouched(true);
    setForm((f) => ({ ...f, group_key: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_name: form.group_name,
          group_key: form.group_key,
          region: form.region,
          commercial_poc: form.commercial_poc || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create group');
        return;
      }
      router.push(`/groups/${data.group_key}`);
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ padding: '32px 40px' }}>
      <Link
        href="/groups"
        style={{ color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-sm)', textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}
      >
        ← Groups
      </Link>
      <h1 style={{ margin: '0 0 28px', fontSize: 'var(--mz-fs-h1)', fontWeight: 800 }}>New Group</h1>

      <div className="mz-card" style={{ maxWidth: 520 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle} htmlFor="group_name">
              Group name <span style={{ color: 'var(--mz-accent)' }}>*</span>
            </label>
            <input
              id="group_name"
              type="text"
              style={inputStyle}
              value={form.group_name}
              onChange={(e) => handleNameChange(e.target.value)}
              autoFocus={!prefillName}
              required
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle} htmlFor="group_key">
              Group key (slug) <span style={{ color: 'var(--mz-accent)' }}>*</span>
            </label>
            <input
              id="group_key"
              type="text"
              style={inputStyle}
              value={form.group_key}
              onChange={(e) => handleKeyChange(e.target.value)}
              required
            />
            <p style={{ margin: '4px 0 0', fontSize: 'var(--mz-fs-xs)', color: 'var(--mz-muted)' }}>
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle} htmlFor="region">
              Region <span style={{ color: 'var(--mz-accent)' }}>*</span>
            </label>
            <select
              id="region"
              style={inputStyle}
              value={form.region}
              onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
              required
            >
              <option value="">Select region</option>
              <option value="UAE">UAE</option>
              <option value="USA">USA</option>
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle} htmlFor="commercial_poc">Commercial PoC</label>
            <input
              id="commercial_poc"
              type="text"
              style={inputStyle}
              value={form.commercial_poc}
              onChange={(e) => setForm((f) => ({ ...f, commercial_poc: e.target.value }))}
              placeholder="Name or email"
            />
          </div>

          {error && (
            <p style={{ margin: '0 0 16px', color: 'var(--mz-red-text)', fontSize: 'var(--mz-fs-sm)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '10px 0',
              background: submitting ? 'var(--mz-accent-25)' : 'var(--mz-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--mz-radius-md)',
              fontFamily: 'var(--mz-font-sans)',
              fontSize: 'var(--mz-fs-body)',
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Creating…' : 'Create group'}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function NewGroupPage() {
  return (
    <Suspense fallback={<main style={{ padding: '32px 40px' }}><p style={{ color: 'var(--mz-muted)' }}>Loading…</p></main>}>
      <NewGroupForm />
    </Suspense>
  );
}
