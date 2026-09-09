'use client';

/**
 * What the roles this person applied to asked for, and their CV did not show.
 *
 * The first version of this was a row of chips that rendered only when there
 * were gaps to show. That is the failure mode a feature cannot recover from: a
 * candidate with applications but no computed gaps saw an ordinary courses page
 * and had no way to tell the difference between "nothing to report" and "this
 * does not exist". So this component always renders something, and each empty
 * case says which one it is and what to do about it.
 *
 * Cards rather than chips because a gap is not one word. It is a skill, how
 * many roles wanted it, WHICH roles, and an action — and the count is the
 * persuasive part: one advert asking for Kubernetes is a preference, four is a
 * pattern worth a weekend.
 */

import { useState } from 'react';
import { FiTarget, FiArrowRight, FiChevronDown, FiChevronUp, FiFileText } from 'react-icons/fi';

export interface SkillGap {
  skill: string;
  demandedBy: number;
  roles: string[];
}

type Props = {
  gaps: SkillGap[];
  applications: number;
  /** False when no uploaded CV has readable text — a different problem. */
  cvReadable?: boolean;
  activeGap: string;
  onSelect: (skill: string) => void;
  loading?: boolean;
};

const VISIBLE = 3;

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-5 md:p-7 mb-6">
    {children}
  </div>
);

const Header = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="flex items-start gap-4">
    <div className="hidden sm:flex w-11 h-11 rounded-2xl bg-[#f5f1f7] items-center justify-center shrink-0">
      <FiTarget className="text-[var(--sf-violet)]" size={19} />
    </div>
    <div className="min-w-0">
      <h3 className="font-century text-lg md:text-xl font-black text-slate-800">{title}</h3>
      <p className="font-raleway text-sm text-gray-500 mt-1 leading-relaxed">{subtitle}</p>
    </div>
  </div>
);

export default function SkillGaps({
  gaps,
  applications,
  cvReadable = true,
  activeGap,
  onSelect,
  loading,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <Frame>
        <Header title="Skills your applications asked for" subtitle="Reading your applications…" />
      </Frame>
    );
  }

  // Never applied to anything. Say what this becomes rather than hiding — the
  // feature is a reason to apply, and nobody discovers a panel that is absent.
  if (applications === 0) {
    return (
      <Frame>
        <Header
          title="Skills your applications asked for"
          subtitle="Apply to a role through Smartfolio and we will list exactly which skills its advert asked for that your CV does not show — then find courses for them."
        />
      </Frame>
    );
  }

  /*
   * Applied, but we cannot read their CV — so there is nothing to subtract the
   * role's requirements FROM. Distinct from "no gaps", which would read as
   * "your CV covers everything" when the truth is we could not look at it.
   */
  if (!cvReadable) {
    return (
      <Frame>
        <Header
          title="Skills your applications asked for"
          subtitle={`You have applied to ${applications} role${applications === 1 ? '' : 's'}, but none of your uploaded CVs can be read.`}
        />
        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[#fdf8ee] px-4 py-3.5">
          <FiFileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="font-raleway text-sm leading-relaxed text-amber-900">
            We compare what each role asked for against your CV, so we need one we can read
            — a scanned photograph or an unusual PDF will not do. Upload it again on{' '}
            <span className="font-semibold">Resume Analysis</span> and this fills in
            straight away.
          </p>
        </div>
      </Frame>
    );
  }

  /*
   * Applied, CV readable, nothing missing. Almost always one thing: the CV could not be
   * read for those applications, so there was no text to compare against the
   * advert. Saying "no gaps found" here would be a lie by omission — it reads
   * as "your CV covers everything", which is the opposite of what happened.
   */
  if (gaps.length === 0) {
    return (
      <Frame>
        <Header
          title="Skills your applications asked for"
          subtitle={`Nothing missing. Your CV shows everything the ${applications === 1 ? 'role you applied to' : `${applications} roles you applied to`} asked for.`}
        />
      </Frame>
    );
  }

  const shown = expanded ? gaps : gaps.slice(0, VISIBLE);
  const top = gaps[0].demandedBy;

  return (
    <Frame>
      <Header
        title="Skills your applications asked for"
        subtitle={`Taken from ${applications} role${applications === 1 ? '' : 's'} you applied to and checked against your CV. Pick one to find courses for it.`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mt-6">
        {shown.map((gap) => {
          const active = activeGap === gap.skill;
          return (
            <button
              key={gap.skill}
              onClick={() => onSelect(gap.skill)}
              aria-pressed={active}
              className={`text-left rounded-2xl border-2 p-4 transition-all ${
                active
                  ? 'border-[var(--sf-violet)] bg-[#faf7fc]'
                  : 'border-gray-100 hover:border-gray-200 bg-white'
              }`}
            >
              {/*
                A bar, not just a number: three cards of "2 of 5" read the same
                at a glance, while three bars of different lengths do not.
                Scaled against the top gap so the strongest always fills it.
              */}
              <div className="flex items-center gap-2.5">
                <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--sf-violet)]"
                    style={{ width: `${Math.max(12, (gap.demandedBy / top) * 100)}%` }}
                  />
                </div>
                <span className="font-raleway text-xs font-bold text-gray-500 shrink-0">
                  {gap.demandedBy} of {applications}
                </span>
              </div>

              <p className="font-century text-base font-black text-slate-800 mt-3 capitalize">
                {gap.skill}
              </p>

              {/* Which roles wanted it — the evidence behind the number. */}
              <p className="font-raleway text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-2">
                {gap.roles.join(' · ')}
              </p>

              <span
                className={`font-raleway inline-flex items-center gap-1.5 text-xs font-bold mt-4 ${
                  active ? 'text-[var(--sf-violet)]' : 'text-slate-700'
                }`}
              >
                {active ? 'Showing these courses' : 'Find courses'}
                <FiArrowRight size={13} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
        {gaps.length > VISIBLE ? (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="font-raleway inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-slate-800"
          >
            {expanded ? (
              <>
                Show fewer <FiChevronUp size={15} />
              </>
            ) : (
              <>
                Show {gaps.length - VISIBLE} more <FiChevronDown size={15} />
              </>
            )}
          </button>
        ) : (
          <span />
        )}

        {activeGap && (
          <button
            onClick={() => onSelect(activeGap)}
            className="font-raleway text-sm font-semibold text-gray-500 hover:text-gray-600"
          >
            Show all courses
          </button>
        )}
      </div>
    </Frame>
  );
}
