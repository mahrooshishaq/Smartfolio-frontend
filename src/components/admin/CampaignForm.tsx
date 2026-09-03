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
import { FiPlus, FiTrash2, FiChevronLeft } from 'react-icons/fi';
import { Select } from '@/components/ui/Select';
import { useFeedback } from '@/components/ui/feedback';
import type { Campaign, CampaignQuestion } from '@/lib/admin';

export interface CampaignFormValues {
  title: string;
  company: string;
  jobDescription: string;
  location: string;
  jobType: string;
  shortlistTarget: number;
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

const QUESTION_TYPES = [
  { value: 'textarea', label: 'Long answer' },
  { value: 'text', label: 'Short answer' },
  { value: 'select', label: 'Choose one' },
];

export function emptyValues(): CampaignFormValues {
  return {
    title: '',
    company: '',
    jobDescription: '',
    location: '',
    jobType: 'Remote',
    shortlistTarget: 25,
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
    shortlistTarget: campaign.shortlistTarget,
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
}: {
  mode: 'create' | 'edit';
  initial: CampaignFormValues;
  backHref: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const router = useRouter();
  const { error } = useFeedback();
  const [v, setV] = useState<CampaignFormValues>(initial);
  const [saving, setSaving] = useState(false);

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
    const unlabelled = v.questions.findIndex((q) => !q.label.trim());
    if (unlabelled >= 0) return error(`Question ${unlabelled + 1} has no wording.`);

    if (v.applicationDeadline && v.interviewDeadline) {
      if (new Date(v.interviewDeadline) < new Date(v.applicationDeadline)) {
        return error('The interview window closes before applications do — check the dates.');
      }
    }

    setSaving(true);
    try {
      await onSubmit({
        title: v.title.trim(),
        company: v.company.trim(),
        jobDescription: v.jobDescription.trim(),
        location: v.location.trim() || undefined,
        jobType: v.jobType || undefined,
        shortlistTarget: Number(v.shortlistTarget) || 25,
        // Dates arrive as YYYY-MM-DD; the API wants an instant. End of day so a
        // deadline of "the 30th" includes the whole of the 30th.
        applicationDeadline: v.applicationDeadline
          ? new Date(`${v.applicationDeadline}T23:59:59Z`).toISOString()
          : undefined,
        interviewDeadline: v.interviewDeadline
          ? new Date(`${v.interviewDeadline}T23:59:59Z`).toISOString()
          : undefined,
        questions: v.questions,
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
          ? 'A campaign is one role: a public apply page, the applications it collects, and the interviews you invite people to. It is created as a draft — nothing is public until you open it.'
          : 'The description is a copy. Editing it changes what new applicants see; it does not change what people who already applied were shown.'}
      </p>

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
            <Field label="Company">
              <input
                value={v.company}
                onChange={(e) => set('company', e.target.value)}
                placeholder="Northwind Labs"
                className={inputClass}
                data-testid="field-company"
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Location" hint="Feeds the location part of the match score">
              <input
                value={v.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="Remote — Europe & Asia"
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
              label="Job description"
              hint="Drives matching and generates the interview questions — paste the real thing"
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
              {v.jobDescription.trim().length < 40 && ' — needs at least 40'}
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
            Asked on the apply page, on top of the CV. Every extra question costs you applicants —
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
                            updateQuestion(i, { type: value as CampaignQuestion['type'] })
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
                      <input
                        value={(q.options ?? []).join(', ')}
                        onChange={(e) =>
                          updateQuestion(i, {
                            options: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="Immediate, 1 month, 3 months"
                        className={inputClass}
                        data-testid="question-options"
                      />
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
                value={v.applicationDeadline}
                onChange={(e) => set('applicationDeadline', e.target.value)}
                className={inputClass}
                data-testid="field-app-deadline"
              />
            </Field>
            <Field label="Interviews close" hint="Invite links expire then">
              <input
                type="date"
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
                onChange={(e) => set('shortlistTarget', Number(e.target.value))}
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
            disabled={saving}
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
          {mode === 'create' && (
            <span className="text-xs text-[var(--sf-muted)]">
              Nothing is public until you open it for applications.
            </span>
          )}
        </div>
      </div>
    </main>
  );
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
