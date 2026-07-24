'use client';

import { FiMoon, FiSun } from 'react-icons/fi';
import { useTheme } from './ThemeProvider';

/**
 * Sidebar-row theme switch — styled to match SidebarItem. Shows the theme you'd
 * switch TO, with a little track/knob on the right so it reads as a toggle.
 */
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="font-raleway w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all text-gray-500 hover:bg-gray-50 hover:text-gray-600"
    >
      {isDark ? <FiSun size={20} /> : <FiMoon size={20} />}
      <span className="text-sm">{isDark ? 'Light mode' : 'Dark mode'}</span>
      <span
        className={`ml-auto w-9 h-5 rounded-full relative transition-colors ${isDark ? 'bg-indigo-500' : 'bg-gray-200'}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${isDark ? 'left-[1.125rem]' : 'left-0.5'}`}
        />
      </span>
    </button>
  );
}
