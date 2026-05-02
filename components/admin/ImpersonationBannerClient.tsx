"use client";

import { useEffect, useState } from "react";

type ImpersonationBannerClientProps = {
  clinicName: string;
  expiresAt: string;
};

function minutesLeft(expiresAt: string): number {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / 60_000));
}

export function ImpersonationBannerClient({
  clinicName,
  expiresAt,
}: ImpersonationBannerClientProps) {
  const [remaining, setRemaining] = useState(() => minutesLeft(expiresAt));
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const tick = () => setRemaining(minutesLeft(expiresAt));
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  const handleExit = async () => {
    setExiting(true);
    try {
      const res = await fetch("/api/admin/impersonate-clinic/end", {
        method: "POST",
      });
      const data = (await res.json()) as { redirect_to?: string };
      window.location.href = data.redirect_to ?? "/admin/clinics";
    } catch {
      setExiting(false);
    }
  };

  if (remaining === 0) return null;

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-md">
      <div className="flex items-center gap-2">
        <span aria-hidden="true">🔧</span>
        <span>
          Modo impersonación activo: <strong>{clinicName}</strong> · expira en{" "}
          {remaining} {remaining === 1 ? "min" : "min"}
        </span>
      </div>
      <button
        type="button"
        onClick={() => void handleExit()}
        disabled={exiting}
        className="rounded-md bg-white/20 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {exiting ? "Saliendo..." : "Salir de impersonación"}
      </button>
    </div>
  );
}
