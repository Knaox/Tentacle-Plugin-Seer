import { createContext, useCallback, useState } from "react";
import { Toast } from "./Toast";
import type { ToastData, ToastType } from "./Toast";
import { CHROME_BOTTOM } from "../utils/host-chrome";

export interface ToastContextValue {
  show: (type: ToastType, message: string, posterUrl?: string) => void;
}

export const ToastContext = createContext<ToastContextValue>({
  show: () => {},
});

const MAX_TOASTS = 3;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (type: ToastType, message: string, posterUrl?: string) => {
      const id = crypto.randomUUID();
      setToasts((prev) => {
        const next = [...prev, { id, type, message, posterUrl }];
        return next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next;
      });
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {/* Au-dessus de la barre de l'hôte : un toast posé à 16 px du bord
          disparaissait derrière la barre d'onglets de l'application mobile. */}
      <div
        className="pointer-events-none fixed right-4 z-[9999] flex w-80 flex-col gap-2"
        style={{ bottom: `calc(1rem + ${CHROME_BOTTOM})` }}
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
