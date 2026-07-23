import { CheckCircle, Info, XCircle } from "phosphor-react-native";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Text, View } from "react-native";

import type { PhosphorIcon } from "./icon";

/**
 * Toast (design handoff, mobile) — a dark ink pill, bottom-centre, gold glyph.
 * One queue; `useToast().show(...)` from any mutation. Auto-dismiss 4s. Rendered
 * above the app via a root provider.
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

const ICON: Record<ToastKind, PhosphorIcon> = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};
const ICON_COLOR: Record<ToastKind, string> = {
  success: "#D6B36A",
  error: "#E7A79A",
  info: "#BFD5E6",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const show = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toasts.length > 0 ? (
        <View className="absolute inset-x-4 bottom-10 items-center gap-2" pointerEvents="none">
          {toasts.map((t) => {
            const Glyph = ICON[t.kind];
            return (
              <View
                key={t.id}
                className="max-w-full flex-row items-center gap-2 self-center rounded-pill bg-neutral-900 px-4 py-3 shadow-md"
              >
                <Glyph size={17} color={ICON_COLOR[t.kind]} weight="fill" />
                <Text className="font-sans text-sm font-semibold text-neutral-50">{t.message}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
