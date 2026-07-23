"use client";

import { CheckCircle, Info, X, XCircle } from "@phosphor-icons/react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

/**
 * Toast system (design handoff) — bottom-center dark pill (ink-900 bg, cream
 * text, gold/status icon). One queue, one provider at the app root;
 * `useToast().show(...)` from any mutation. Auto-dismiss ~2.4s per the handoff
 * (errors stay 5s so they're not missed); `aria-live` polite so screen readers
 * announce without stealing focus.
 */
type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<{ show: (kind: ToastKind, message: string) => void } | null>(
  null,
);

const ICON = { success: CheckCircle, error: XCircle, info: Info } as const;
const ICON_COLOR: Record<ToastKind, string> = {
  success: "text-gold-400",
  error: "text-red-100",
  info: "text-gold-300",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setToasts((t) => [...t, { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === "error" ? 5000 : 2400);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex animate-pop-in items-center gap-2.5 rounded-full bg-ink-900 py-2.5 pl-4 pr-3 text-sm text-cream-50 shadow-lg"
            >
              <Icon
                aria-hidden
                weight="fill"
                className={`size-[18px] shrink-0 ${ICON_COLOR[t.kind]}`}
              />
              <p className="flex-1">{t.message}</p>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(t.id)}
                className="cursor-pointer rounded-full p-1 text-cream-50/60 hover:bg-cream-50/10 hover:text-cream-50"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
