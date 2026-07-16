'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles, Check } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Post-upload review step. After a resume is uploaded we pull structured
 * career-profile fields out of it and let the user confirm which ones to add to
 * their profile. Applied fields improve job/course matching (the scraper ranks
 * against the profile), so this is the moment we enrich it — with the user's
 * consent, never silently. Skipping just proceeds straight to analysis.
 */

type ProfileFields = {
  currentRole?: string;
  targetRole?: string;
  yearsOfExperience?: number;
  experienceLevel?: string;
  educationLevel?: string;
  currentIndustry?: string;
  careerStage?: string;
  location?: string;
  skills?: string[];
  interests?: string[];
};

type Suggestions = {
  suggested: ProfileFields;
  current: ProfileFields;
  confidence: number;
};

const FIELD_LABELS: Record<keyof ProfileFields, string> = {
  currentRole: 'Current role',
  targetRole: 'Target role',
  yearsOfExperience: 'Years of experience',
  experienceLevel: 'Experience level',
  educationLevel: 'Education level',
  currentIndustry: 'Industry',
  careerStage: 'Career stage',
  location: 'Location',
  skills: 'Skills',
  interests: 'Interests',
};

const prettify = (v: unknown): string =>
  Array.isArray(v) ? v.join(', ') : String(v).replace(/_/g, ' ');

export default function ResumeProfileReview({
  resumeId,
  onDone,
}: {
  resumeId: string;
  onDone: () => void;
}) {
  const [data, setData] = useState<Suggestions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    fetch(`${API}/resume/${resumeId}/profile-suggestions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('Could not read details from your resume.');
        return r.json();
      })
      .then((d: Suggestions) => setData(d))
      .catch((e) => setError(e.message));
  }, [resumeId]);

  // Only show fields the resume would actually CHANGE. A suggestion equal to the
  // current value is a no-op and is dropped — so re-uploading the same CV shows
  // "nothing new" instead of re-offering the same values. Array fields (skills,
  // interests) are UNIONed with the current list, never replaced, so we never
  // silently drop skills the user already had; the row appears only when the
  // resume adds items that aren't there yet.
  const rows = useMemo(() => {
    if (!data) return [];
    const toList = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : [];
    const scalarEq = (a: unknown, b: unknown) =>
      a != null && b != null && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

    return (Object.keys(FIELD_LABELS) as (keyof ProfileFields)[])
      .map((k) => {
        const suggestedVal = data.suggested[k];
        const currentVal = data.current[k];
        if (suggestedVal == null) return null;

        if (k === 'skills' || k === 'interests') {
          const current = toList(currentVal);
          const added = toList(suggestedVal).filter((x) => !current.includes(x));
          if (added.length === 0) return null; // resume adds nothing new
          return {
            key: k,
            applyValue: [...current, ...added], // union — preserves existing items
            display: added.join(', '),
            currentDisplay: current.length ? current.join(', ') : null,
            isNew: current.length === 0,
            label: current.length ? `Adds ${added.length}` : 'New',
          };
        }

        if (scalarEq(suggestedVal, currentVal)) return null; // no-op
        const hasCurrent = currentVal != null && String(currentVal).trim() !== '';
        return {
          key: k,
          applyValue: suggestedVal,
          display: prettify(suggestedVal),
          currentDisplay: hasCurrent ? prettify(currentVal) : null,
          isNew: !hasCurrent,
          label: hasCurrent ? 'Update' : 'New',
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }, [data]);

  // Pre-select every actionable row once they're computed.
  useEffect(() => {
    const init: Record<string, boolean> = {};
    rows.forEach((r) => (init[r.key] = true));
    setSelected(init);
  }, [rows]);

  const toggle = (key: string) =>
    setSelected((s) => ({ ...s, [key]: !s[key] }));

  const apply = async () => {
    if (!data) return;
    setSaving(true);
    const payload: Record<string, unknown> = {};
    rows.forEach((r) => {
      if (selected[r.key]) payload[r.key] = r.applyValue;
    });

    // Nothing chosen → behave like Skip.
    if (Object.keys(payload).length === 0) {
      onDone();
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API}/resume/${resumeId}/apply-to-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Could not update your profile.');
      }
    } catch (e) {
      // Non-fatal: enrichment is a bonus, so we still continue to analysis.
      console.error('Apply resume to profile failed:', e);
    } finally {
      onDone();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 font-raleway">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-7 pb-4 border-b border-gray-50">
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <Sparkles size={18} />
            <span className="text-[11px] font-bold uppercase tracking-widest">From your resume</span>
          </div>
          <h2 className="font-century text-xl text-slate-800">Add these details to your profile?</h2>
          <p className="text-sm text-gray-400 mt-1">
            We use these to match you with better jobs and courses. Uncheck anything you’d rather skip.
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-7 pt-4">
          {error && <p className="text-sm text-orange-500">{error}</p>}

          {!data && !error && (
            <div className="flex items-center gap-2 text-slate-500 py-8 justify-center">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Reading your resume…</span>
            </div>
          )}

          {data && rows.length === 0 && (
            <p className="text-sm text-gray-400 py-6 text-center">
              Nothing new to pull from this resume — your profile already looks complete.
            </p>
          )}

          <div className="space-y-2">
            {rows.map(({ key, display, currentDisplay, isNew, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                className={`w-full text-left flex items-start gap-3 rounded-2xl border p-4 transition-colors ${
                  selected[key]
                    ? 'border-indigo-200 bg-indigo-50/60'
                    : 'border-gray-100 bg-slate-50 hover:border-gray-200'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border ${
                    selected[key] ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-300 bg-white'
                  }`}
                >
                  {selected[key] && <Check size={13} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      {FIELD_LABELS[key]}
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                        isNew ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 mt-0.5 break-words">{display}</p>
                  {currentDisplay && (
                    <p className="text-xs text-gray-400 mt-0.5 break-words">
                      Currently: {currentDisplay}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-7 pt-4 border-t border-gray-50 flex gap-3">
          <button
            type="button"
            onClick={onDone}
            disabled={saving}
            className="flex-1 py-3 rounded-2xl text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={saving || !data}
            className="flex-[2] py-3 rounded-2xl text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 transition-colors shadow-lg shadow-slate-200 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saving ? 'Saving…' : 'Add & continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
