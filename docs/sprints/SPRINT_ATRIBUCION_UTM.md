# Sprint Atribución de origen (UTM) — parte APP

**Fecha:** 3 junio 2026
**Estado:** CERRADO (tsc + build verdes, smoke e2e local OK, smoke prod OK, datos de prueba limpiados)
**Sprint:** Atribución de origen en signup — persistir UTM en `clinics` (parte APP)
**HEAD origin/main al inicio:** `ceefd10`
**HEAD post-sprint:** `af39311`
**Commits:** `1fdd21f` (B), `b0fd9c0` (C), `af39311` (D) en `main`

---

## 1. Objetivo

Persistir el canal de adquisición (UTM) en cada clínica para poder atribuir
trial→pago a canal. Sin este dato no se puede validar qué canales convierten.

Este sprint cubre **solo la parte de la app**: capturar y persistir el UTM. El
passthrough de la landing es un sprint aparte (ver §7, fuera de alcance).

---

## 2. Diseño (no usar cookies)

Los UTM se capturan en el signup y se guardan en `user_metadata` de Supabase
(vía `options.data`). En `/auth/confirm`, al crear la clínica, se releen de
`user_metadata` y se escriben en `clinics`. Así sobreviven el salto de email y
los 15 días del trial sin depender del navegador.

Cadena completa:

```
/register?utm_*  →  prop utm (server component lee searchParams)
                 →  RegisterForm body del POST  (...utm)
                 →  /api/register: extractUtm() → options.data de generateLink
                 →  raw_user_meta_data (auth.users)
                 →  /auth/confirm: relee metadata.utm_*
                 →  UPDATE aislado a clinics  (ausente → NULL)
```

**Decisión de diseño (BLOQUE 0, audit-first):** el brief asumía
`supabase.auth.signUp` en cliente, pero el flujo real **no usa** esa llamada.
El registro va server-side: `/api/register` →
`supabaseAdmin.auth.admin.generateLink({ type: "signup", options: { data } })`.
Ese `options.data` es el equivalente a `user_metadata` del brief, y es por donde
ya viajaba la metadata DPA. Los UTM se inyectan en **ese mismo objeto**.

**Persistencia (BLOQUE D):** UPDATE post-insert siguiendo el patrón ya existente
para DPA, en vez de extender `createClinic`/`ClinicRow` Pick. Razón: menor
superficie de cambio sobre el flujo de signup (recién arreglado en `5a04e19`).
El UPDATE va **aislado en try/catch**: si falla, `console.warn` con el
`clinic.id` y se continúa. Perder una atribución es molesto; perder un alta es
grave. Lo ausente se escribe **NULL** (nunca `undefined` ni `""`) para que en las
queries de CAC se distinga "vino sin ese UTM" de un dato corrupto.

---

## 3. Cambios por bloque

### BLOQUE B — Schema

- **Migración:** [supabase/migrations/20260603_add_utm_attribution_to_clinics.sql](../../supabase/migrations/20260603_add_utm_attribution_to_clinics.sql)
  añade 5 columnas a `clinics`: `utm_source`, `utm_medium`, `utm_campaign`,
  `utm_term`, `utm_content` (`text`, NULL), con `ADD COLUMN IF NOT EXISTS`.
- **Tipo:** 5 campos `utm_*: string | null` en `ClinicRow`
  ([lib/clinics.ts](../../lib/clinics.ts)).
- **Aplicación en prod:** manual vía **Supabase SQL Editor** (el CLI
  `supabase db push` está roto). Verificado post-aplicación: las 5 columnas
  existen en `public.clinics` de producción.

### BLOQUE C — Captura

- [app/register/page.tsx](../../app/register/page.tsx): server component lee
  `searchParams` (Next 15: `Promise<...>` + `await`), normaliza los 5 `utm_*`
  (toma el primer valor si llega array, `trim`, descarta vacíos) y pasa la prop
  `utm` a `<RegisterForm>`.
- [components/auth/RegisterForm.tsx](../../components/auth/RegisterForm.tsx):
  exporta `type UtmParams`, acepta prop `utm` (default `{}`) y la esparce
  (`...utm`) en el body del POST. Sin UTM → body idéntico al anterior.
- [app/api/register/route.ts](../../app/api/register/route.ts): `extractUtm()`
  sanea (solo strings, `trim`, **tope 200 chars**, omite vacíos) y añade
  `...utm` al mismo `options.data` que la metadata DPA.

### BLOQUE D — Persistencia

- [app/auth/confirm/route.ts](../../app/auth/confirm/route.ts): tipo `metadata`
  extendido con los `utm_*`; tras `createClinic`, UPDATE aislado que escribe los
  5 UTM a `clinics` (ausente → `null`), con `console.warn(clinic.id)` y **sin
  romper el alta** si falla (chequea `utmError` y try/catch).

