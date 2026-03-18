"use client";

import { useEffect } from "react";

type ToastProps = {
  message: string;
  visible: boolean;
  onHide: () => void;
  durationMs?: number;
};

export default function Toast({
  message,
  visible,
  onHide,
  durationMs = 2600,
}: ToastProps) {
  useEffect(() => {
    if (!visible) return;
    const timeout = window.setTimeout(() => {
      onHide();
    }, durationMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [durationMs, onHide, visible]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-50 w-[92%] max-w-sm -translate-x-1/2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 transition-all duration-150">
      {message}
    </div>
  );
}
