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
          ? 'bg-blue-50 text-blue-600 font-semibold'
          : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
      }`}
    >
      <Icon size={20} />
      <span className="text-sm">{label}</span>
    </div>
  );
}
