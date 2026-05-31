"use client";

import * as React from "react";

type Variant = "default" | "destructive" | "success";

export interface ToastMessage {
  id: string;
  title?: string;
  description?: string;
  variant?: Variant;
}

type Ctx = {
  toasts: ToastMessage[];
  toast: (t: Omit<ToastMessage, "id">) => void;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<Ctx | null>(null);

export function ToastContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const toast = React.useCallback((t: Omit<ToastMessage, "id">) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, ...t }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((x) => x.id !== id)),
      5000,
    );
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastContextProvider");
  return ctx;
}
