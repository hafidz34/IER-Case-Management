import { useEffect, useState } from "react";

export type ToastPayload = {
  message: string;
  type?: "error" | "success";
};

export function pushToast(message: string, type: "error" | "success" = "error") {
  window.dispatchEvent(new CustomEvent<ToastPayload>("app-toast", { detail: { message, type } }));
}

export default function ToastHost() {
  const [toast, setToast] = useState<ToastPayload | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ToastPayload>).detail;
      if (!detail?.message) return;
      setToast(detail);
    };
    window.addEventListener("app-toast", handler);
    return () => window.removeEventListener("app-toast", handler);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="toast-container" role="status" aria-live="polite">
      <div className={`toast ${toast.type === "success" ? "toast--success" : "toast--error"}`}>
        {toast.message}
      </div>
    </div>
  );
}
