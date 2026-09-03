'use client';

import { STATUS_TONE } from '@/lib/admin';

/**
 * One badge component for every status in the admin surface — campaign status,
 * candidate status and verification verdict all render through it.
 *
 * They share a component so a colour means the same thing wherever it appears:
 * an operator scanning a table should not have to work out whether amber means
 * "shortlisted" here and "needs review" two columns over.
 */
export default function StatusBadge({
  status,
  title,
}: {
  status: string;
  title?: string;
}) {
  const tone = STATUS_TONE[status] ?? { bg: '#f8fbff', fg: 'var(--sf-muted)' };
  return (
    <span
      title={title}
      data-status={status}
      className="inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold capitalize"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {status}
    </span>
  );
}
