/**
 * Helpers de cliente para Google Ads (gtag.js) con Consent Mode v2.
 *
 * El ID de conversión se lee de NEXT_PUBLIC_GADS_ID. Si no está definido,
 * GADS_ID es undefined y los componentes de tag/consent/conversión no se
 * renderizan (no rompe builds locales sin la env).
 */
export const GADS_ID = process.env.NEXT_PUBLIC_GADS_ID;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Empuja una llamada gtag a la dataLayer. Prefiere window.gtag (definido por
 * el script de init); si aún no existe por una carrera de carga, encola el
 * array en dataLayer para que gtag.js lo procese cuando arranque.
 */
export function gtag(...args: unknown[]): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag === "function") {
    window.gtag(...args);
    return;
  }
  window.dataLayer.push(args);
}
