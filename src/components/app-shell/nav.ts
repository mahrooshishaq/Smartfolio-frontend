import type { IconType } from 'react-icons';
import {
  FiLayout,
  FiFileText,
  FiMic,
  FiBookOpen,
  FiFile,
  FiBriefcase,
  FiClipboard,
  FiHelpCircle,
  FiSettings,
} from 'react-icons/fi';

export type NavItem = {
  href: string;
  label: string;
  /** Short label for the bottom tab bar. */
  tabLabel?: string;
  icon: IconType;
  /** Where the item lives on mobile: a bottom tab or the "More" sheet. */
  placement: 'tab' | 'more';
  /** Position in the bottom tab bar (left to right); Home sits in the center. */
  tabOrder?: number;
};

/**
 * Single source of truth for app navigation — the desktop sidebar, the
 * mobile drawer, the bottom tab bar, and the More sheet all render from here.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', tabLabel: 'Home', icon: FiLayout, placement: 'tab', tabOrder: 3 },
  { href: '/upload-resume', label: 'Resume Analysis', icon: FiFileText, placement: 'more' },
  { href: '/mock-interview', label: 'Mock Interview', tabLabel: 'Interview', icon: FiMic, placement: 'tab', tabOrder: 1 },
  { href: '/courses', label: 'Courses', icon: FiBookOpen, placement: 'tab', tabOrder: 4 },
  { href: '/document-generation', label: 'Document Generation', icon: FiFile, placement: 'more' },
  { href: '/jobs', label: 'Jobs', icon: FiBriefcase, placement: 'tab', tabOrder: 2 },
  { href: '/tracker', label: 'Job Tracker', tabLabel: 'Tracker', icon: FiClipboard, placement: 'more' },
];

export const SUPPORT_ITEMS: NavItem[] = [
  { href: '#', label: 'Get Started', icon: FiHelpCircle, placement: 'more' },
  { href: '/dashboard/settings', label: 'Settings', icon: FiSettings, placement: 'more' },
];

/** Active-state check via longest-prefix match so /dashboard/settings highlights Settings, not Dashboard. */
export function isActive(pathname: string, href: string): boolean {
  if (href === '#') return false;
  const all = [...NAV_ITEMS, ...SUPPORT_ITEMS].map((i) => i.href);
  const matches = all.filter((h) => h !== '#' && (pathname === h || pathname.startsWith(h + '/')));
  const longest = matches.sort((a, b) => b.length - a.length)[0];
  return longest === href;
}
