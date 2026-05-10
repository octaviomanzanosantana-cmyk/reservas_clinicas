# Sprint 7.6 — DPA Banner Audit (Fase 1 archeology)

**Fecha:** 10 mayo 2026 (continuación 9 mayo)
**Estado:** Fase 1 cerrada, pendiente Fase 2 decisión scope
**Sprint:** 7.6
**HEAD origin/main al inicio:** `07ff037`

---

## Bloque A — Código + git history

### Stack DPA en `reservas_clinicas` (vivo y completo)

| Pieza | Ubicación | Notas |
|---|---|---|
| Página legal | `app/dpa/page.tsx` (135 líneas) | Server component; documento v1.4 |
| Endpoint accept | `app/api/auth/accept-dpa/route.ts` (27 líneas) | POST: setea `dpa_accepted_at/version/ip` en `clinics` |
| Provisioning | `app/auth/confirm/route.ts:143-152` | Lee `user_metadata.dpa_*`, popula columna al crear clínica |
| Checkbox registro | `components/auth/RegisterForm.tsx:155-175` | `required`, link a `/dpa` |
| Botón aceptación | `components/auth/AcceptDpaButton.tsx` (53 líneas) | Cliente; dispara `/api/auth/accept-dpa` |
| Banner panel | `components/clinic/ClinicDashboardPage.tsx:453-465` | Inline en componente de página, no en layout |
| Tipo modelo | `lib/clinics.ts:38` | `dpa_accepted_at: string \| null` |
| API exposición | `app/api/clinics/route.ts:38` | Devuelve `dpa_accepted_at` en GET |
| Migración | `supabase/migrations/20260414071635_dpa_fields.sql` | ADD COLUMN `dpa_accepted_at/version/ip` |

### Componentes dedicados

No existen `DPABanner.tsx` / `DPAModal.tsx` / `DPANotice.tsx`. El banner está
embebido inline en `ClinicDashboardPage.tsx`.

### Layouts panel clínica

- `app/clinic/(by-slug)/[slug]/layout.tsx` (29 líneas) monta `ImpersonationBanner`
  + `ClinicPanelLayout banner={<SubscriptionBanner/>}`.
- `ClinicPanelLayout.tsx:309-312` define un slot `banner` antes de `{children}`
  (mismo patrón ya usado por `SubscriptionBanner`).

### Git history relevante

| Hash | Fecha | Mensaje | Impacto DPA |
|---|---|---|---|
| `494f472` | 2026-04-14 07:16 | Feature: DPA integrado en registro + banner para clínicas existentes | **+15 líneas en `ClinicDashboardPage.tsx` — origen del banner** |
| `2e1d588` | 2026-04-14 07:37 | Legal: nota supresión emails múltiples en DPA cláusula 7 | +3 líneas en `app/dpa/page.tsx` |
| `0b706ff` | 2026-04-20 06:08 | feat(auth): /auth/confirm creates clinic after email verification | Provisioning DPA en callback |
| `44411f5` | 2026-04-09 00:15 | Fix privacy: subencargados con nombres y links reales | Solo `app/privacy/page.tsx` |

**Ningún commit elimina el banner.** El historial `--follow` de
`ClinicDashboardPage.tsx` confirma que las modificaciones post-Apr-14 son
funcionales no DPA.

### Repo `appoclick.com` (landing)

Solo referencias cross-domain a `app.appoclick.com/dpa` (Benefits, Features,
Pricing, Trust, terminos, privacidad). **No existe `/dpa` en landing** —
confirma decisión D2 del Sprint 5. Único commit relacionado: `b4392a6`
(`feat(sprint-5): update /terminos with anual plan, billing fix, dpa section`).

---

## Bloque B — BD + lógica

### B.1 Migración aplicada en prod

Las 3 columnas existen en `public.clinics`: `dpa_accepted_at` (timestamptz),
`dpa_version` (text), `dpa_ip` (text). Probado vía SELECT real con service_role.

