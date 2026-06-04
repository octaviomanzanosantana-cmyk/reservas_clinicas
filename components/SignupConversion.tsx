"use client";

import { useEffect } from "react";
import { GADS_ID, gtag } from "@/lib/gtag";

const SEND_TO = "AW-18211170818/Ci0TCO7atLgcEILU4etD";

// Guard a nivel de módulo: evita doble disparo por re-render o por el doble
// montaje de React en desarrollo (StrictMode).
let fired = false;

/**
 * Dispara el evento de conversión de Google Ads una sola vez por alta.
 *
 * /auth/confirm redirige a /clinic/{slug}?signup=1 únicamente en la rama de
 * alta nueva (la rama idempotente no añade el parámetro), así que este
 * componente solo dispara en el primer aterrizaje tras crear la clínica.
 * Tras disparar, limpia el query param con history.replaceState para que un
 * recargado no vuelva a contar.
 *
 * Consent Mode gobierna si el ping usa cookies (granted) o es cookieless
 * (denied); el evento se envía igualmente.
 */
export default function SignupConversion() {
  useEffect(() => {
    if (!GADS_ID || fired) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("signup") !== "1") return;

    fired = true;
    gtag("event", "conversion", { send_to: SEND_TO });

    params.delete("signup");
    const query = params.toString();
    const cleanUrl =
      window.location.pathname + (query ? `?${query}` : "") + window.location.hash;
    window.history.replaceState(null, "", cleanUrl);
  }, []);

  return null;
}
