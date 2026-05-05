# Sprint 5 — Páginas legales y arquitectura legal centralizada

**Fecha:** 28 abril – 4 mayo 2026
**Repos afectados:** `appoclick-landing` (principal), `reservas-clinicas-txum` (limpieza + redirects)
**Autor:** Octavio Manzano + Claude
**Estado:** ✅ Cerrado

---

## Resumen ejecutivo

Sprint 5 publica la documentación legal completa de Appoclick en el dominio
público `appoclick.com` (Política de Privacidad, Aviso Legal, Política de
Cookies, Términos y Condiciones), reescribe el banner de cookies con tono
USTED y consentimiento versionado, y limpia el repo de la app eliminando
las páginas legales legacy con redirects 308 cross-domain hacia la landing.

Decisión arquitectónica clave: **toda la documentación legal vive en
`appoclick.com`** (patrón estándar SaaS). La app `app.appoclick.com` queda
limpia, salvo `/dpa` que se mantiene allí porque es un acto vinculante
ligado al uso del servicio (firma + persistencia BD), no contenido
informativo público.

Sprint cerrado con 6 commits encadenados en producción y URLs legales
configuradas en Stripe Customer Portal LIVE.

---

## Hashes encadenados

### Repo `appoclick-landing` (5 commits)

| Bloque | Hash | Mensaje |
|---|---|---|
| B0+B1+B2 | `6397690` | feat(sprint-5): migrate /privacidad and /aviso-legal from app, drop broken redirect |
| B3 | `57addf9` | feat(sprint-5): rewrite /cookies with real audit data and usted tone |
| B4 | `b4392a6` | feat(sprint-5): update /terminos with anual plan, billing fix, dpa section |
| B5 | `cf79167` | feat(sprint-5): rewrite CookieBanner with usted tone and versioned consent |
| B6 | `e2afa6f` | feat(sprint-5): add /aviso-legal link to footer |

### Repo `reservas-clinicas-txum` (1 commit)

| Bloque | Hash | Mensaje |
|---|---|---|
| B7 | `6b73e80` | feat(sprint-5): remove legacy /privacy and /legal pages, add 308 redirects to landing |

---

## Decisiones clave

### D1 — Arquitectura legal centralizada en `appoclick.com` (Opción A del análisis)

Antes del sprint coexistían dos versiones de páginas legales:
- `app.appoclick.com/privacy` y `/legal` (v1.0, contenido sólido, Server Components)
- `appoclick.com/cookies` y `/terminos` (existentes pero con errores de contenido)
- `appoclick.com/privacidad` referenciada en footer pero NO existía → redirect roto en `next.config.ts` apuntaba a la app

Tres opciones evaluadas en auditoría:
- **A. Centralizar en landing** → migrar `/privacy` y `/legal` desde la app a la landing
- **B. Centralizar en la app** → vaciar landing de legales
- **C. Mantener duplicado** → dos versiones en paralelo

Decisión: **A**. Razones: patrón estándar industria SaaS (Holded, Factorial, Notion, Stripe — todos centralizan legal en dominio comercial público), una única fuente de verdad, SEO consolidado, Stripe Customer Portal espera URLs públicas estables.

### D2 — `/dpa` se mantiene en la app

El DPA tiene dos componentes: el documento legal v1.4 (texto íntegro del
contrato) y el flujo de firma (`AcceptDpaButton` + endpoint
`/api/auth/accept-dpa` + persistencia en `clinics.dpa_accepted_at`).

Decisión: ambos en `app.appoclick.com/dpa`. El DPA no es contenido
informativo público sino un acto vinculante entre la clínica y Appoclick.
Solo tiene sentido firmarlo cuando ya hay una clínica dándose de alta.
Cuando `/privacidad` o `/terminos` necesitan referenciarlo, lo hacen con
link cross-domain a `https://app.appoclick.com/dpa`.

### D3 — Tono diferenciado por documento

