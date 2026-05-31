"use client";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import {
  ToastContextProvider,
  useToast,
} from "@/components/ui/use-toast";

function ToasterInner() {
  const { toasts, dismiss } = useToast();
  return (
    <ToastProvider>
      {toasts.map((t) => (
        <Toast
          key={t.id}
          variant={t.variant}
          onOpenChange={(open) => !open && dismiss(t.id)}
        >
          <div className="grid gap-1">
            {t.title && <ToastTitle>{t.title}</ToastTitle>}
            {t.description && (
              <ToastDescription>{t.description}</ToastDescription>
            )}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}

export function Toaster({ children }: { children: React.ReactNode }) {
  return (
    <ToastContextProvider>
      {children}
      <ToasterInner />
    </ToastContextProvider>
  );
}
