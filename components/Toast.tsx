import { useCallback, useEffect, useState } from "react";
import { Toast as ToastType } from "../lib/chain";

export function useToasts() {
  const [toasts, setToasts] = useState<ToastType[]>([]);

  const addToast = useCallback(
    (type: ToastType["type"], title: string, body: string, tx?: string) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, type, title, body, tx }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

export default function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: ToastType[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <button className="toast-close" onClick={() => onRemove(t.id)}>
            ×
          </button>
          <span className="toast-title">{t.title}</span>
          <span className="toast-body">{t.body}</span>
          {t.tx && (
            <a
              className="toast-tx"
              href={`https://solscan.io/tx/${t.tx}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View TX ↗
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