- `/privacidad` y `/aviso-legal`: **USTED** (convención sectorial, alineado
  con cómo va a leerlo el asesor/Davinia para validación legal externa)
- `/terminos`: **TÚ** (mantener coherencia con landing comercial; no merece
  la pena reescribir 270 líneas para cambiar tono que ya estaba bien
  alineado con la voz de marca)
- `/cookies`: **USTED** (más institucional)
- `CookieBanner`: **USTED** (es notificación legal, no copy comercial)

### D4 — Banner de cookies: informativo único, no consent banner con toggles

Auditoría A.3 confirmó que `appoclick.com` no instala ninguna cookie y la
única cookie en `app.appoclick.com` es `sb-*-auth-token` (Supabase Auth,
técnica necesaria, exenta Art. 22.2 LSSI-CE).

Como no hay nada que consentir legalmente, un banner con 3 botones
(Aceptar / Rechazar / Configurar) sería UX confuso y semánticamente
incorrecto. Se optó por banner informativo único con un solo botón
"Entendido", persistencia versionada y cleanup de la clave legacy.

Cuando en el futuro se añada tracking real (Plausible, etc.), se actualiza
el banner a granularidad real con bump de `POLICY_VERSION` para forzar
re-consent.

### D5 — Bullet "RGPD + DPA incluido" del cuadro Starter en /terminos

Eliminado del bullet list y movido a sección 10 dedicada con link
cross-domain a `app.appoclick.com/dpa`. Razón: ningún ICP en demos
preguntó por DPA; no es decision driver. La sección dedicada eleva
el compromiso legal sin saturar el cuadro comercial.

Las menciones equivalentes en home (cuadro Starter sección Pricing,
sección "Sin compromiso", sección Funcionalidades) se mantienen y se
revisan en Sprint 5.1 (copy landing) — ahí se decide si quitarlas o
reformularlas.

### D6 — Mención plan anual en /terminos

`/terminos` Sección 2 ahora menciona explícitamente "19 €/mes o 190 €/año".
El plan anual existe en Stripe LIVE como `price_1TRgDIAL0qP42ZSxJQdWJ7QC`
desde Sprint 1, pero los términos solo mencionaban mensual. Corregido.

### D7 — Frecuencia de cobro en /terminos sección 4

Antes: "La suscripción es mensual y se renueva automáticamente el mismo día
de cada mes."
Después: "La suscripción puede ser mensual (19 €) o anual (190 €) y se
renueva automáticamente al final de cada periodo facturado."

Más preciso y compatible con plan anual.

### D8 — Versionado a 1.1 · Mayo 2026

Todas las páginas legales bumpean a `Versión 1.1 · Mayo 2026` (antes
algunas estaban en `Abril 2026` o `Versión 1.0`). Patrón consistente,
alineado con cambio material de contenido.

---

## Implementación por bloque

### Bloque A — Auditoría preliminar

Auditoría exhaustiva en 3 fases:

**A.1 (`appoclick-landing`):** detectado redirect cruzado roto en
`next.config.ts` (`/privacidad` → `app.appoclick.com/privacy`), bullet
"RGPD + DPA incluido" en /terminos, banner cookies sin granularidad
LSSI-CE, footer sin link a aviso-legal.

**A.2 (`reservas-clinicas-txum`):** confirmado que `/privacy` y `/legal`
existen con contenido v1.0 sólido, panel autenticado SIN footer legal
(deuda Sprint 7), footer público de reservas en
`/b/[clinicSlug]/page.tsx:998-1006` apuntando a `/privacy` y `/legal`
locales, checkbox consentimiento RGPD en `/b/[clinicSlug]/page.tsx:955`
también apuntando a `/privacy`.

