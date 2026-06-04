"use client";

import { useEffect, useState } from "react";
import { GADS_ID, gtag } from "@/lib/gtag";

const STORAGE_KEY = "appo_consent";

type Choice = "granted" | "denied";

function applyConsent(choice: Choice) {
  gtag("consent", "update", {
    ad_storage: choice === "granted" ? "granted" : "denied",
    ad_user_data: choice === "granted" ? "granted" : "denied",
    ad_personalization: choice === "granted" ? "granted" : "denied",
    analytics_storage: choice === "granted" ? "granted" : "denied",
  });
}

/**
 * Banner de consentimiento (Consent Mode v2). Global: aparece en cualquier
 * página hasta que el usuario elige, para que pueda aceptar antes de que se
 * dispare la conversión (incluso si confirma el email en un navegador nuevo).
 *
 * - Sin elección previa → muestra el banner.
 * - Aceptar  → consent 'update' granted + persiste en localStorage.
 * - Rechazar → persiste denied (el default ya es denied, no hace falta update).
 * - Si ya había 'granted' guardado, lo reaplica en cada carga (el default del
 *   tag arranca siempre denied en cada visita).
 *
 * Si NEXT_PUBLIC_GADS_ID no está definido, no renderiza nada.
 */
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!GADS_ID) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage inaccesible: mostramos el banner (fail-safe).
    }

    if (stored === "granted") {
      applyConsent("granted");
    } else if (stored !== "denied") {
      setVisible(true);
    }
  }, []);

  function choose(choice: Choice) {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Si falla el guardado, al menos aplicamos en esta sesión.
    }
    applyConsent(choice);
    setVisible(false);
  }

  if (!GADS_ID || !visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t-[0.5px] border-border bg-card px-4 py-4 shadow-sm"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground">
          Usamos cookies propias y de terceros (Google Ads) para medir la
          eficacia de nuestra publicidad. Puedes aceptarlas o rechazarlas.{" "}
          <a
            href="https://appoclick.com/cookies"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:no-underline"
          >
            Más información
          </a>
          .
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => choose("denied")}
            className="rounded-[10px] border-[0.5px] border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-black/5"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={() => choose("granted")}
            className="rounded-[10px] bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
