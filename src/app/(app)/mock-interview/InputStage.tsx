import { FiVolume2, FiMic, FiZap, FiSend } from 'react-icons/fi';
import { TIER_OPTIONS, SENIORITY_OPTIONS } from './constants';
import type { LengthTier, Seniority, ProgressPoint, ProgressSummary } from './types';

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <p className="font-century text-2xl font-black text-slate-800 tabular-nums">{value ?? '—'}</p>
      <p className="font-raleway text-[10px] uppercase tracking-wider text-gray-400">{label}</p>
    </div>
  );
}

// Tiny inline SVG trend line of past overall scores.
function Sparkline({ scores, delta }: { scores: number[]; delta: number | null }) {
  if (scores.length < 2) {
    return <p className="font-raleway text-xs text-gray-400">Finish another interview to see your trend.</p>;
  }
  const w = 100, h = 28;
  const pts = scores
    .map((s, i) => `${((i / (scores.length - 1)) * w).toFixed(1)},${(h - (Math.max(0, Math.min(100, s)) / 100) * h).toFixed(1)}`)
    .join(' ');
  const up = (delta ?? 0) >= 0;
  return (
    <div className="flex items-center gap-3">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-8" aria-hidden="true">
        <polyline points={pts} fill="none" stroke={up ? '#10b981' : '#f43f5e'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {delta !== null && (
        <span className={`font-raleway text-xs font-bold whitespace-nowrap ${up ? 'text-emerald-600' : 'text-rose-500'}`}>
          {up ? '▲' : '▼'} {Math.abs(delta)}
        </span>
      )}
    </div>
  );
}

interface InputStageProps {
  jobDescription: string;
  setJobDescription: (v: string) => void;
  lengthTier: LengthTier;
  setLengthTier: (v: LengthTier) => void;
  seniority: Seniority | '';
  setSeniority: (v: Seniority | '') => void;
  focusInput: string;
  setFocusInput: (v: string) => void;
  useResume: boolean;
  setUseResume: (v: boolean) => void;
  onStart: () => void;
  sttSupported: boolean;
  progress: { points: ProgressPoint[]; summary: ProgressSummary } | null;
}

export function InputStage({
  jobDescription, setJobDescription, lengthTier, setLengthTier,
  seniority, setSeniority, focusInput, setFocusInput, useResume, setUseResume,
  onStart, sttSupported, progress,
}: InputStageProps) {
  const showProgress = progress && progress.summary.attempts >= 1;

  return (
    <div className="max-w-3xl mx-auto">
      {/* PROGRESS (Phase 4.1) */}
      {showProgress && (
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-century text-sm font-black text-slate-800">Your progress</h3>
            <span className="font-raleway text-[11px] text-gray-400">
              {progress!.summary.attempts} interview{progress!.summary.attempts > 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
            <Stat label="Latest" value={progress!.summary.latest} />
            <Stat label="Best" value={progress!.summary.best} />
            <Stat label="Average" value={progress!.summary.average} />
          </div>
          <Sparkline scores={progress!.points.map((p) => p.overallScore)} delta={progress!.summary.delta} />
        </div>
      )}

      {/* FORM */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-5 md:p-10">
        {!sttSupported && (
          <div className="bg-amber-50 text-amber-700 rounded-xl px-4 py-3 mb-5 text-xs font-raleway">
            Voice input isn&apos;t supported in this browser (Chrome works best). You can still type every answer.
          </div>
        )}

        <label className="font-raleway block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          Job Description
        </label>
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the full job description here, including required skills, technologies, and responsibilities..."
          className="font-raleway w-full min-h-[260px] bg-gray-50 border border-gray-100 rounded-2xl p-5 text-sm text-slate-700 placeholder-gray-400 focus:outline-none focus:border-[#4F46E5] resize-y"
        />

        {/* INTERVIEW LENGTH */}
        <div className="mt-6">
          <label className="font-raleway block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            Interview Length
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {TIER_OPTIONS.map((t) => {
              const selected = lengthTier === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setLengthTier(t.id)}
                  aria-pressed={selected}
                  className={`text-left rounded-2xl border p-4 transition-all ${selected ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-gray-200 bg-white hover:border-indigo-300'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-century text-sm font-bold text-slate-800">{t.label}</span>
                    <span className={`font-raleway text-[11px] font-bold ${selected ? 'text-indigo-600' : 'text-gray-400'}`}>{t.time}</span>
                  </div>
                  <p className="font-raleway text-[11px] text-gray-500 mb-1">{t.count}</p>
                  <p className="font-raleway text-[11px] text-gray-400 leading-snug">{t.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* OPTIONS: seniority, focus, resume */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-raleway block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Seniority (optional)</label>
            <div className="flex flex-wrap gap-2">
              {SENIORITY_OPTIONS.map((s) => {
                const on = seniority === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSeniority(on ? '' : s.id)}
                    className={`font-raleway text-xs px-3 py-2 rounded-xl border transition-all ${on ? 'border-indigo-500 bg-indigo-50 text-indigo-600 font-semibold' : 'border-gray-200 text-gray-500 hover:border-indigo-300'}`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="font-raleway block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Focus areas (optional)</label>
            <input
              type="text"
              value={focusInput}
              onChange={(e) => setFocusInput(e.target.value)}
              placeholder="e.g. React, system design, testing"
              className="font-raleway w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm text-slate-700 placeholder-gray-400 focus:outline-none focus:border-[#4F46E5]"
            />
            <p className="font-raleway text-[10px] text-gray-400 mt-1">Comma-separated, up to 6</p>
          </div>
        </div>

        <label className="mt-4 flex items-center gap-3 cursor-pointer w-fit">
          <input type="checkbox" checked={useResume} onChange={(e) => setUseResume(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
          <span className="font-raleway text-sm text-slate-600">Tailor questions to my latest uploaded resume</span>
        </label>

        <div className="bg-indigo-50/50 rounded-2xl p-5 mt-5">
          <p className="font-century text-sm font-bold text-slate-700 mb-3">Professional Interview Simulation</p>
          <div className="space-y-2 text-xs text-slate-600 font-raleway">
            <div className="flex items-center gap-2"><FiVolume2 className="text-rose-500" size={14} /> Natural voice-guided questions</div>
            <div className="flex items-center gap-2"><FiMic className="text-blue-500" size={14} /> Voice-to-text response capture</div>
            <div className="flex items-center gap-2"><FiZap className="text-amber-500" size={14} /> Comprehensive 3-round performance analysis</div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          <p className="font-raleway text-xs text-gray-400">
            {jobDescription.length} characters {jobDescription.length < 20 && '(min 20)'}
          </p>
          <button
            onClick={onStart}
            disabled={jobDescription.trim().length < 20}
            className="font-raleway flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white px-8 py-3 rounded-2xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiSend size={16} /> Start Interview
          </button>
        </div>
      </div>
    </div>
  );
}
