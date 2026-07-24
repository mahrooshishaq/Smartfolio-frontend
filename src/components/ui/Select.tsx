'use client';

/**
 * Custom dropdown — the platform's replacement for the native <select>, whose
 * option list is drawn by the OS and can't be styled to match the app.
 *
 *   <Select
 *     value={status}
 *     onChange={setStatus}
 *     options={[{ value: 'saved', label: 'Saved' }, …]}
 *     className="<same classes the old <select> trigger used>"
 *   />
 *
 * The trigger keeps whatever classes the caller passes (so each dropdown holds
 * its existing look); only the popup is ours. The popup renders in a portal and
 * is positioned against the viewport, so it never gets clipped by a card's
 * rounded/overflow bounds and never fights page z-index. Keyboard: arrows move,
 * Enter selects, Esc/Home/End as expected; click-outside and scroll close it.
 */

import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import { FiChevronDown, FiCheck } from 'react-icons/fi';

export type SelectOption = { value: string; label: React.ReactNode };

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Trigger classes — pass what the old <select> used so the look is unchanged. */
  className?: string;
  /** Shown when no option matches value (the empty-value option usually covers this). */
  placeholder?: React.ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
};

type MenuPos = { left: number; width: number; maxHeight: number; top?: number; bottom?: number };

// useLayoutEffect warns during SSR; the menu only ever positions client-side.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function Select({ value, onChange, options, className = '', placeholder, ariaLabel, disabled }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    const spaceBelow = window.innerHeight - r.bottom - margin;
    const spaceAbove = r.top - margin;
    // Flip up only when below is genuinely cramped and above has more room.
    const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(140, Math.min(320, openUp ? spaceAbove : spaceBelow));
    const menuWidth = Math.max(r.width, 176);
    let left = r.left;
    if (left + menuWidth > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - margin - menuWidth);
    }
    setPos({
      left,
      width: r.width,
      maxHeight,
      // Anchoring by top (down) or bottom (up) means we never need the menu's height.
      ...(openUp ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
    });
  }, []);

  // Position on open, and keep it pinned to the trigger while scrolling/resizing.
  useIsoLayoutEffect(() => {
    if (!open) return;
    reposition();
    let frame = 0;
    const onMove = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(reposition);
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, reposition]);

  // Close on click outside the trigger or the menu.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Keep the highlighted row in view as the user arrows through.
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const openMenu = () => {
    if (disabled) return;
    const current = options.findIndex((o) => o.value === value);
    setActiveIndex(current >= 0 ? current : 0);
    setOpen(true);
  };

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActiveIndex((i) => Math.min(options.length - 1, i + 1)); break;
      case 'ArrowUp': e.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)); break;
      case 'Home': e.preventDefault(); setActiveIndex(0); break;
      case 'End': e.preventDefault(); setActiveIndex(options.length - 1); break;
      case 'Enter': e.preventDefault(); if (options[activeIndex]) choose(options[activeIndex].value); break;
      case 'Escape': e.preventDefault(); setOpen(false); triggerRef.current?.focus(); break;
      case 'Tab': setOpen(false); break;
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={`inline-flex items-center justify-between gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <span className="truncate">{selected ? selected.label : (placeholder ?? '')}</span>
        <FiChevronDown size={14} className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            bottom: pos.bottom,
            minWidth: Math.max(pos.width, 176),
            maxWidth: 'calc(100vw - 1rem)',
            maxHeight: pos.maxHeight,
          }}
          className="z-[130] overflow-y-auto rounded-2xl bg-white border border-slate-100 shadow-xl p-1.5 animate-[toastIn_.14s_ease-out]"
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            const isActive = i === activeIndex;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-index={i}
                tabIndex={-1}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => choose(o.value)}
                className={`font-raleway w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl text-sm transition-colors ${
                  isActive ? 'bg-indigo-50 text-indigo-600' : isSelected ? 'text-indigo-600' : 'text-slate-600'
                }`}
              >
                <span className="flex-1 truncate">{o.label}</span>
                {isSelected && <FiCheck size={14} className="shrink-0 text-indigo-500" />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
