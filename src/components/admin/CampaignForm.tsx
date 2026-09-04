'use client';

/**
 * The campaign form, shared by create and edit.
 *
 * One component for both because the fields are identical and the only real
 * difference is what happens on submit. Two copies would drift the moment a
 * field is added to one of them, and the drift would show up as "the edit page
 * silently drops my questions".
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiPlus, FiTrash2, FiChevronLeft, FiX } from 'react-icons/fi';
import { Select } from '@/components/ui/Select';
import { useFeedback } from '@/components/ui/feedback';
import type { Campaign, CampaignQuestion } from '@/lib/admin';
import { APPLY_COUNTRIES } from '@/lib/countries';

export interface CampaignFormValues {
  title: string;
  company: string;
  jobDescription: string;
  location: string;
  jobType: string;
  /**
   * Countries the role can hire from. Empty means anywhere.
   *
   * `location` is prose for the applicant to read; this is the part matching
   * scores against, because "Remote — Europe & Asia" cannot be compared to
   * anything.
   */
  candidateCountries: string[];
  /**
   * Held as a STRING while editing.
   *
   * Coercing on every keystroke is what made clearing the field show 0, and
   * then typing into that 0 produce "013". A half-typed number is a string; it
   * becomes a number once, at submit.
   */
  shortlistTarget: string;
  applicationDeadline: string;
  interviewDeadline: string;
  questions: CampaignQuestion[];
}

const JOB_TYPES = [
  { value: 'Remote', label: 'Remote' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'On-site', label: 'On-site' },
  { value: 'Contract', label: 'Contract' },
];

/**
 * How the APPLICANT answers. Named from their side of the form, because
 * "Choose one" read as an instruction to the person building it.
 */
const QUESTION_TYPES = [
  { value: 'textarea', label: 'Paragraph answer' },
  { value: 'text', label: 'Short text answer' },
  { value: 'select', label: 'Pick from a list' },
];

export function emptyValues(): CampaignFormValues {
  return {
    title: '',
    company: '',
    jobDescription: '',
    location: '',
    jobType: 'Remote',
    candidateCountries: [],
    shortlistTarget: '25',
    applicationDeadline: '',
    interviewDeadline: '',
    questions: [],
  };
}

