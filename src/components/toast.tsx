"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

// 轻量 toast：底部居中浮出，2.5s 自动消失。
// 用法：const toast = useToast(); toast("已加入收藏"); toast("失败了", "error");
type ToastKind = "success" | "error";
type ToastItem = { id: number; message: string; kind: ToastKind };

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = ++nextId.current;
    setItems((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 2500);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-10 z-50 flex flex-col items-center gap-2 px-6"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={`toast-in pointer-events-auto rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-xl ${
              item.kind === "error" ? "bg-promo" : "bg-ink"
            }`}
          >
            {item.kind === "error" ? "⚠️ " : "✓ "}
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
