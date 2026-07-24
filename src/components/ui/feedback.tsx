'use client';

/**
 * Platform feedback layer — the one place errors, confirmations and quick
 * notices are shown. It replaces the native browser dialogs (`alert`,
 * `window.confirm`) that used to leak the origin ("smartfolioai.anggler.com
 * says…") and couldn't be styled.
 *
 *   const { error, success, confirm } = useFeedback();
 *   error('The AI service is busy right now. Please try again in a few minutes.');
 *   if (!(await confirm({ title: 'Remove this job?', variant: 'danger' }))) return;
 *
 * Mount <FeedbackProvider> once, high in the tree (see app/layout.tsx). Toasts
 * auto-dismiss; confirms return a promise so they drop straight into the
 * `if (!await confirm(...)) return;` shape the old `window.confirm` calls used.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  FiAlertCircle, FiCheckCircle, FiInfo, FiX, FiAlertTriangle,
} from 'react-icons/fi';

type ToastVariant = 'error' | 'success' | 'info';
type ToastItem = { id: number; message: string; variant: ToastVariant };

type ConfirmOptions = {
  title: string;
  /** Optional supporting line under the title. */
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' for destructive actions (red confirm button). */
  variant?: 'default' | 'danger';
};
type ConfirmRequest = ConfirmOptions & { id: number; resolve: (ok: boolean) => void };

type FeedbackValue = {
  /** Raise a toast. Defaults to the error style. */
  toast: (message: string, variant?: ToastVariant) => void;
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
  /** Open a styled confirm dialog; resolves true when confirmed, false otherwise. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackValue | null>(null);

// Long enough to read a sentence, short enough that stacked errors never pile up.
const TOAST_TTL_MS = 8000;

let nextId = 1;

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // Only ever show the first; extra confirms queue behind it so a second call
  // can't silently drop the first's promise.
  const [confirmQueue, setConfirmQueue] = useState<ConfirmRequest[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, variant: ToastVariant = 'error') => {
    setToasts((list) => [...list, { id: nextId++, message, variant }]);
  }, []);

  const error = useCallback((message: string) => toast(message, 'error'), [toast]);
  const success = useCallback((message: string) => toast(message, 'success'), [toast]);
  const info = useCallback((message: string) => toast(message, 'info'), [toast]);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmQueue((q) => [...q, { ...options, id: nextId++, resolve }]);
    });
  }, []);

  const resolveConfirm = useCallback((id: number, ok: boolean) => {
    setConfirmQueue((q) => {
      const req = q.find((c) => c.id === id);
      req?.resolve(ok);
      return q.filter((c) => c.id !== id);
    });
  }, []);

  const value = useMemo<FeedbackValue>(
    () => ({ toast, error, success, info, confirm }),
    [toast, error, success, info, confirm],
  );

  const activeConfirm = confirmQueue[0] ?? null;

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      {activeConfirm && (
        <ConfirmDialog
          key={activeConfirm.id}
          request={activeConfirm}
          onResolve={(ok) => resolveConfirm(activeConfirm.id, ok)}
        />
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within a <FeedbackProvider>');
  return ctx;
}

/* ------------------------------- Toasts -------------------------------- */

const TOAST_STYLES: Record<ToastVariant, { chip: string; Icon: typeof FiAlertCircle; label: string }> = {
  error: { chip: 'bg-red-50 text-red-500', Icon: FiAlertCircle, label: 'Error' },
  success: { chip: 'bg-emerald-50 text-emerald-500', Icon: FiCheckCircle, label: 'Success' },
  info: { chip: 'bg-indigo-50 text-indigo-500', Icon: FiInfo, label: 'Notice' },
};

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-6 right-6 z-[110] flex flex-col gap-3 w-[min(24rem,calc(100vw-3rem))] pointer-events-none">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const { chip, Icon, label } = TOAST_STYLES[toast.variant];

  // Each toast dismisses itself so a burst of them doesn't share one timer.
  useEffect(() => {
    const t = setTimeout(onDismiss, TOAST_TTL_MS);
    return () => clearTimeout(t);
    // onDismiss is stable per toast id; re-running would reset the countdown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="alert"
      className="pointer-events-auto rounded-2xl bg-white border border-slate-100 shadow-xl px-4 py-3.5 flex items-start gap-3 animate-[toastIn_.18s_ease-out]"
    >
      <span className={`mt-0.5 w-8 h-8 grid place-items-center rounded-xl flex-shrink-0 ${chip}`}>
        <Icon size={16} />
      </span>
      <p className="font-raleway flex-1 text-sm text-slate-700 leading-snug">{toast.message}</p>
      <button
        onClick={onDismiss}
        aria-label={`Dismiss ${label.toLowerCase()}`}
        className="text-slate-500 hover:text-slate-700 transition flex-shrink-0"
      >
        <FiX size={16} />
      </button>
    </div>
  );
}

/* ------------------------------- Confirm ------------------------------- */

function ConfirmDialog({ request, onResolve }: { request: ConfirmRequest; onResolve: (ok: boolean) => void }) {
  const danger = request.variant === 'danger';

  // Escape cancels; focus the dialog so the key is caught without a click first.
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onResolve(false);
      if (e.key === 'Enter') onResolve(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onResolve]);

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-black/60 backdrop-blur-sm p-4 animate-[toastIn_.15s_ease-out]"
      onClick={() => onResolve(false)}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={request.title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-[#0F1424] border border-white/10 p-6 shadow-2xl text-center outline-none"
      >
        <div
          className={`mx-auto mb-3 w-12 h-12 grid place-items-center rounded-2xl ${
            danger ? 'bg-rose-500/15 text-rose-400' : 'bg-indigo-500/15 text-indigo-300'
          }`}
        >
          {danger ? <FiAlertTriangle size={22} /> : <FiInfo size={22} />}
        </div>
        <h4 className="font-century text-white font-bold text-lg">{request.title}</h4>
        {request.message && (
          <p className="font-raleway text-slate-400 text-sm mt-1.5">{request.message}</p>
        )}
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => onResolve(false)}
            className="font-raleway flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 text-slate-200 font-semibold text-sm hover:bg-white/10 transition"
          >
            {request.cancelLabel ?? 'Cancel'}
          </button>
          <button
            onClick={() => onResolve(true)}
            className={`font-raleway flex-1 h-11 rounded-2xl text-white font-bold text-sm transition ${
              danger ? 'bg-rose-500 hover:bg-rose-600' : 'bg-indigo-500 hover:bg-indigo-600'
            }`}
          >
            {request.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
