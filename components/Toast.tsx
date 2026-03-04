"use client";

import { useEffect } from "react";

type ToastProps = {
  message: string;
  visible: boolean;
  onHide: () => void;
};

export default function Toast({ message, visible, onHide }: ToastProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => {
      onHide();
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [visible, onHide]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-50 w-[92%] max-w-sm -translate-x-1/2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-lg transition-all duration-150">
      {message}
    </div>
  );
}
