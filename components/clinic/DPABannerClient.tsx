"use client";

// Sprint 7.6 — DPA banner client UI con cooldown 24h.
// Copy heredado del banner inline previo (ClinicDashboardPage.tsx:453-465).

import Link from "next/link";
import { useEffect, useState } from "react";

const COOLDOWN_KEY = "dpa_banner_dismissed_until";
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h

export default function DPABannerClient() {
  const [hidden, setHidden] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const dismissedUntil = localStorage.getItem(COOLDOWN_KEY);
      if (!dismissedUntil) return;
      const until = parseInt(dismissedUntil, 10);
      if (Number.isFinite(until) && Date.now() < until) {
        setHidden(true);
      } else {
        // TTL vencido o valor corrupto: limpiar para no acumular basura.
        localStorage.removeItem(COOLDOWN_KEY);
      }
    } catch {
      // localStorage inaccesible (private mode, storage full): fail-safe = mostrar.
    }
  }, []);

  function handleDismiss() {
    try {
      const until = Date.now() + COOLDOWN_MS;
      localStorage.setItem(COOLDOWN_KEY, until.toString());
    } catch {
      // Si localStorage falla, ocultamos solo en memoria de esta pestaña.
    }
    setHidden(true);
  }

  // Evita flash de banner cerrado durante hidratación.
  if (!mounted) return null;
  if (hidden) return null;

  return (
    <section
      role="status"
      className="rounded-[14px] border-[0.5px] border-amber-200 bg-amber-50 p-5 mb-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800">
            📋 Tienes un contrato pendiente de firmar. Para cumplir con el RGPD, acepta el DPA antes de continuar usando AppoClick con pacientes reales.
          </p>
          <Link
            href="/dpa"
            className="mt-3 inline-block text-sm font-semibold text-[#0E9E82] hover:underline"
          >
            Ver y aceptar el DPA →
          </Link>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Cerrar aviso temporalmente"
          className="shrink-0 px-2 py-1 text-lg leading-none text-amber-700 hover:text-amber-900 hover:bg-black/5 rounded transition-colors"
        >
          ×
        </button>
      </div>
    </section>
  );
}