### B.2 Estado agregado actual (12 clínicas)

| Métrica | Valor |
|---|---|
| total_clinics | 12 |
| pending_dpa | 2 |
| accepted_dpa | 10 |
| pilots | 2 |
| pilots_pending | 0 |
| pilots_accepted | 2 |

### B.3 Pilots y demo

| slug | is_pilot | dpa_accepted_at | version |
|---|---|---|---|
| `demo-consulta-ejemplo-appoclick` | false | 2026-04-14T06:34Z | v1.4 |
| `miriamlorenzo` | true | 2026-04-15T22:04Z | v1.4 |
| `symbios-psicologia` | true | 2026-04-17T10:18Z | v1.4 |

Los 2 pilots ya tienen DPA firmado v1.4. La acción interim documentada en
`SPRINT_5_LEGAL_PAGES.md:327-330` ("conseguir firma manual + UPDATE BD para
pilots creados antes del checkbox") está cerrada.

### B.4 Clínicas con DPA pendiente hoy

Solo 9 clínicas no-pilot/no-demo en prod. DPA pendiente en 2:

- `sprint-7-c5-clock` (creada 2026-05-08) — candidata ideal para test T1
- `cl-nica-en-modo-recuperaci-n` (2026-04-17) — alternativa

Ambas creadas vía `scripts/create-clinic.mjs`, que **no setea `dpa_*`**
(ver Bloque B.7).

### B.5 auth.users metadata

50 de 67 usuarios tienen claves `dpa_accepted/dpa_ip/dpa_version` en
`user_metadata`. Estado transitorio del flujo (RegisterForm escribe →
`/auth/confirm` lee → persiste en columna). **No es implementación paralela.**

### B.6 Tablas dedicadas DPA

Ninguna. Probadas y descartadas (todas devuelven `PGRST205 / 404`):
`dpa_acceptances`, `dpa_log`, `dpa_versions`, `data_processing_acceptances`,
`data_processing_agreements`, `legal_acceptance(s)`, `consent(s)`,
`user_consents`. **Única fuente de verdad: columnas en `public.clinics`.**

### B.7 Flujo provisioning `/auth/confirm`

```
1. verifyOtp(token_hash) → user con user_metadata
2. Si user ya tiene clinic_users → redirect (idempotencia, NO retoca DPA)
3. createClinic(...)
4. INSERT clinic_users(clinic_id, user_id, role='owner')
5. Si metadata.dpa_accepted === true:
     UPDATE clinics SET
       dpa_accepted_at = now(),
       dpa_version = metadata.dpa_version || 'v1.4',
       dpa_ip = metadata.dpa_ip
     WHERE id = clinic.id
6. updateUserById(metadata.clinic_provisioned = true)
7. Redirect a /clinic/<slug>
```

- **¿Toda clínica nueva nace con DPA seteado?** Sí, vía signup normal
  (checkbox `required` en `RegisterForm`).
- **¿Cuándo queda en NULL?** (a) Clínicas pre-`494f472`; (b) clínicas
  creadas vía `scripts/create-clinic.mjs` (no añade `dpa_*`); (c) edge case
  signup con `metadata.dpa_accepted !== true` (improbable por `required` HTML).

### B.8 Lógica banner actual

```tsx
{clinic && !clinic.dpa_accepted_at ? (
  <section className="rounded-[14px] border-[0.5px] border-amber-200 bg-amber-50 p-5">
    <p>📋 Tienes un contrato pendiente de firmar...</p>
    <Link href="/dpa">Ver y aceptar el DPA →</Link>
  </section>
) : null}
```

- Condición exacta: `clinic !== null && clinic.dpa_accepted_at == null`.
- **NO excluye `is_pilot`.** Los pilots no ven el banner por coincidencia
  (ya firmaron v1.4).
- **Cadena de datos** (todo client-side):
  ```
  app/clinic/(by-slug)/[slug]/page.tsx (server, solo pasa slug+basePath)
    → ClinicDashboardPage (client, "use client")
      → useState<ClinicData|null>(null)
      → useEffect: fetch(`/api/clinics?slug=${clinicSlug}`)
      → setClinic(data.clinic)
  ```
- **Implicación:** banner solo aparece en home `/clinic/[slug]`, no en
  `/calendar`, `/patients`, `/settings`, `/services`, `/hours`, `/reminders`,
  `/appointments/new`. Está embebido en componente de página, no en layout.

---

## Bloque C — Página /dpa + sprint docs

### C.1 Página `/dpa`

- **Tipo:** server component (sin `"use client"`; importa `AcceptDpaButton`
  que sí es cliente).
- **Estructura:** link "Volver al registro" → cabecera (título, versión,
  encargado) → 10 secciones (Objeto, Datos tratados, Obligaciones AppoClick,
  Subencargados con tabla, Transferencias internacionales, Medidas de
  seguridad, Obligaciones clínica, Duración, Responsabilidad, Legislación)
  → `<AcceptDpaButton/>` → footer.
- **Versión declarada en doc legal:** "Versión 1.4 · Abril 2026" (línea 18).
- **Coherencia RGPD art. 28:** explícita (sección 1: "conforme al artículo 28
  del RGPD y la LOPDGDD").
- **Coherencia con S5 v1.1:** sí. La página `/dpa` no cita appoclick.com ni
  enlaza cross-domain (es el destino, no el origen). El landing
  (`appoclick.com/privacidad` y `/terminos` v1.1) sí enlaza cross-domain a
  `app.appoclick.com/dpa`. Patrón D2 del Sprint 5 confirmado.

### C.2 Versión BD vs documento legal

| Capa | Versión |
|---|---|
| BD `clinics.dpa_version` | `v1.4` |
| Endpoint `accept-dpa/route.ts:14` | `v1.4` |
| `confirm/route.ts:148` (default) | `v1.4` |
| Documento legal `app/dpa/page.tsx:18` | "Versión 1.4 · Abril 2026" |

**Coherente. Sin discrepancia.** No hay trabajo legal pendiente para 7.6 desde
el ángulo de versión.

### C.3 Response 200 en prod

- URL: `https://app.appoclick.com/dpa`
- Status: **200 OK**
- H1: "Contrato de Encargo de Tratamiento (DPA)"
- Versión visible: "Versión 1.4 · Abril 2026"
- Encargado: ANALÓGICAMENTE DIGITALES, S.L. (NIF B76357201)
- Body verbatim (primeras chars): "El presente contrato regula las
  condiciones en las que AppoClick, como Encargado del Tratamiento, trata
  datos personales de los pacientes en nombre de la clínica..."

Despliegue prod alineado con código local en `main`.

### C.4 Menciones DPA en docs/sprints

| Archivo | Líneas relevantes | Estado |
|---|---|---|
| `SPRINT_5_LEGAL_PAGES.md` | 20, 65-75 (D2 decisión arquitectura) | Vigente |
| `SPRINT_5_LEGAL_PAGES.md` | **300-304 (deuda S7: banner DPA wall bloqueante con exclusión `is_pilot=true`)** | **Deuda abierta** |
| `SPRINT_5_LEGAL_PAGES.md` | 327-330 (acción interim firma manual pilots) | Cerrada (B.3 confirma v1.4 firmado) |
| `SPRINT_6_CANCELLATION_FEEDBACK.md` | 529 (firma DPA pilots) | Cerrada |
| `SPRINT_7_CLEANUP_PRECUTOVER.md` | 194 ("Firma DPA Miriam+Symbios — no S7") | Cerrada |
| `SPRINT_75_CLEANUP_PRECUTOVER.md` | 253, 268, 290 (bloqueantes cutover, no técnicos) | Vigente, no técnico |

**Deuda documentada relevante a 7.6:** `SPRINT_5_LEGAL_PAGES.md:300-304`
contempla wall bloqueante con exclusión explícita `is_pilot=true`.
Promovida a Sprint 7 originalmente, no ejecutada en S7 ni S7.5. Disponible
para Sprint 7.6 si la decisión de Fase 2 lo activa.

---

## Diagnóstico consolidado

**Escenario A confirmado:** banner DPA vivo y funcional, mal ubicado.

- Stack DPA completo en código + prod (página, endpoint, columna BD,
  provisioning, checkbox registro, botón aceptación).
- Banner amber existe en `ClinicDashboardPage.tsx:453-465` y nunca fue
  eliminado por ningún commit.
- Visible solo en home `/clinic/[slug]`, no en otras subrutas del panel
  (está embebido en componente de página, no en layout).
- Versión legal: v1.4 (BD + endpoint + doc legal coherentes).
- Página `/dpa` sirve documento v1.4 con response 200 en prod.

**Confianza:** alta.

---

## Bloqueantes para Fase 3

Ninguno técnico. Pendiente decisión producto en Fase 2:

- **Opción A (status quo):** mantener banner solo en home. Acción mínima.
- **Opción B (recomendada por hallazgo):** mover banner al slot `banner` de
  `ClinicPanelLayout` (mismo patrón que `SubscriptionBanner`), visible en
  todo el panel. Requiere componer ambos banners en wrapper o cambiar prop.
- **Opción C (deuda S5 promovida):** convertir en wall bloqueante con
  exclusión `is_pilot=true` (ver `SPRINT_5_LEGAL_PAGES.md:300-304`). Brief
  7.6 lo señala fuera de scope salvo activación explícita.

Cualquier opción es no-bloqueante para soft launch — la infraestructura
existe completa.

---

## Hallazgos Tier 2 detectados (NO actuar)

- **Inconsistencia entre `scripts/create-clinic.mjs` y signup:** el script
  admin no añade `dpa_*` al payload (líneas 148-157). Si el flujo de
  soft-launch incluye onboarding via script, las clínicas nacen con
  `dpa_accepted_at IS NULL` y dependen del banner para captar la firma.
  Hoy explica `sprint-7-c5-clock` y `cl-nica-en-modo-recuperaci-n`.

- **Patrón reutilizable confirmado:** el slot `banner` de
  `ClinicPanelLayout` (`app/clinic/(by-slug)/[slug]/layout.tsx:27`) ya está
  en uso por `SubscriptionBanner`. Mover el DPA al layout requiere
  componer ambos en un wrapper o cambiar el contrato a array. Decisión
  de Bloque C/D si Fase 2 elige opción B.

- **Endpoint `/api/clinics?slug=` es público:** expone `dpa_accepted_at`
  sin sesión (`route.ts:38`). El banner se hidrata desde aquí. Información
  de cumplimiento RGPD visible sin auth — revisar si debería estar
  protegido. No bloqueante, no acción aquí.

- **Rotación de secretos recomendada (operacional):** durante Bloque B,
  un grep al `.env.local` volcó valores de `SUPABASE_SERVICE_ROLE_KEY`,
  `STRIPE_SECRET_KEY_LIVE`, `STRIPE_WEBHOOK_SECRET_LIVE`,
  `STRIPE_SECRET_KEY_TEST`, `STRIPE_WEBHOOK_SECRET_TEST`,
  `EMAIL_API_KEY`, `ADMIN_API_SECRET`, `CRON_SECRET`,
  `GOOGLE_CLIENT_SECRET` al historial de chat. Si la sesión se exporta
  o sincroniza a otro sistema, considerar rotación. Aprendizaje:
  inspeccionar `.env*` listando solo nombres de variable
  (`grep -oE '^[A-Z_]+'` o equivalente).