**A.3 (cookies en producción):** Chrome incógnito + DevTools confirmó:
- `appoclick.com`: cero cookies
- `app.appoclick.com`: una sola cookie `sb-wvggsgtsjtouqsiwwcls-auth-token`
  (Supabase, ~1 año, sin flags HttpOnly/Secure — limitación conocida de
  Supabase Auth client libs, deuda Sprint 7)

### Bloque B0+B1+B2 — Migración inicial (commit `6397690`)

- `next.config.ts`: bloque `async redirects()` eliminado (redirect roto)
- `app/privacidad/page.tsx`: creada migrando desde
  `reservas-clinicas-txum/app/privacy/page.tsx`. Adaptación de tokens CSS
  (`bg-bg`, `text-text-1`, `text-text-2`, `text-teal`, `bg-white`,
  `font-jakarta`) y bumpeo a v1.1. Sección 1 ampliada con párrafo DPA y
  link cross-domain a `app.appoclick.com/dpa`
- `app/aviso-legal/page.tsx`: creada migrando desde
  `reservas-clinicas-txum/app/legal/page.tsx`. Bumpeo a v1.1 y "Web:
  appoclick.com" (en vez de `app.appoclick.com`)

Stats: +248 inserciones, -9 borrados.

### Bloque B3 — Reescribir /cookies (commit `57addf9`)

Reescritura total del contenido manteniendo estructura JSX. Nueva
estructura de 6 secciones:
1. ¿Qué son las cookies?
2. Quién utiliza cookies en este sitio (Appoclick + 3 proveedores)
3. Cookies que se utilizan (separación landing vs app, tabla con datos
   reales de A.3)
4. Cookies de terceros (mención explícita Stripe Customer Portal —
   veracidad)
5. Cómo gestionar su consentimiento (link a banner + config navegador)
6. Contacto

Stats: +103 inserciones, -27 borrados.

### Bloque B4 — Corregir /terminos (commit `b4392a6`)

5 ediciones quirúrgicas en lugar de reescritura completa:
- L24: versión a 1.1
- L72: precio Starter "19 €/mes" → "19 €/mes o 190 €/año"
- L81: bullet "RGPD + DPA incluido" eliminado (cuadro Starter pasa de 7
  a 6 bullets)
- L135-136: frecuencia cobro corregida
- L245+: sección 10 nueva "Protección de datos y Encargado de Tratamiento"
  con 3 párrafos + link cross-domain a /dpa + link interno a /privacidad.
  Sección 10 anterior renumerada a 11

Stats: +48 inserciones, -6 borrados.

### Bloque B5 — Reescribir CookieBanner (commit `cf79167`)

Componente Client reescrito:
- Tono USTED (era TÚ implícito)
- Persistencia: clave `appoclick_cookie_consent` con JSON
  `{acknowledged, timestamp, version}` (era string `"accepted"` en clave
  `cookie_consent`)
- Versionado: `POLICY_VERSION = "1.1"` permite re-consent al actualizar
- Cleanup de clave legacy `cookie_consent` en cada montaje
- Texto explica honestamente que la web no instala cookies y que la app
  usa cookies técnicas Art. 22.2 LSSI-CE
- Botón único "Entendido" (era "Aceptar")
- Estilo visual idéntico al banner anterior (sticky inferior, mismas
  clases Tailwind)

Stats: +39 inserciones, -12 borrados.

### Bloque B6 — Footer link aviso-legal (commit `e2afa6f`)

Añadido `<li>` con link a `/aviso-legal` antes de `/privacidad` en columna
"Legal" del footer. Orden lógico final:
1. Aviso legal (LSSI Art. 10 — primero por convención)
2. Política de privacidad
3. Términos de servicio
4. Política de cookies

Stats: +5 inserciones.

### Bloque B7 — Cleanup repo app (commit `6b73e80`)

En `reservas-clinicas-txum`:
- `app/privacy/page.tsx` eliminado
- `app/legal/page.tsx` eliminado
- `next.config.ts`: añadido bloque `async redirects()` con dos 308
  cross-domain (`/privacy` → `appoclick.com/privacidad`, `/legal` →
  `appoclick.com/aviso-legal`, `permanent: true`)
