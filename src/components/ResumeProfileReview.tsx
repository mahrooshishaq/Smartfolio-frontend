'use client';
import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles, Check, AlertCircle } from 'lucide-react';

import { apiFetch } from '@/lib/api';

/**
 * Post-upload review step. The SERVER decides what actually changes — it returns
 * only actionable rows (identical values already filtered, arrays already
 * unioned). This component just renders those rows, lets the user deselect any,
 * and sends back the confirmed field KEYS. It never sends values, so it can't
 * overwrite or drop profile data. Applied fields improve job/course matching.
 */

type ChangeType = 'new' | 'update' | 'adds';

type SuggestionRow = {
  field: string;
  label: string;
  changeType: ChangeType;
  displayValue: string;
  currentValue?: string;
};

type Suggestions = {
  rows: SuggestionRow[];
  confidence: number;
  alreadyApplied: boolean;
};

const BADGE: Record<ChangeType, { text: string; cls: string }> = {
  new: { text: 'New', cls: 'bg-green-100 text-green-600' },
  update: { text: 'Update', cls: 'bg-amber-100 text-amber-600' },
  adds: { text: 'Adds', cls: 'bg-indigo-100 text-indigo-600' },
};

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
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    apiFetch(`/resume/${resumeId}/profile-suggestions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('Could not read details from your resume.');
        return r.json();
      })
      .then((d: Suggestions) => {
        // Nothing to change (e.g. re-upload of an already-applied CV) → don't
        // make the user dismiss an empty modal; go straight to analysis.
        if (!d.rows || d.rows.length === 0) {
          onDone();
          return;
        }
        setData(d);
        const init: Record<string, boolean> = {};
        d.rows.forEach((row) => (init[row.field] = true));
        setSelected(init);
      })
      .catch((e) => setError(e.message));
  }, [resumeId, onDone]);

  const toggle = (field: string) =>
    setSelected((s) => ({ ...s, [field]: !s[field] }));

  const apply = async () => {
    if (!data) return;
    const fields = data.rows.map((r) => r.field).filter((f) => selected[f]);
    if (fields.length === 0) {
      onDone(); // nothing selected → behave like Skip
      return;
    }

    setSaving(true);
    setApplyError(null);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await apiFetch(`/resume/${resumeId}/apply-to-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Could not update your profile.');
      }
      onDone(); // only proceed once the save actually succeeded
    } catch (e) {
      // Surface the failure instead of silently continuing — the user must know
      // their profile did NOT update. They can retry or skip.
      setApplyError(e instanceof Error ? e.message : 'Could not update your profile.');
      setSaving(false);
    }
  };

  // Keep upload progress on the upload page. The review dialog should appear
  // only when there is something concrete for the user to review.
  if (!data && !error) return null;

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
          {error && (
            <div className="flex items-start gap-2 text-orange-600 py-6">
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!data && !error && (
            <div className="flex items-center gap-2 text-slate-500 py-8 justify-center">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Reading your resume…</span>
            </div>
          )}

          <div className="space-y-2">
            {data?.rows.map((row) => {
              const badge = BADGE[row.changeType];
              return (
                <button
                  key={row.field}
                  type="button"
                  onClick={() => toggle(row.field)}
                  className={`w-full text-left flex items-start gap-3 rounded-2xl border p-4 transition-colors ${
                    selected[row.field]
                      ? 'border-indigo-200 bg-indigo-50/60'
                      : 'border-gray-100 bg-slate-50 hover:border-gray-200'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border ${
                      selected[row.field] ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-300 bg-white'
                    }`}
                  >
                    {selected[row.field] && <Check size={13} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        {row.label}
                      </span>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${badge.cls}`}
                      >
                        {badge.text}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 mt-0.5 break-words">{row.displayValue}</p>
                    {row.currentValue && (
                      <p className="text-xs text-gray-400 mt-0.5 break-words">
                        Currently: {row.currentValue}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {applyError && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl bg-orange-50 border border-orange-100 p-3 text-orange-600">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <p className="text-xs">{applyError}</p>
            </div>
          )}
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
            {saving ? 'Saving…' : applyError ? 'Retry' : 'Add & continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
