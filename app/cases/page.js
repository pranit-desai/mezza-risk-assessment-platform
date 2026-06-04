'use client';

import { useEffect, useState } from 'react';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import CaseSearchBox from '../_components/CaseSearchBox';
import { filterCasesByQuery } from '../_lib/caseSearch';

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function CasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState([]);
  const [query, setQuery] = useState('');
  const [state, setState] = useState('loading'); // loading | ok | error
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/cases`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        setCases(Array.isArray(data) ? data : data.cases ?? []);
        setState('ok');
      } catch (e) {
        setMsg(e.message);
        setState('error');
      }
    })();
  }, []);

  const visibleCases = useMemo(() => filterCasesByQuery(cases, query), [cases, query]);

  return (
    <div style={{ padding: '32px 40px', color: '#f5f1ea' }}>
      <h1 style={{ fontSize: 34, fontWeight: 800, margin: 0 }}>Cases</h1>
      <p style={{ color: '#e8a07a', marginTop: 6 }}>
        Every venue case in the risk pipeline.
      </p>

      <CaseSearchBox
        value={query}
        onChange={setQuery}
        resultCount={visibleCases.length}
        totalCount={cases.length}
      />

      <div
        style={{
          marginTop: 28,
          background: '#0c0a09',
          border: '1px solid #1f1a16',
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            color: '#e8604a',
            fontSize: 12,
            letterSpacing: 1.5,
            fontWeight: 700,
          }}
        >
          CASES
        </div>

        {state === 'loading' && (
          <div style={{ padding: 24, color: '#8a817a' }}>Loading cases…</div>
        )}

        {state === 'error' && (
          <div
            style={{
              margin: 20,
              padding: 16,
              borderRadius: 10,
              background: 'rgba(232,96,74,0.08)',
              border: '1px solid rgba(232,96,74,0.3)',
              color: '#e8604a',
            }}
          >
            Failed to load cases: {msg}
          </div>
        )}

        {state === 'ok' && visibleCases.length === 0 && (
          <div style={{ padding: 24, color: '#8a817a' }}>No cases match your search.</div>
        )}

        {state === 'ok' && visibleCases.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ color: '#8a817a', textAlign: 'left', fontSize: 11, letterSpacing: 1 }}>
                <th style={th}>CASE REF</th>
                <th style={th}>VENUE</th>
                <th style={th}>GROUP</th>
                <th style={th}>SCORE</th>
                <th style={th}>GRADE</th>
                <th style={th}>CEILING (AED)</th>
                <th style={th}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {visibleCases.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/cases/${c.id}`)}
                  style={{ borderTop: '1px solid #1f1a16', cursor: 'pointer' }}
                >
                  <td style={{ ...td, color: '#e8604a', fontWeight: 700 }}>{c.case_ref}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{c.venue ?? c.venue_name ?? '—'}</td>
                  <td style={{ ...td, color: '#b8a89c' }}>{c.group ?? c.group_name ?? '—'}</td>
                  <td style={{ ...td, color: '#36c692', fontWeight: 700 }}>{c.score ?? '—'}</td>
                  <td style={{ ...td, color: '#36c692' }}>{c.grade ?? '—'}</td>
                  <td style={{ ...td, color: '#e8604a' }}>
                    {c.ceiling_aed ? `AED ${(c.ceiling_aed / 1e6).toFixed(2)}M` : '—'}
                  </td>
                  <td style={{ ...td, color: '#b8a89c' }}>{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const th = { padding: '12px 20px' };
const td = { padding: '16px 20px' };