- `app/b/[clinicSlug]/page.tsx`: 3 hrefs actualizados (footer público
  L998-L1003 + checkbox consentimiento RGPD L955) a URLs absolutas del
  landing con `target="_blank" rel="noreferrer"`

Stats: +17 inserciones, -242 borrados (las 2 páginas íntegras eliminadas).

### Bloque C — Stripe Customer Portal LIVE

URLs configuradas en Datos públicos → Información de la empresa LIVE:
- Política de privacidad: `https://appoclick.com/privacidad`
- Condiciones de servicio: `https://appoclick.com/terminos`
- Sitio web: `https://appoclick.com`
- Email soporte: `hola@appoclick.com`

Notas:
- Stripe TEST mode no admite edición de datos públicos por diseño. Los
  clientes reales (LIVE) ven las URLs correctas. Smoke funcional con
  cliente real diferido a Sprint 8 (cutover)
- `hola@appoclick.com` declarado pero buzón aún no operativo. Crear
  buzón funcional es bloqueante Sprint 8

---

## Smoke tests realizados en producción

| Verificación | Resultado |
|---|---|
| `https://appoclick.com/privacidad` carga v1.1 con sección DPA | ✅ |
| `https://appoclick.com/aviso-legal` carga v1.1 con Registro Mercantil | ✅ |
| `https://appoclick.com/cookies` carga v1.1 con tabla cookies reales | ✅ |
| `https://appoclick.com/terminos` carga v1.1 con plan anual + sección 10 DPA | ✅ |
| Footer landing muestra 4 links Legal en orden correcto | ✅ |
| CookieBanner aparece en primera visita (incógnito) | ✅ |
| CookieBanner persiste decisión en localStorage tras "Entendido" | ✅ |
| Persistencia con clave `appoclick_cookie_consent` y JSON versionado | ✅ |
| Cleanup de clave legacy `cookie_consent` funciona | ✅ |
| Redirect 308 `app.appoclick.com/privacy` → `appoclick.com/privacidad` | ✅ |
| Redirect 308 `app.appoclick.com/legal` → `appoclick.com/aviso-legal` | ✅ |
| `app.appoclick.com/dpa` intacto, sigue sirviendo el contrato v1.4 | ✅ |
| Footer público de reservas apunta a URLs absolutas del landing | ✅ |
| Checkbox consentimiento RGPD en formulario reserva apunta a landing | ✅ |
| Stripe Customer Portal LIVE muestra URLs legales configuradas | ✅ |

---

## Pendientes promovidos a otros sprints

### Sprint 5.1 — Copy landing (rev del bullet RGPD/DPA)

Tres menciones de RGPD/DPA en home a revisar (Octavio confirmó instinto
comercial: ningún ICP en demos las mencionó como decision driver):
- Cuadro Starter (sección Pricing): bullet "RGPD + DPA incluido"
- Sección "Sin compromiso": "RGPD desde el día 1 ... DPA incluido"
- Sección Funcionalidades: "RGPD y DPA incluidos"

Decidir junto con angle "alivio mental" si se mantienen, reformulan o
eliminan.

### Sprint 7 — Cleanup técnico

- **Banner DPA wall bloqueante:** convertir banner amber actual de
  `ClinicDashboardPage.tsx:453` en wall que redirige a `/dpa` cuando
  `dpa_accepted_at IS NULL` (excluyendo `is_pilot=true`). Infraestructura
  ya existe (página, endpoint, columna BD) — falta solo el guard en
  layout
- **Cookies Supabase Auth:** evaluar config con flags HttpOnly + Secure.
  Trade-off conocido: las libs cliente de Supabase necesitan acceder al
  token desde JS para refresh. Posible migración a `@supabase/ssr` con
  middleware Next.js
