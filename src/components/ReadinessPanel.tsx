'use client';

/**
 * How this CV measures against the roles the person is aiming at.
 *
 * Shown on a general analysis — one with no job description — where the tool
 * used to have nothing specific to say. The benchmark is not a rule of thumb:
 * it is counted from real postings on the platform, so "61% of the roles like
 * yours ask for testing" is a fact about the market rather than advice.
 *
 * Two things it deliberately does NOT do. It never sits beside an application
 * score, because "78% ready" and "your application scored 78" answer different
 * questions and nobody would read them as different. And it never presents a
 * gap as a failure — a gap is where the next month of effort goes, which is
 * why every one of them is a link rather than a verdict.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiTrendingUp, FiTarget, FiAward } from 'react-icons/fi';
import { fetchReadiness, type DemandTerm, type ReadinessReport } from '@/lib/readiness';

const pct = (share: number) => `${Math.round(share * 100)}%`;

function Term({ term, tone }: { term: DemandTerm; tone: 'have' | 'gap' | 'edge' }) {
  const colour =
    tone === 'have'
      ? 'text-[var(--sf-green)]'
      : tone === 'gap'
        ? 'text-[var(--sf-yellow)]'
        : 'text-[var(--sf-primary-dark)]';
  return (
    <li className="flex items-baseline justify-between gap-3 border-b border-[var(--sf-line)] py-2 last:border-0">
      <span className="text-sm font-semibold capitalize text-[var(--sf-ink)]">{term.term}</span>
      <span className={`shrink-0 text-[13px] font-semibold tabular-nums ${colour}`}>
        {pct(term.share)} of postings
      </span>
    </li>
  );
}

export default function ReadinessPanel({ role }: { role?: string }) {
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'none'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetchReadiness(role)
      .then((r) => {
        if (cancelled) return;
        setReport(r);
        setState(r ? 'ready' : 'none');
      })
      .catch(() => !cancelled && setState('none'));
    return () => {
      cancelled = true;
    };
  }, [role]);

  if (state === 'loading') return null;

  // Too few postings to measure against. Saying so beats inventing a number
  // from four adverts and calling it market data.
  if (state === 'none' || !report) return null;

  return (
    <section
      className="rounded-2xl border border-[var(--sf-border)] bg-white p-6"
      data-testid="readiness-panel"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-century text-lg font-black text-slate-800">
          How you compare to the market
        </h2>
        <span className="font-raleway text-[13px] text-slate-500">
          {report.targetRole} · measured against {report.postingsAnalysed} live postings
        </span>
      </div>

      <p className="font-raleway mt-1.5 text-sm leading-relaxed text-slate-500">
        Your CV shows {report.strengths.length} of the{' '}
        {report.strengths.length + report.gaps.length} things these roles ask for most. This is
        about the market, not about any one application.
      </p>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="font-raleway mb-1 flex items-center gap-2 text-sm font-bold text-[var(--sf-green)]">
            <FiTrendingUp className="h-4 w-4" /> You already show
          </h3>
          {report.strengths.length ? (
            <ul>
              {report.strengths.map((t) => (
                <Term key={t.term} term={t} tone="have" />
              ))}
            </ul>
          ) : (
            <p className="font-raleway text-sm text-slate-500">
              Nothing the market commonly asks for is showing on your CV yet. Start with the gaps.
            </p>
          )}
        </div>

        <div>
          <h3 className="font-raleway mb-1 flex items-center gap-2 text-sm font-bold text-[var(--sf-yellow)]">
            <FiTarget className="h-4 w-4" /> Worth adding next
          </h3>
          {report.gaps.length ? (
            <>
              <ul>
                {report.gaps.map((t) => (
                  <Term key={t.term} term={t} tone="gap" />
                ))}
              </ul>
              <p className="font-raleway mt-2 text-[13px] leading-relaxed text-slate-500">
                Have you done any of these without writing them down? Say so on your CV before
                learning anything new. If they are genuinely new,{' '}
                <Link href="/courses" className="font-bold text-[var(--sf-primary-dark)] underline">
                  start with a course
                </Link>
                .
              </p>
            </>
          ) : (
            <p className="font-raleway text-sm text-slate-500">
              Nothing common is missing. Look at the roles themselves rather than the CV.
            </p>
          )}
        </div>
      </div>

      {report.differentiators.length > 0 && (
        <div className="mt-5 rounded-xl bg-[var(--sf-primary-soft)] p-4">
          <h3 className="font-raleway mb-1 flex items-center gap-2 text-sm font-bold text-[var(--sf-primary-dark)]">
            <FiAward className="h-4 w-4" /> What makes you unusual
          </h3>
          <p className="font-raleway text-[13px] leading-relaxed text-slate-600">
            Few postings ask for{' '}
            {report.differentiators.map((d, i) => (
              <span key={d.term}>
                {i > 0 && (i === report.differentiators.length - 1 ? ' and ' : ', ')}
                <strong className="capitalize text-slate-800">{d.term}</strong> ({pct(d.share)})
              </span>
            ))}
            . Lead with that where a role does want it.
          </p>
        </div>
      )}
    </section>
  );
}
