import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  kind: ToastKind;
  title?: string;
  message: string;
}

interface ToastState {
  push: (kind: ToastKind, message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastState | null>(null);

const ICONS: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  error: <XCircle className="h-5 w-5 text-red-500" />,
  info: <Info className="h-5 w-5 text-sky-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string, title?: string) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((ts) => [...ts.slice(-4), { id, kind, message, title }]);
      window.setTimeout(() => remove(id), kind === 'error' ? 9000 : 6000);
    },
    [remove]
  );

  const value = useMemo<ToastState>(
    () => ({
      push,
      success: (m, t) => push('success', m, t),
      error: (m, t) => push('error', m, t),
      info: (m, t) => push('info', m, t),
      warning: (m, t) => push('warning', m, t),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="mt-0.5 shrink-0">{ICONS[t.kind]}</div>
            <div className="min-w-0 flex-1">
              {t.title ? (
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.title}</p>
              ) : null}
              <p className="text-sm text-gray-600 dark:text-gray-300">{t.message}</p>
            </div>
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="focus-ring rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastState {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
