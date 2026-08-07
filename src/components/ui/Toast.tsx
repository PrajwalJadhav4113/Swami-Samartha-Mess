"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  title?: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, title?: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info", title?: string) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, message, title, type }]);
      
      // Auto dismiss after 4 seconds
      setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast]
  );

  const success = useCallback((msg: string, title?: string) => toast(msg, "success", title), [toast]);
  const error = useCallback((msg: string, title?: string) => toast(msg, "error", title), [toast]);
  const info = useCallback((msg: string, title?: string) => toast(msg, "info", title), [toast]);
  const warning = useCallback((msg: string, title?: string) => toast(msg, "warning", title), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info, warning }}>
      {children}
      {/* Toast Portal Overlay */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm">
        {toasts.map((t) => {
          let bgClass = "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-50";
          let icon = <Info className="h-5 w-5 text-blue-500" />;

          if (t.type === "success") {
            bgClass = "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-50";
            icon = <CheckCircle className="h-5 w-5 text-emerald-500" />;
          } else if (t.type === "error") {
            bgClass = "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-50";
            icon = <AlertCircle className="h-5 w-5 text-rose-500" />;
          } else if (t.type === "warning") {
            bgClass = "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-50";
            icon = <AlertTriangle className="h-5 w-5 text-amber-500" />;
          }

          return (
            <div
              key={t.id}
              className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg transition-all duration-300 transform translate-y-0 animate-in fade-in slide-in-from-bottom-5 ${bgClass}`}
              role="alert"
            >
              <div className="flex-shrink-0 mt-0.5">{icon}</div>
              <div className="flex-grow">
                {t.title && <h4 className="font-semibold text-sm leading-tight mb-0.5">{t.title}</h4>}
                <p className="text-sm leading-normal opacity-90">{t.message}</p>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="flex-shrink-0 ml-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