---

## 4. Commits

| Commit | Tipo | Mensaje | Ficheros |
|---|---|---|---|
| `1fdd21f` | B | `feat(clinics): add utm attribution columns for acquisition tracking` | `lib/clinics.ts`, migración `20260603_…sql` |
| `b0fd9c0` | C | `feat(register): capture utm params into signup user_metadata` | `app/register/page.tsx`, `components/auth/RegisterForm.tsx`, `app/api/register/route.ts` |
| `af39311` | D | `feat(auth/confirm): persist utm attribution from metadata to clinics` | `app/auth/confirm/route.ts` |

Push `ceefd10..af39311` a `main` → auto-deploy Vercel a producción
(`app.appoclick.com`), Ready.

---

## 5. Tests y validación

- **`tsc --noEmit`:** verde (tras cada bloque y al cierre).
- **`next build`:** verde. `/register` queda como `ƒ` (dynamic, correcto al
  leer `searchParams`).
- **Smoke e2e local:** registro con `?utm_source=smoke&utm_medium=test`,
  confirmación del usuario vía `/auth/confirm` → fila en `clinics` con
  `utm_source='smoke'`, `utm_medium='test'`, resto NULL.
  - Incidencia de entorno: TLS local `UNABLE_TO_VERIFY_LEAF_SIGNATURE`
    (proxy corporativo intercepta TLS). Resuelto corriendo Node con
    `--use-system-ca` (confía en el almacén de certificados de Windows).
- **Smoke en producción:** registro real `google@aqia.es` (dominio no-gmail
  para esquivar el rate limit de dominio libre) → fila en `clinics` con
  **`utm_source='smoke_prod'`, `utm_medium='test'`, resto NULL**. Atribución
  validada de punta a punta.
- **Limpieza de datos de prueba** (con confirmación previa de la lista exacta,
  borrado por id, recuento por tabla):
  - Local: `smoke-utm-2` + `appoclick+utm2@gmail.com`, `clinicautm` +
    `appoclick+utm@gmail.com` (2 clínicas + 2 users).
  - Prod: `smoke-prod` + `google@aqia.es` (1 clínica + 1 user).
  - Pilotos (`miriamlorenzo`, `symbios-psicologia`, `is_pilot=true`), clínicas
    reales y test de sprints viejos (`sprint-7-c2-smoke`, etc.): **verificados
    intactos**.

---

## 6. Regla CAC (para cuando se monte la consulta)

CAC por canal = `utm_source` cruzado con `stripe_subscription_id IS NOT NULL`,
**nunca** por `subscription_status` (regla pilots: un piloto puede figurar como
`active`/`trial` sin haber pagado). La señal de pago real es la presencia de
`stripe_subscription_id`.

---

## 7. Fuera de alcance / pendiente (otros sprints)

Carpeta `appoclick-landing`:

- **Passthrough de UTM en la landing genérica** + landing
  `/medicina-integrativa` (propagar los `utm_*` del primer click hasta el link
  a `app.appoclick.com/register`).

Parte APP / analítica:

- **Vistas / consultas de CAC por canal** (dashboards, cruce con Stripe,
  GA / píxel Meta, multi-touch). Este sprint solo persiste el dato.

---

## 8. Criterio de cierre

- [x] BLOQUE 0 audit-first: diseño confirmado/ajustado contra el código real
- [x] B schema: migración + `ClinicRow`, aplicada y verificada en prod
- [x] C captura: querystring → form → body → `options.data`
- [x] D persistencia: relectura de metadata → UPDATE aislado a `clinics`
- [x] `tsc --noEmit` + `next build` verdes
- [x] Smoke e2e local OK
- [x] Smoke producción OK (atribución real validada)
- [x] Datos de prueba (local + prod) limpiados; pilotos intactos
- [x] 3 commits atómicos en `main`, desplegados a producción
- [x] Doc de cierre publicado

---

## 9. Referencias

- Migración: [supabase/migrations/20260603_add_utm_attribution_to_clinics.sql](../../supabase/migrations/20260603_add_utm_attribution_to_clinics.sql)
- Ficheros modificados:
  - [lib/clinics.ts](../../lib/clinics.ts)
  - [app/register/page.tsx](../../app/register/page.tsx)
  - [components/auth/RegisterForm.tsx](../../components/auth/RegisterForm.tsx)
  - [app/api/register/route.ts](../../app/api/register/route.ts)
  - [app/auth/confirm/route.ts](../../app/auth/confirm/route.ts)
- Sprint del que depende el flujo de signup: [SPRINT_FIX_SIGNUP_FLOW.md](SPRINT_FIX_SIGNUP_FLOW.md)
