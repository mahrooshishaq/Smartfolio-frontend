'use client';

import type { IconType } from 'react-icons';

export default function SidebarItem({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: IconType;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`font-raleway flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${
        active
          ? 'bg-[var(--sf-primary-soft)] text-[var(--sf-primary-dark)] font-semibold'
          : 'text-[var(--sf-muted)] hover:bg-[var(--sf-primary-soft)] hover:text-[var(--sf-primary-dark)]'
      }`}
    >
      <Icon size={20} />
      <span className="text-sm">{label}</span>
    </div>
  );
}
