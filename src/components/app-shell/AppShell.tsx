'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { FiLogOut, FiMenu, FiMoreHorizontal, FiSettings, FiX } from 'react-icons/fi';
import BrandMark from '@/components/BrandMark';
import AnimatedBackground from '@/components/AnimatedBackground';
import SidebarItem from './SidebarItem';
import { NAV_ITEMS, SUPPORT_ITEMS, isActive, type NavItem } from './nav';
import { clearSession } from '@/lib/api';

type AppChrome = {
  /** Hide all shell chrome (top bar, tabs) — used by the mock-interview call. */
  immersive: boolean;
  setImmersive: (v: boolean) => void;
};

const AppChromeContext = createContext<AppChrome>({ immersive: false, setImmersive: () => {} });
export const useAppChrome = () => useContext(AppChromeContext);

const TAB_ITEMS = NAV_ITEMS.filter((i) => i.placement === 'tab').sort(
  (a, b) => (a.tabOrder ?? 99) - (b.tabOrder ?? 99),
);
const MORE_ITEMS = [...NAV_ITEMS.filter((i) => i.placement === 'more'), ...SUPPORT_ITEMS];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [immersive, setImmersive] = useState(false);

  useEffect(() => {
    setUserName(localStorage.getItem('userName') || '');
  }, []);

  // Close overlays on navigation.
  useEffect(() => {
    setDrawerOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    clearSession();
    router.push('/login');
  };

  const go = (item: NavItem) => {
    if (item.href !== '#') router.push(item.href);
  };

  const navList = (
    <>
      <nav className="flex-1 space-y-2">
        {NAV_ITEMS.map((item) => (
          <SidebarItem key={item.label} icon={item.icon} label={item.label} active={isActive(pathname, item.href)} onClick={() => go(item)} />
        ))}
      </nav>
      <div className="mt-auto pt-8 border-t border-gray-50 space-y-2">
        <p className="font-raleway text-[10px] font-bold text-gray-500 px-4 mb-4 uppercase tracking-[0.15em]">Support</p>
        {SUPPORT_ITEMS.map((item) => (
          <SidebarItem key={item.label} icon={item.icon} label={item.label} active={isActive(pathname, item.href)} onClick={() => go(item)} />
        ))}
        <button onClick={handleLogout} className="w-full">
          <SidebarItem icon={FiLogOut} label="Logout" />
        </button>
        <div className="mt-8 px-4 py-2 bg-slate-50 rounded-2xl">
          <p className="font-century text-sm font-bold text-slate-800">{userName || 'User'}</p>
          <p className="font-raleway text-[11px] text-gray-500 truncate">SmartFolio User</p>
        </div>
      </div>
    </>
  );

  return (
    <AppChromeContext.Provider value={{ immersive, setImmersive }}>
      <div className="sf-app-bg flex min-h-screen font-raleway text-[var(--sf-ink)]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-72 bg-white/82 backdrop-blur-xl border-r border-[var(--sf-border)] p-8 flex-col sticky top-0 h-screen">
          <div className="flex items-center gap-2 mb-12 px-2">
            <BrandMark className="w-7 h-7" />
            <h1 className="font-century text-xl ml-2 font-bold tracking-[0.04em] text-[var(--sf-ink)]">SmartFolio - AI</h1>
          </div>
          {navList}
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile top bar */}
          {!immersive && (
            <header className="lg:hidden sticky top-0 z-40 flex items-center gap-2 bg-white/82 backdrop-blur-xl border-b border-[var(--sf-border)] px-3 h-14 pt-[env(safe-area-inset-top)]">
              <button
                aria-label="Open menu"
                onClick={() => setDrawerOpen(true)}
                className="p-2.5 -ml-1 rounded-xl text-[var(--sf-muted)] hover:bg-[var(--sf-primary-soft)] min-h-11 min-w-11 flex items-center justify-center"
              >
                <FiMenu size={22} />
              </button>
              <BrandMark className="w-6 h-6" />
              <span className="font-century text-lg font-bold tracking-[0.04em] text-[var(--sf-ink)]">SmartFolio - AI</span>
              <button
                aria-label="Settings"
                onClick={() => router.push('/dashboard/settings')}
                className="ml-auto p-2.5 rounded-xl text-[var(--sf-muted)] hover:bg-[var(--sf-primary-soft)] min-h-11 min-w-11 flex items-center justify-center"
              >
                <FiSettings size={20} />
              </button>
            </header>
          )}

          <main
            className={`relative flex-1 overflow-x-clip px-4 py-6 md:px-8 lg:p-10 ${
              immersive ? 'pb-6' : 'pb-[calc(5.5rem+env(safe-area-inset-bottom))]'
            } lg:pb-10`}
          >
            <AnimatedBackground />
            <div className="relative z-10">{children}</div>
          </main>
        </div>

        {/* Mobile nav drawer (hamburger) */}
        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-[90]">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDrawerOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white p-6 flex flex-col overflow-y-auto shadow-2xl">
              <div className="flex items-center gap-2 mb-8">
                <BrandMark className="w-6 h-6" />
                <span className="font-century text-lg font-bold tracking-[0.04em] text-[var(--sf-ink)]">SmartFolio - AI</span>
                <button
                  aria-label="Close menu"
                  onClick={() => setDrawerOpen(false)}
                  className="ml-auto p-2 rounded-xl text-slate-500 hover:bg-gray-50 min-h-11 min-w-11 flex items-center justify-center"
                >
                  <FiX size={20} />
                </button>
              </div>
              {navList}
            </aside>
          </div>
        )}

        {/* Mobile "More" sheet */}
        {moreOpen && (
          <div className="lg:hidden fixed inset-0 z-[90]">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMoreOpen(false)} />
            <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-gray-200" />
              <div className="px-4 py-2 mb-3 bg-slate-50 rounded-2xl">
                <p className="font-century text-sm font-bold text-slate-800">{userName || 'User'}</p>
                <p className="font-raleway text-[11px] text-gray-500 truncate">SmartFolio User</p>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {MORE_ITEMS.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <button
                      key={item.label}
                      onClick={() => go(item)}
                      className={`flex flex-col items-center gap-2 rounded-2xl px-2 py-4 transition-colors ${
                        active ? 'bg-[var(--sf-primary-soft)]' : 'bg-[#fbfaff] hover:bg-[var(--sf-primary-soft)]'
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          active ? 'sf-primary' : 'bg-white text-[var(--sf-muted)] shadow-sm'
                        }`}
                      >
                        <item.icon size={18} />
                      </span>
                      <span className={`font-raleway text-[11px] leading-tight text-center ${active ? 'font-bold text-[var(--sf-primary-dark)]' : 'font-semibold text-[var(--sf-muted)]'}`}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={handleLogout}
                className="sf-subtle-control w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-raleway text-xs font-bold transition-colors"
              >
                <FiLogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        )}

        {/* Mobile bottom tab bar: floating rounded bar with active pill */}
        {!immersive && (
          <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
            <nav className="flex items-stretch h-16 rounded-3xl bg-white/78 backdrop-blur-xl border border-[var(--sf-border)] shadow-xl shadow-slate-900/10">
              {TAB_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <button
                    key={item.label}
                    onClick={() => go(item)}
                    className={`font-raleway min-w-0 flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                      active ? 'text-[var(--sf-primary-dark)]' : 'text-[var(--sf-muted)]'
                    }`}
                  >
                    <span className={`flex items-center justify-center h-7 px-4 rounded-full transition-colors ${active ? 'bg-[var(--sf-primary-soft)]' : ''}`}>
                      <item.icon size={21} strokeWidth={active ? 2.5 : 2} />
                    </span>
                    <span className={`text-[11px] truncate max-w-full px-1 ${active ? 'font-bold' : 'font-semibold'}`}>
                      {item.tabLabel ?? item.label}
                    </span>
                  </button>
                );
              })}
              <button
                onClick={() => setMoreOpen(true)}
                className={`font-raleway min-w-0 flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  moreOpen || MORE_ITEMS.some((i) => isActive(pathname, i.href)) ? 'text-[var(--sf-primary-dark)]' : 'text-[var(--sf-muted)]'
                }`}
              >
                <span
                  className={`flex items-center justify-center h-7 px-4 rounded-full transition-colors ${
                    moreOpen || MORE_ITEMS.some((i) => isActive(pathname, i.href)) ? 'bg-[var(--sf-primary-soft)]' : ''
                  }`}
                >
                  <FiMoreHorizontal size={21} />
                </span>
                <span className="text-[11px] font-semibold">More</span>
              </button>
            </nav>
          </div>
        )}
      </div>
    </AppChromeContext.Provider>
  );
}
