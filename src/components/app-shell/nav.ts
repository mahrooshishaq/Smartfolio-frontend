import type { IconType } from 'react-icons';
import {
  FiLayout,
  FiFileText,
  FiMic,
  FiBookOpen,
  FiFile,
  FiBriefcase,
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
};

/**
 * Single source of truth for app navigation — the desktop sidebar, the
 * mobile drawer, the bottom tab bar, and the More sheet all render from here.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', tabLabel: 'Home', icon: FiLayout, placement: 'tab' },
  { href: '/upload-resume', label: 'Resume Analysis', icon: FiFileText, placement: 'more' },
  { href: '/mock-interview', label: 'Mock Interview', tabLabel: 'Interview', icon: FiMic, placement: 'tab' },
  { href: '/courses', label: 'Courses', icon: FiBookOpen, placement: 'tab' },
  { href: '/document-generation', label: 'Document Generation', icon: FiFile, placement: 'more' },
  { href: '/jobs', label: 'Jobs', icon: FiBriefcase, placement: 'tab' },
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
