import { useEffect, useRef } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastData {
  id: string;
  type: ToastType;
  message: string;
  posterUrl?: string;
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const TYPE_COLORS: Record<ToastType, string> = {
  success: "border-emerald-500/30 text-emerald-400",
  error: "border-red-500/30 text-red-400",
  info: "border-blue-500/30 text-blue-400",
  warning: "border-amber-500/30 text-amber-400",
};

const TYPE_ICONS: Record<ToastType, string> = {
  success: "M9 12.75 11.25 15 15 9.75",
  error: "M6 18 18 6M6 6l12 12",
  info: "M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z",
  warning: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008z",
};

export function Toast({ toast, onDismiss }: ToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timerRef.current);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg transition-all ${TYPE_COLORS[toast.type]}`}
      style={{
        background: "rgba(15,15,25,0.92)",
        backdropFilter: "blur(20px)",
        animation: "fade-slide-down 300ms ease forwards",
      }}
    >
      {toast.posterUrl && (
        <img
          src={toast.posterUrl}
          alt=""
          className="h-10 w-7 flex-shrink-0 rounded object-cover"
        />
      )}
      <svg
        className="h-5 w-5 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={TYPE_ICONS[toast.type]}
        />
      </svg>
      <span className="flex-1 text-sm text-white/90">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-1 flex-shrink-0 text-white/40 transition-colors hover:text-white/80"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
