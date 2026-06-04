import Script from "next/script";
import { GADS_ID } from "@/lib/gtag";

/**
 * Carga el Google tag de Google Ads (AW-…) con Consent Mode v2 y el linker
 * cross-domain compartido con la landing (appoclick.com ↔ app.appoclick.com).
 *
 * Orden importante: el consent 'default' (denied) se empuja a la dataLayer
 * ANTES del 'config', para que Consent Mode aplique desde el primer momento.
 * El consentimiento sube a 'granted' solo cuando el usuario acepta en el
 * banner (ver ConsentBanner). Sin el banner, todo queda denied (pings
 * cookieless / conversiones modeladas).
 *
 * Si NEXT_PUBLIC_GADS_ID no está definido, no renderiza nada.
 */
export function GoogleAds() {
  if (!GADS_ID) return null;

  return (
    <>
      <Script
        id="gtag-src"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GADS_ID}`}
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied'
          });
          gtag('config', '${GADS_ID}', {
            linker: {
              domains: ['appoclick.com', 'app.appoclick.com'],
              accept_incoming: true
            }
          });
        `}
      </Script>
    </>
  );
}
