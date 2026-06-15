export type ToastType = "success" | "error" | "info";

export type ToastPayload = {
  type: ToastType;
  title: string;
  message?: string;
  durationMs?: number;
};

type ToastListener = (toast: ToastPayload) => void;

const listeners = new Set<ToastListener>();

export const subscribeToToasts = (listener: ToastListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const publishToast = (toast: ToastPayload) => {
  listeners.forEach((listener) => listener(toast));
};

export const getErrorMessage = (err: unknown, fallback = "Request failed") => (
  err instanceof Error && err.message ? err.message : fallback
);