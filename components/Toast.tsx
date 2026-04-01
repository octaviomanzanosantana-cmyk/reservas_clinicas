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
    <div className="fixed bottom-5 left-1/2 z-50 w-[92%] max-w-sm -translate-x-1/2 rounded-[10px] border-[0.5px] border-border bg-card px-4 py-3 text-sm text-foreground shadow-sm">
      {message}
    </div>
  );
}
