'use client';

/**
 * Skills the roles around this person ask for, that their CV does not show.
 *
 * Two groups, deliberately never merged. Roles they APPLIED to are the
 * strongest evidence about them — they chose those. Roles merely MATCHED to
 * them are weaker, but they are the only thing available before anyone applies
 * to anything, which is most people most of the time. One blended number would
 * claim "6 roles wanted this" where five were never seen.
 *
 * This section always renders. An earlier version showed only when it had gaps,
 * which is the one failure a feature cannot recover from: a candidate saw an
 * ordinary courses page and could not tell "nothing to report" from "this does
 * not exist".
 */

import { useState } from 'react';
import { FiTarget, FiArrowRight, FiChevronDown, FiChevronUp, FiFileText, FiGlobe } from 'react-icons/fi';

export interface SkillGap {
  skill: string;
  demandedBy: number;
  roles: string[];
}

type Props = {
  applied: SkillGap[];
  market: SkillGap[];
  applications: number;
  jobsScanned: number;
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

/**
 * One group of gaps.
 *
 * `denominator` is what the count is out of, and it differs per group — "3 of 5
 * applications" against "in 6 matched jobs". Saying it on every card is what
 * keeps the two from being read as the same measurement.
 */
function Group({
  icon: Icon,
  label,
  hint,
  gaps,
  denominator,
  activeGap,
  onSelect,
}: {
  icon: typeof FiTarget;
  label: string;
  hint: string;
  gaps: SkillGap[];
  denominator: (g: SkillGap) => string;
  activeGap: string;
  onSelect: (skill: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!gaps.length) return null;
  const shown = expanded ? gaps : gaps.slice(0, VISIBLE);
  const top = gaps[0].demandedBy || 1;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <Icon className="text-gray-500" size={14} />
        <p className="font-raleway text-xs font-bold uppercase tracking-wider text-gray-500">
          {label}
        </p>
      </div>
      <p className="font-raleway text-xs text-gray-500 mt-1">{hint}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mt-3">
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
              {/* A bar, not just a number: three cards reading "2 of 5" look
                  identical at a glance, three bars of different lengths do not. */}
              <div className="flex items-center gap-2.5">
                <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--sf-violet)]"
                    style={{ width: `${Math.max(12, (gap.demandedBy / top) * 100)}%` }}
                  />
                </div>
                <span className="font-raleway text-xs font-bold text-gray-500 shrink-0">
                  {denominator(gap)}
                </span>
              </div>

              <p className="font-century text-base font-black text-slate-800 mt-3 capitalize">
                {gap.skill}
              </p>

              {/* The roles that asked — the evidence behind the number. */}
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

      {gaps.length > VISIBLE && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="font-raleway inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-slate-800 mt-3"
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
      )}
    </div>
  );
}

export default function SkillGaps({
  applied,
  market,
  applications,
  jobsScanned,
  cvReadable = true,
  activeGap,
  onSelect,
  loading,
}: Props) {
  if (loading) {
    return (
      <Frame>
        <Header title="Skills worth learning next" subtitle="Reading the roles around you…" />
      </Frame>
    );
  }

  // No readable CV: there is nothing to subtract the requirements FROM. Not the
  // same as "no gaps", which would read as "your CV covers everything".
  if (!cvReadable) {
    return (
      <Frame>
        <Header
          title="Skills worth learning next"
          subtitle="We compare what roles ask for against your CV — and none of your uploaded CVs can be read yet."
        />
        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[#fdf8ee] px-4 py-3.5">
          <FiFileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="font-raleway text-sm leading-relaxed text-amber-900">
            A scanned photograph or an unusual PDF will not do. Upload it again on{' '}
            <span className="font-semibold">Resume Analysis</span> and this fills in straight away.
          </p>
        </div>
      </Frame>
    );
  }

  const nothing = applied.length === 0 && market.length === 0;

  if (nothing) {
    return (
      <Frame>
        <Header
          title="Skills worth learning next"
          subtitle={
            applications > 0
              ? `Nothing missing. Your CV shows everything the ${applications === 1 ? 'role you applied to' : `${applications} roles you applied to`} asked for.`
              : jobsScanned > 0
                ? `Nothing missing — your CV covers what the ${jobsScanned} roles matched to you are asking for.`
                : 'Once jobs are matched to you, or you apply to a role, we will list the skills those adverts ask for that your CV does not show.'
          }
        />
      </Frame>
    );
  }

  return (
    <Frame>
      <Header
        title="Skills worth learning next"
        subtitle="Taken from what real adverts ask for and checked against your CV. Pick one to find courses for it."
      />

      <Group
        icon={FiTarget}
        label="From roles you applied to"
        hint={`Across ${applications} application${applications === 1 ? '' : 's'} you chose.`}
        gaps={applied}
        denominator={(g) => `${g.demandedBy} of ${applications}`}
        activeGap={activeGap}
        onSelect={onSelect}
      />

      <Group
        icon={FiGlobe}
        label="What the market is asking for"
        /*
          The count is the jobs this was actually drawn from, and nothing more.
          How many adverts were too thin to read is our problem with our
          sources — a candidate cannot act on it, and narrating it would
          advertise a weakness in place of the answer they came for. The figure
          is still returned by the API for whoever is choosing the source mix.
        */
        hint={`Across ${jobsScanned} job${jobsScanned === 1 ? '' : 's'} matched to you. You have not applied to these.`}
        gaps={market}
        denominator={(g) => `in ${g.demandedBy}`}
        activeGap={activeGap}
        onSelect={onSelect}
      />

      {activeGap && (
        <button
          onClick={() => onSelect(activeGap)}
          className="font-raleway text-sm font-semibold text-gray-500 hover:text-gray-600 mt-5"
        >
          Show all courses
        </button>
      )}
    </Frame>
  );
}