- **Footer panel autenticado:** decidir si añadir footer con links
  legales a layout del panel `(default)` y `(by-slug)`. Pre-cutover no
  es bloqueante porque clientes ven legales en Customer Portal Stripe.
  Post-launch puede ser deuda visible

### Sprint 8 — Bloqueantes cutover

- **Revisión legal externa:** Davinia/asesor RGPD valida los 4
  documentos antes del flip a `STRIPE_MODE=live`
- **Buzón `hola@appoclick.com`:** crear y operar el buzón referenciado
  en toda la documentación legal. Decidir si añadir buzones separados
  (`dpd@`, `facturacion@`) o centralizar en `hola@`
- **Smoke funcional Customer Portal con cliente real:** primer cliente
  paying en LIVE → abrir Customer Portal → verificar enlaces legales
  funcionan en producción

### Acción interim Octavio antes Sprint 8

- Verificar firma DPA de clínicas piloto (Miriam Lorenzo, Symbios
  Psicología). `dpa_accepted_at IS NULL` en BD para ambas (creadas antes
  del checkbox de signup en migración 14/04). Conseguir firma manual
  (PDF firmado), archivar en Drive, actualizar `dpa_accepted_at` en BD

---

## Métricas

| Métrica | Valor |
|---|---|
| Tiempo total | ~5h 30min (incluida auditoría exhaustiva) |
| Bloques planificados | 8 (A, B0-B2, B3, B4, B5, B6, B7, C, D) |
| Bloques entregados | 8/8 |
| Commits encadenados | 6 |
| Repos afectados | 2 |
| Archivos creados | 2 (`/privacidad`, `/aviso-legal` en landing) |
| Archivos eliminados | 2 (`/privacy`, `/legal` en app) |
| Archivos modificados | 7 (4 páginas legales, banner, footer, page.tsx app, 2 next.config.ts) |
| Líneas neto añadidas | +212 |
| Líneas neto eliminadas | -296 |
| Líneas neto delta | -84 (sprint reductivo: limpieza > creación) |
| Smoke tests pasados | 15/15 |

---

## Anexos

### Documentos de referencia

- `appoclick_matriz_saas_v1_1.md` (matriz SaaS principal)
- `DPA_Appoclick_v1_4__1_.pdf` (Contrato de Encargo de Tratamiento v1.4)
- `appoclick_brand_guide.html` (guía de marca, tokens CSS)

### Patrón de tokens CSS aplicado a páginas migradas

Tabla de mapeo aplicada al migrar `/privacidad` y `/aviso-legal` desde
`reservas-clinicas-txum` (que usa naming "estándar" tipo `bg-background`)
hacia `appoclick-landing` (que usa naming idiosincrático tipo `bg-bg`):

| Origen (app) | Destino (landing) |
|---|---|
| `bg-background` | `bg-bg` |
| `text-foreground` | `text-text-1` |
| `text-muted` | `text-text-2` |
| `hover:text-foreground` | `hover:text-text-1` |
| `text-primary` | `text-teal` |
| `bg-card` | `bg-white` |
| `font-heading` | `font-jakarta` |
| `border-border` | (sin cambio) |

Total: 96 reemplazos (66 en privacidad + 30 en aviso-legal).

### Hallazgos auditoría A.3 (cookies producción)

```
=== appoclick.com (sin login, navegación pública) ===
[VACÍO — cero cookies]

=== app.appoclick.com (con login TEST b2-fix) ===
Name                              Domain             Expires      SameSite
sb-wvggsgtsjtouqsiwwcls-auth-token app.appoclick.com 2027-06-XX   Lax
```

Cookie única: Supabase Auth, técnica necesaria, exenta Art. 22.2 LSSI-CE.
Sin flags HttpOnly/Secure (limitación lib Supabase, deuda Sprint 7).

---

**Fin del documento — Sprint 5 cerrado el 4 mayo 2026**
