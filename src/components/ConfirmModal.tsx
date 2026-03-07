import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t } = useTranslation("seer");
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(onCancel, 200);
  }, [onCancel]);

  useEffect(() => {
    if (!open) { setIsClosing(false); return; }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    confirmRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ animation: isClosing ? "fadeOut 200ms ease forwards" : "fadeIn 200ms ease forwards" }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 p-6"
        style={{
          background: "rgba(15,15,25,0.95)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          animation: isClosing ? "fadeOut 200ms ease forwards" : "scaleIn 200ms ease forwards",
        }}
      >
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm text-white/60">{message}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="rounded-lg bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            {t("cancel")}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
              danger
                ? "bg-red-600/80 hover:bg-red-600"
                : "bg-purple-600 hover:bg-purple-500"
            }`}
          >
            {confirmLabel ?? t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
