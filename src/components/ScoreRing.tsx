'use client';

export default function ScoreRing({
  score,
  size = 120,
  strokeWidth = 10,
  color = '#F472B6',
  className,
}: {
  score: number;
  /** Internal SVG coordinate size; rendered size follows `className` (falls back to `size` px). */
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (c * Math.min(score, 100)) / 100;
  return (
    <div
      className={`relative flex items-center justify-center ${className ?? ''}`}
      style={className ? undefined : { width: size, height: size }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#F1F5F9" strokeWidth={strokeWidth} fill="transparent" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={strokeWidth} fill="transparent" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-century text-2xl font-black text-slate-800">{score}</span>
        <span className="font-raleway text-[9px] font-bold text-gray-400 uppercase">/100</span>
      </div>
    </div>
  );
}
