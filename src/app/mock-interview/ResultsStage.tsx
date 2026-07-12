'use client';
import { useState } from 'react';
import {
  FiStar, FiTrendingUp, FiCheckCircle, FiXCircle, FiAlertCircle, FiRefreshCw,
  FiChevronDown, FiChevronUp,
} from 'react-icons/fi';
import { ROUND_ORDER, ROUND_META } from './constants';
import type { Evaluation, PublicQuestion } from './types';

// Renders a stored answer for display — MCQ answers are option indices, so map them back to text.
const formatAnswer = (q: PublicQuestion, ans: string | number | undefined): string => {
  if (ans === undefined || ans === '') return 'No answer';
  if (q.type === 'mcq' && typeof ans === 'number' && q.options && q.options[ans] !== undefined) {
    return `${String.fromCharCode(65 + ans)}. ${q.options[ans]}`;
  }
  return String(ans);
};

// Spoken answers can run long now that the full recording is transcribed —
// show a short preview and let the candidate expand to the complete captured
// answer (e.g. to verify the mic really heard everything they said).
const ANSWER_PREVIEW_CHARS = 160;

function AnswerDisclosure({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (text.length <= ANSWER_PREVIEW_CHARS) {
    return <span className="italic font-normal">&quot;{text}&quot;</span>;
  }
  const words = text.trim().split(/\s+/).length;
  return (
    <span className="font-normal">
      <span className="italic">
        &quot;{open ? text : `${text.slice(0, ANSWER_PREVIEW_CHARS).trimEnd()}…`}&quot;
      </span>
      <button
        onClick={() => setOpen((v) => !v)}
        className="ml-2 inline-flex items-center gap-1 align-baseline font-raleway text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
      >
        {open
          ? <>Hide full answer <FiChevronUp size={12} /></>
          : <>Show full answer · {words} words <FiChevronDown size={12} /></>}
      </button>
    </span>
  );
}

const verdictStyle = (v: string) => {
  if (v === 'correct') return { icon: FiCheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Correct' };
  if (v === 'partial') return { icon: FiAlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Partial' };
  return { icon: FiXCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Incorrect' };
};

interface ResultsStageProps {
  evaluation: Evaluation;
  questions: PublicQuestion[];
  answers: Record<number, string | number>;
  onRestart: () => void;
}

export function ResultsStage({ evaluation, questions, answers, onRestart }: ResultsStageProps) {
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* Overall Score */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-10 text-center">
        <div className="relative inline-flex items-center justify-center mb-4">
          <svg className="w-44 h-44 -rotate-90">
            <circle cx="88" cy="88" r="78" stroke="#F1F5F9" strokeWidth="12" fill="none" />
            <circle
              cx="88" cy="88" r="78" stroke="#4F46E5" strokeWidth="12" fill="none"
              strokeLinecap="round"
              strokeDasharray={`${(evaluation.overallScore / 100) * 490} 490`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-century text-5xl font-black text-slate-800">{evaluation.overallScore}</span>
            <span className="font-raleway text-xs text-gray-400 uppercase tracking-wider">/ 100</span>
          </div>
        </div>
        <h3 className="font-century text-xl font-black text-slate-800 mb-2">Overall Performance</h3>
        <p className="font-raleway text-sm text-gray-500 max-w-2xl mx-auto leading-relaxed">{evaluation.summary}</p>
      </div>

      {/* Per-round scores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ROUND_ORDER.map((r) => {
          const meta = ROUND_META[r];
          const Icon = meta.icon;
          const score = evaluation.roundScores[r];
          return (
            <div key={r} className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-6 text-center">
              <div className={`w-12 h-12 rounded-2xl ${meta.bg} ${meta.color} flex items-center justify-center mx-auto mb-3`}>
                <Icon size={22} />
              </div>
              <p className="font-raleway text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{meta.title}</p>
              <p className="font-century text-3xl font-black text-slate-800">{score}<span className="text-base text-gray-400">/100</span></p>
            </div>
          );
        })}
      </div>

      {/* Communication / delivery (Phase 4.2) */}
      {evaluation.delivery && (
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-7">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-century text-lg font-black text-slate-800">Communication</h3>
            <span className="font-raleway text-xs text-gray-400">
              {evaluation.delivery.fillerWords} filler word{evaluation.delivery.fillerWords === 1 ? '' : 's'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {[
              { label: 'Clarity', value: evaluation.delivery.clarity },
              { label: 'Structure', value: evaluation.delivery.structure },
              { label: 'Conciseness', value: evaluation.delivery.conciseness },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-raleway text-xs font-semibold text-slate-600">{m.label}</span>
                  <span className="font-century text-sm font-bold text-slate-800 tabular-nums">{m.value}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(0, Math.min(100, m.value))}%` }} />
                </div>
              </div>
            ))}
          </div>
          {evaluation.delivery.notes && (
            <p className="font-raleway text-sm text-slate-600">{evaluation.delivery.notes}</p>
          )}
        </div>
      )}

      {/* Strengths & Areas to Improve */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-7">
          <div className="flex items-center gap-2 mb-4">
            <FiStar className="text-emerald-500" size={20} />
            <h3 className="font-century text-lg font-black text-slate-800">Strengths</h3>
          </div>
          <ul className="space-y-3">
            {evaluation.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 font-raleway text-sm text-slate-600">
                <span className="text-emerald-500 mt-0.5">•</span> {s}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-7">
          <div className="flex items-center gap-2 mb-4">
            <FiTrendingUp className="text-amber-500" size={20} />
            <h3 className="font-century text-lg font-black text-slate-800">Areas to Improve</h3>
          </div>
          <ul className="space-y-3">
            {evaluation.areasToImprove.map((a, i) => (
              <li key={i} className="flex items-start gap-2 font-raleway text-sm text-slate-600">
                <span className="text-amber-500 mt-0.5">•</span> {a}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Per-question breakdown */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-7">
        <h3 className="font-century text-lg font-black text-slate-800 mb-5">Question Breakdown</h3>
        <div className="space-y-3">
          {ROUND_ORDER.map((r) => {
            const roundQs = questions.filter((q) => q.round === r);
            const meta = ROUND_META[r];
            return (
              <div key={r}>
                <p className={`font-raleway text-[10px] font-bold uppercase tracking-wider ${meta.color} mb-2 mt-3`}>
                  {meta.title}
                </p>
                {roundQs.map((q) => {
                  const fb = evaluation.perQuestion.find((f) => f.questionId === q.id);
                  if (!fb) return null;
                  const style = verdictStyle(fb.verdict);
                  const Icon = style.icon;
                  return (
                    <div key={q.id} className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 mb-2">
                      <div className={`${style.bg} ${style.color} w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0`}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-century text-xs font-bold text-slate-700">Q{q.id}</span>
                          <span className={`font-raleway text-[10px] font-bold uppercase tracking-wider ${style.color}`}>{style.label}</span>
                        </div>
                        <p className="font-raleway text-xs text-gray-500 mb-1 line-clamp-2">{q.question}</p>
                        <p className="font-raleway text-sm text-slate-600 font-semibold mb-1">Your Answer: <AnswerDisclosure text={formatAnswer(q, answers[q.id])} /></p>
                        <p className="font-raleway text-sm text-slate-600">{fb.explanation}</p>
                        {fb.idealAnswer && (
                          <p className="font-raleway text-xs text-slate-500 mt-2 bg-emerald-50/60 rounded-lg px-3 py-2">
                            <span className="font-bold text-emerald-700">Model answer:</span> {fb.idealAnswer}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Improvement tips */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-7">
        <h3 className="font-century text-lg font-black text-slate-800 mb-5">What to Work On Next</h3>
        <div className="space-y-3">
          {evaluation.improvementTips.map((tip, idx) => (
            <div key={idx} className="flex items-start gap-3 p-4 bg-indigo-50/40 rounded-xl">
              <span className="font-century text-sm font-bold text-[#4F46E5] flex-shrink-0">{idx + 1}.</span>
              <p className="font-raleway text-sm text-slate-700 leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={onRestart}
          className="font-raleway flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white px-10 py-4 rounded-2xl font-semibold text-sm transition-all"
        >
          <FiRefreshCw size={16} /> Try Another Interview
        </button>
      </div>
    </div>
  );
}