export function valuesFrom(campaign: Campaign): CampaignFormValues {
  return {
    title: campaign.title,
    company: campaign.company,
    jobDescription: campaign.jobDescription,
    location: campaign.location ?? '',
    jobType: campaign.jobType ?? 'Remote',
    candidateCountries: campaign.candidateCountries ?? [],
    shortlistTarget: String(campaign.shortlistTarget ?? 25),
    applicationDeadline: toDateInput(campaign.applicationDeadline),
    interviewDeadline: toDateInput(campaign.interviewDeadline),
    questions: campaign.questions ?? [],
  };
}

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export default function CampaignForm({
  mode,
  initial,
  backHref,
  onSubmit,
  counts,
}: {
  mode: 'create' | 'edit';
  initial: CampaignFormValues;
  backHref: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  /** Candidates already on this campaign, by status. Drives the live-edit warning. */
  counts?: Partial<Record<string, number>>;
}) {
  const router = useRouter();
  const { error } = useFeedback();
  const [v, setV] = useState<CampaignFormValues>(initial);
  const [saving, setSaving] = useState(false);

  /** Anyone at all on this campaign — the warning is about live edits, not status. */
  const applicants = Object.values(counts ?? {}).reduce<number>((a, b) => a + (b ?? 0), 0);

  // Not a UI preference — the API refuses it. Disabling the field means finding
  // that out before retyping a company name rather than after.
  const companyLocked = mode === 'edit' && applicants > 0;

  // The button says whether it will work. Letting someone click a live-looking
  // button and answering with a toast is the same information delivered worse.
  const incomplete =
    v.title.trim().length < 3 ||
    v.company.trim().length < 2 ||
    !v.location.trim() ||
    v.jobDescription.trim().length < 40;

  const set = <K extends keyof CampaignFormValues>(key: K, value: CampaignFormValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  function addQuestion() {
    const n = v.questions.length + 1;
    set('questions', [
      ...v.questions,
      { id: `q${n}_${Math.random().toString(36).slice(2, 6)}`, label: '', type: 'textarea', required: true },
    ]);
  }

  function updateQuestion(index: number, patch: Partial<CampaignQuestion>) {
    set(
      'questions',
      v.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  }

  async function submit() {
    if (v.title.trim().length < 3) return error('Give the role a title.');
    if (v.company.trim().length < 2) return error('Which company is this for?');
    if (v.jobDescription.trim().length < 40) {
      return error(
        'The job description is too short. It drives matching and generates the interview, so it needs the real text.',
      );
    }
    if (!v.location.trim()) {
      return error('Say where the role is. Applicants read it before anything else.');
    }

    const unlabelled = v.questions.findIndex((q) => !q.label.trim());
    if (unlabelled >= 0) return error(`Question ${unlabelled + 1} has no wording.`);

    // A "Choose one" with no options renders an empty dropdown on the apply
    // page — an applicant cannot answer it, and if it is required they cannot
    // submit at all.
    const optionless = v.questions.findIndex(
      (q) => q.type === 'select' && !(q.options ?? []).filter(Boolean).length,
    );
    if (optionless >= 0) {
      return error(`Question ${optionless + 1} is a "Choose one" with no options to choose from.`);
    }

    if (v.applicationDeadline && v.interviewDeadline) {
      if (new Date(v.interviewDeadline) < new Date(v.applicationDeadline)) {
        return error('The interview window closes before applications do: check the dates.');
      }
    }

    // Coerced once, here — not on every keystroke.
    const shortlistTarget = Math.min(500, Math.max(1, Number(v.shortlistTarget) || 25));

    setSaving(true);
    try {
      await onSubmit({
        title: v.title.trim(),
        company: v.company.trim(),
        jobDescription: v.jobDescription.trim(),
        location: v.location.trim(),
        jobType: v.jobType || undefined,
        candidateCountries: v.candidateCountries,
        shortlistTarget: shortlistTarget,
        // Dates arrive as YYYY-MM-DD; the API wants an instant. End of day so a
        // deadline of "the 30th" includes the whole of the 30th.
        applicationDeadline: v.applicationDeadline
          ? new Date(`${v.applicationDeadline}T23:59:59Z`).toISOString()
          : undefined,
        interviewDeadline: v.interviewDeadline
          ? new Date(`${v.interviewDeadline}T23:59:59Z`).toISOString()
          : undefined,
        // Strip blank option rows: an empty string in the list renders as an
        // unselectable gap in the applicant's dropdown.
        questions: v.questions.map((q) =>
          q.type === 'select'
            ? { ...q, options: (q.options ?? []).map((o) => o.trim()).filter(Boolean) }
            : { ...q, options: undefined },
        ),
      });
    } catch (e) {
      error(e instanceof Error ? e.message : 'Could not save the campaign.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="px-5 py-7 sm:px-8">
      <button
        type="button"
        onClick={() => router.push(backHref)}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--sf-muted)] hover:text-[var(--sf-primary-dark)]"
      >
        <FiChevronLeft className="h-4 w-4" /> Back
      </button>

      <h1 className="font-century text-2xl font-bold text-[var(--sf-ink)]">
        {mode === 'create' ? 'New campaign' : 'Edit campaign'}
      </h1>
      <p className="mt-1.5 max-w-[640px] text-sm leading-relaxed text-[var(--sf-muted)]">
        {mode === 'create'
          ? 'A campaign is one role: a public apply page, the applications it collects, and the interviews you invite people to. It is created as a draft. Nothing is public until you open it.'
          : 'The apply link never changes. Edits appear on it straight away.'}
      </p>

      {/* Editing a campaign people have applied to is a different act from
          editing a draft. State the rule rather than hinting at it. */}
      {mode === 'edit' && applicants > 0 && (
        <div className="sf-panel mt-4 max-w-[820px] rounded-2xl border-l-4 border-l-[var(--sf-yellow)] p-4">
          <p className="text-sm font-bold text-[var(--sf-ink)]">
            {applicants} {applicants === 1 ? 'person has' : 'people have'} applied to this role
          </p>
          <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-[var(--sf-ink-soft)]">
            <li>
              <strong>Free to change:</strong> location, shortlist target, deadlines. The apply link
              never changes either.
            </li>
            <li>
              <strong>Marks scores as stale:</strong> the description, target countries and
              arrangement. Existing scores are kept and labelled, not recalculated. A score earned
              against the role someone applied to should not be quietly replaced with one against a
              role they have never seen.
            </li>
            <li>
              <strong>Locked:</strong> the company. They applied to {v.company} by name.
            </li>
            <li>
              Interviews already sent are unaffected. Each one keeps the description it was issued
              with.
            </li>
          </ul>
          <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--sf-muted)]">
            Rewriting this into a different job? <strong>Duplicate it</strong> from the campaign page
            instead. The original keeps its applicants; the copy starts clean.
          </p>
        </div>
      )}

      <div className="mt-6 max-w-[820px] space-y-5">
        <section className="sf-panel rounded-2xl p-5 sm:p-6">
          <h2 className="mb-4 text-base font-bold text-[var(--sf-ink)]">The role</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role title" hint="As it should appear on the apply page">
              <input
                value={v.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Senior Frontend Engineer"
                className={inputClass}
                data-testid="field-title"
              />
            </Field>
            <Field
              label="Company"
              hint={
                companyLocked
                  ? 'Locked: people have applied to this employer by name'
                  : undefined
              }
            >
              <input
                value={v.company}
                onChange={(e) => set('company', e.target.value)}
                placeholder="Northwind Labs"
                disabled={companyLocked}
                className={`${inputClass} disabled:cursor-not-allowed disabled:bg-[#f8fbff] disabled:text-[var(--sf-muted)]`}
                data-testid="field-company"
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Location" hint="Shown on the apply page: prose, not a filter">
              <input
                value={v.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="Remote: Europe & Asia"
                className={inputClass}
                data-testid="field-location"
              />
            </Field>
            <Field label="Arrangement">
              <Select
                value={v.jobType}
                onChange={(value) => set('jobType', value)}
                options={JOB_TYPES}
                ariaLabel="Working arrangement"
                className={`${inputClass} flex items-center justify-between`}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field
              label="Open to candidates in"
              hint="Leave empty for anywhere. This is what matching uses. The location above is prose."
            >
              <div className="rounded-xl border border-[var(--sf-border)] bg-white p-3">
                {v.candidateCountries.length > 0 && (
                  <div className="mb-2.5 flex flex-wrap gap-1.5">
                    {v.candidateCountries.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() =>
                          set('candidateCountries', v.candidateCountries.filter((c) => c !== code))
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--sf-primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--sf-primary-dark)]"
                        aria-label={`Remove ${countryLabel(code)}`}
                        data-testid="country-chip"
                      >
                        {countryLabel(code)}
                        <FiX className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                )}
                <Select
                  value=""
                  searchable
                  onChange={(code) => {
                    // "Anywhere" is a real choice, not the absence of one.
                    // Picking it clears any restriction rather than leaving the
                    // operator to guess that an empty list means global.
                    if (code === ANYWHERE) {
                      set('candidateCountries', []);
                      return;
                    }
                    if (code && !v.candidateCountries.includes(code)) {
                      set('candidateCountries', [...v.candidateCountries, code]);
                    }
                  }}
                  options={[
                    { value: ANYWHERE, label: 'Anywhere in the world' },
                    ...APPLY_COUNTRIES.filter(([code]) => !v.candidateCountries.includes(code)).map(
                      ([value, label]) => ({ value, label }),
                    ),
                  ]}
                  placeholder={
                    v.candidateCountries.length
                      ? 'Add another country'
                      : 'Anywhere in the world'
                  }
                  ariaLabel="Add a country this role can hire from"
                  className="w-full rounded-lg border border-[var(--sf-border)] bg-white px-3 py-2 text-sm text-[var(--sf-ink)]"
                />
              </div>
            </Field>
          </div>

          <div className="mt-4">
            <Field
              label="Job description"
              hint="Drives matching and generates the interview questions: paste the real thing"
            >
              <textarea
                value={v.jobDescription}
                onChange={(e) => set('jobDescription', e.target.value)}
                rows={10}
                placeholder="Responsibilities, requirements, team, working arrangement…"
                className={`${inputClass} leading-relaxed`}
                data-testid="field-jd"
              />
            </Field>
            <p className="mt-1.5 text-xs text-[var(--sf-muted-soft)]">
              {v.jobDescription.trim().length} characters
              {v.jobDescription.trim().length < 40 && ': needs at least 40'}
            </p>
          </div>
        </section>

        <section className="sf-panel rounded-2xl p-5 sm:p-6">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[var(--sf-ink)]">Questions</h2>
            <button
              type="button"
              onClick={addQuestion}
              className="sf-subtle-control inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold"
              data-testid="add-question"
            >
              <FiPlus className="h-4 w-4" /> Add
            </button>
          </div>
          <p className="mb-4 text-sm text-[var(--sf-muted)]">
            Asked on the apply page, on top of the CV. Every extra question costs you applicants;
            two or three that a CV cannot answer is usually the right number.
          </p>

          {v.questions.length === 0 && (
            <p className="rounded-xl bg-[#f8fbff] px-4 py-6 text-center text-sm text-[var(--sf-muted)]">
              No extra questions. Applicants submit a CV and their country.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {v.questions.map((q, i) => (
              <div
                key={q.id}
                className="rounded-xl border border-[var(--sf-border)] bg-[#fbfdff] p-4"
                data-testid="question-row"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-2.5 text-xs font-bold text-[var(--sf-muted-soft)]">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-3">
                    <input
                      value={q.label}
                      onChange={(e) => updateQuestion(i, { label: e.target.value })}
                      placeholder="What is the hardest performance problem you have fixed?"
                      className={inputClass}
                      data-testid="question-label"
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="w-[170px]">
                        <Select
                          value={q.type}
                          onChange={(value) =>
                            updateQuestion(i, {
                              type: value as CampaignQuestion['type'],
                              // Switching to a list gives two empty rows to fill.
                              // Switching away drops the options, so a text
                              // question cannot carry stale choices.
                              options:
                                value === 'select' ? (q.options?.length ? q.options : ['', '']) : undefined,
                            })
                          }
                          options={QUESTION_TYPES}
                          ariaLabel={`Answer type for question ${i + 1}`}
                          className={`${inputClass} flex items-center justify-between py-2`}
                        />
                      </div>

                      <label className="flex items-center gap-2 text-sm text-[var(--sf-ink-soft)]">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) => updateQuestion(i, { required: e.target.checked })}
                          className="h-[17px] w-[17px] accent-[var(--sf-primary)]"
                        />
                        Required
                      </label>

                      <button
                        type="button"
                        onClick={() => set('questions', v.questions.filter((_, j) => j !== i))}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[var(--sf-red)] hover:bg-[var(--sf-red-soft)]"
                        aria-label={`Remove question ${i + 1}`}
                      >
                        <FiTrash2 className="h-4 w-4" /> Remove
                      </button>
                    </div>

                    {q.type === 'select' && (
                      <div className="rounded-xl bg-white p-3">
                        <span className="mb-2 block text-xs font-bold text-[var(--sf-ink-soft)]">
                          Options the applicant picks from
                        </span>

                        <div className="flex flex-col gap-2">
                          {(q.options ?? ['']).map((option, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input
                                value={option}
                                onChange={(e) => {
                                  const next = [...(q.options ?? [''])];
                                  next[oi] = e.target.value;
                                  updateQuestion(i, { options: next });
                                }}
                                placeholder={
                                  ['Immediate', '1 month', '3 months'][oi] ?? 'Another option'
                                }
                                className={inputClass}
                                data-testid="question-option"
                              />
                              {(q.options ?? ['']).length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateQuestion(i, {
                                      options: (q.options ?? []).filter((_, j) => j !== oi),
                                    })
                                  }
                                  className="shrink-0 rounded-lg p-2 text-[var(--sf-muted)] hover:bg-[var(--sf-red-soft)] hover:text-[var(--sf-red)]"
                                  aria-label={`Remove option ${oi + 1}`}
                                >
                                  <FiX className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            updateQuestion(i, { options: [...(q.options ?? ['']), ''] })
                          }
                          className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--sf-primary-dark)]"
                          data-testid="add-option"
                        >
                          <FiPlus className="h-3.5 w-3.5" /> Add option
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="sf-panel rounded-2xl p-5 sm:p-6">
          <h2 className="mb-4 text-base font-bold text-[var(--sf-ink)]">Timing and size</h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Applications close" hint="Optional">
              <input
                type="date"
                min={today()}
                value={v.applicationDeadline}
                onChange={(e) => set('applicationDeadline', e.target.value)}
                className={inputClass}
                data-testid="field-app-deadline"
              />
            </Field>
            <Field label="Interviews close" hint="Invite links expire then">
              <input
                type="date"
                min={v.applicationDeadline || today()}
                value={v.interviewDeadline}
                onChange={(e) => set('interviewDeadline', e.target.value)}
                className={inputClass}
                data-testid="field-interview-deadline"
              />
            </Field>
            <Field label="Shortlist target" hint="How many you plan to interview">
              <input
                type="number"
                min={1}
                max={500}
                value={v.shortlistTarget}
                onChange={(e) => set('shortlistTarget', e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={() => {
                  // Settle it only when they leave the field, so an empty box
                  // stays empty while they retype rather than snapping to 0.
                  const n = Number(v.shortlistTarget);
                  if (!v.shortlistTarget || !Number.isFinite(n) || n < 1) {
                    set('shortlistTarget', '25');
                  } else if (n > 500) {
                    set('shortlistTarget', '500');
                  } else {
                    set('shortlistTarget', String(n));
                  }
                }}
                className={inputClass}
                data-testid="field-shortlist-target"
              />
            </Field>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-[var(--sf-muted-soft)]">
            An invite link expires at the interview deadline. Leave it blank and invites last two
            weeks from the day they are sent.
          </p>
        </section>

        <div className="flex flex-wrap items-center gap-3 pb-4">
          <button
            type="button"
            onClick={submit}
            disabled={saving || incomplete}
            className="sf-primary rounded-xl px-5 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="create-submit"
          >
            {saving
              ? 'Saving…'
              : mode === 'create'
                ? 'Create as draft'
                : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="sf-subtle-control rounded-xl px-4 py-2.5 text-sm font-semibold"
          >
            Cancel
          </button>
          <span className="text-xs text-[var(--sf-muted)]">
            {incomplete
              ? 'Needs a title, a company, a location and a description of at least 40 characters.'
              : mode === 'create'
                ? 'Nothing is public until you open it for applications.'
                : 'The apply link does not change.'}
          </span>
        </div>
      </div>
    </main>
  );
}

/** Today, as the value a date input expects. Used as the floor on both dates:
 *  a campaign created with a deadline in the past is closed the moment it opens. */
/** Sentinel for the "no restriction" row. Not a country, so it cannot collide. */
const ANYWHERE = '__anywhere__';

const countryLabel = (code: string) =>
  APPLY_COUNTRIES.find(([value]) => value === code)?.[1] ?? code;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const inputClass =
  'w-full rounded-xl border border-[var(--sf-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--sf-ink)] outline-none focus:border-[var(--sf-primary)]';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-bold text-[var(--sf-ink-soft)]">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-[var(--sf-muted-soft)]">{hint}</span>}
    </label>
  );
}
