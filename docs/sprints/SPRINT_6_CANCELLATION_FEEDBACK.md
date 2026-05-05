# Sprint 6 — Cancelación con feedback

**Fecha:** 5 mayo 2026
**Repo afectado:** `reservas-clinicas-txum`
**Autor:** Octavio Manzano + Claude
**Estado:** ✅ Cerrado

---

## Resumen ejecutivo

Sprint 6 entrega el flujo completo de cancelación de suscripción
self-service con captura de feedback motivado. Desde `/mi-plan` el
cliente abre un modal con cinco razones predefinidas, confirma, y la
suscripción Stripe queda marcada `cancel_at_period_end=true`. El
periodo activo se mantiene hasta `plan_expires_at`; al vencer, el
webhook `customer.subscription.deleted` baja la clínica a Free
(reusando el email #13 ya existente del Sprint Comercial Fase 1).

El sprint amplió scope deliberadamente para incluir el botón de
**reactivación** simétrico — sin él, la promesa del email #13
(`"reactivar la suscripción sin fricción"`) quedaba descubierta. La
reactivación llama a `subscriptions.update(cancel_at_period_end:false)`
y el webhook `customer.subscription.updated` se encarga de devolver
la BD a `subscription_status='active'`.

Tiempo invertido: ~5 h auditoría + implementación B0-B7, +1 h
hotfix Supabase legacy keys, +30 min smoke e2e, +30 min doc cierre.

Bug crítico descubierto durante el smoke test (Supabase deprecó las
legacy `service_role` JWT keys, degradándolas silenciosamente a rol
authenticated/anon en INSERTs específicos) resuelto vía rotación a
las nuevas `sb_secret_*` keys en Vercel. No requirió cambios de
código.

---

## Hashes encadenados

| Bloque | Hash | Mensaje |
|---|---|---|
| B1 | `ad2934a` | feat(billing): add cancel reasons types and labels |
| B2 | `9488f22` | feat(emails): add cancellation requested email |
| B3 | `bc045b5` | feat(billing): add cancel subscription endpoint |
| B4 | `5f0fc65` | feat(billing): add reactivate subscription endpoint |
| B5 | `8491095` | feat(billing): add CancelSubscriptionModal component |
| B6 | `298e4bd` | feat(mi-plan): add cancel and reactivate subscription actions |
| B7 | `410a4ac` | fix(webhook): handle cancel_at_period_end on trial and reset canceled_at on reactivation |

Hotfix B7.1 (rotación key Supabase en Vercel): sin commit, cambio de
env var.

---

## Alcance del sprint

| Item | Brief original | Implementado | Notas |
|---|---|---|---|
| Modal cancelación 5 razones | Sí | Sí | matriz v1.1 §6.4 |
| Endpoint `/api/billing/cancel` | Sí | Sí | con idempotencia |
| Email #12 (cancelación recibida) | Sí | Sí | descubierto faltaba |
| Email #13 (downgrade Free) | Reutilizar | Reutilizar sin tocar | ya existía |
| Tabla `subscription_cancellations` | Reutilizar | Reutilizar + `plan_at_cancel` | columna extra documentada en migration |
| Botón "Reactivar suscripción" | **Ampliación** | Sí | acordado tras A.2 |
| Endpoint `/api/billing/reactivate` | **Ampliación** | Sí | sin email, sin INSERT |
| Fix webhook trialing+cancel | **Ampliación** | Sí | bug latente descubierto en B0 |
| Reset `canceled_at` en reactivación | **Ampliación** | Sí | semántica BD limpia |

Tres ampliaciones deliberadas, todas justificadas en su decisión D
correspondiente.

---

## Decisiones clave

### D1 — Cancelación solo `cancel_at_period_end`, no inmediato ni con reembolso

Stripe permite tres modalidades: cancelación inmediata
(`subscriptions.cancel`), cancelación al final del periodo
(`subscriptions.update(cancel_at_period_end:true)`) y cancelación con
reembolso prorrateado. Decisión: **solo la segunda**. Razones:

- El cliente paga por adelantado mensual o anual; tiene derecho a
  consumir lo pagado.
- Reembolsos manuales fuera de Sprint 6 — ya existe canal vía
  `hola@appoclick.com` (Sprint 8) si caso excepcional.
- Cancelación inmediata habilita ambigüedades sobre datos y citas
  pendientes que no queremos abordar aún.

### D2 — Email #12 NO menciona el motivo de cancelación

`reason` y `reason_detail` son **feedback interno**. Devolverlos al
cliente en el email convierte el feedback en transcripción literal y
puede sentirse como reproche ("Has cancelado por: precio"). El email
#12 confirma fecha de fin de acceso y promete reactivación sin
fricción — nada más.

### D3 — Reactivación NO envía email

Toast verde inmediato + UI cambia visiblemente (badge "Suscripción
cancelada" desaparece, botón Reactivar se sustituye por estado
"activo"). Un email adicional sería ruido. Decisión cerrada en A.2 y
ratificada en B4.

### D4 — `requireCurrentClinicForApi` only, sin `assertCurrentClinicAccessForApi`

Los endpoints `cancel` y `reactivate` operan sobre la clínica del
usuario autenticado — ni el body ni la URL llevan `clinic_id`. La
sesión determina la clínica. `assertCurrentClinicAccessForApi`
(disponible en `lib/clinicAuth.ts:187`) aplicaría solo si el endpoint
recibiera el ID por parámetro. Verificado en B0.

### D5 — Tipo `CancelReason` centralizado en `lib/billing/cancelReasons.ts`

Fuente única de verdad: tipo, array de labels en castellano y type
guard `isValidCancelReason`. Lo importan modal (B5) y endpoint
cancel (B3). El comentario del archivo referencia explícitamente el
CHECK constraint en BD para forzar sincronización si se modifica.

### D6 — Ubicación `<SubscriptionActions />` dentro del card "Estado del plan"

No en un card separado de "Acciones". Razón: las acciones pertenecen
**al estado**, no al método de pago (que vive en otro card más abajo
con `PaymentMethodSection`). Margin-top `mt-5` para separación visual
del texto descriptivo del status.

### D7 — Botón "Cancelar" como trigger ghost suave, "Confirmar cancelación" como destructivo fuerte

Jerarquía de la acción destructiva:
- **Trigger** (en `/mi-plan`): `border-red-200 bg-white text-red-600
  hover:border-red-300 hover:bg-red-50` — abre el modal, no cancela.
- **Confirm** (dentro del modal): `bg-red-600 hover:bg-red-700` con
  texto blanco — efectivamente cancela.

Replicar `bg-red-600` en el trigger sería gritar al usuario sin que
hubiera tomado todavía la decisión.

### D8 — Prefijo `fix:` en B7 (no `feat:`)

Aunque añade comportamiento (cobertura del estado `trialing` y reset
de `canceled_at`), conceptualmente B7 corrige un **bug latente**
descubierto en B0: el flujo Sprint 6 hubiera entregado UI rota para
clientes que cancelaran durante el trial (botón Reactivar nunca
aparecía). Coherente con el espíritu de los conventional commits.

---

## Hallazgos que ampliaron scope post-A.2

1. **Email #12 NO existía** pese a check verde en matriz v1.1 §5.1.
   Grep negativo en `lib/billingEmails.ts`. Creado en B2.
2. **Tabla `subscription_cancellations` tiene columna extra
   `plan_at_cancel`** no documentada en matriz §7.2. Detectado en
   A.1 leyendo la migration `20260422170641_sprint_comercial_fase_1.sql`.
   Decisión: usarla con snapshot de `clinic.plan` en el INSERT del
   endpoint cancel (B3) — analítica retrospectiva sin coste.
3. **Webhook handler L173-176 NO cubría `trialing`+`cancel_at_period_end`**.
   Descubierto en B0 reproduciendo mentalmente el flujo. Cambio
   integrado en B7.

---

## Implementación por bloque

### B0 — Verificaciones pre-implementación (sin commit)

Tres verificaciones críticas antes de tocar código:

- **Handler trialing+cancel_at_period_end:** `mapStripeStatus("trialing")`
  retorna `"trial"`. La condición original
  `cancel_at_period_end && newStatus === "active"` excluía el caso
  trial. Confirmado leyendo [route.ts:23-27](app/api/stripe/webhook/route.ts#L23-L27)
  y la lógica del effectiveStatus. Acción: ampliación en B7.
- **`assertCurrentClinicAccessForApi`:** existe en
  [lib/clinicAuth.ts:187-204](lib/clinicAuth.ts#L187-L204). No
  necesaria para Sprint 6 — los endpoints no reciben `clinic_id` por
  parámetro.
- **`getClinicSummary`:** función local en
  [app/mi-plan/page.tsx:19-28](app/mi-plan/page.tsx#L19-L28), no helper
  compartido. Acción: añadir `canceled_at` al type y al SELECT
  en B6.

### B1 — Tipos cancelación

**Commit:** `ad2934a`
**Archivo:** `lib/billing/cancelReasons.ts` (39 líneas, nuevo).

- `type CancelReason = "price" | "not_using" | "alternative" | "business_change" | "other"`.
- `CANCEL_REASONS: CancelReasonOption[]` con labels castellano:
  Precio · No lo uso · Encontré una alternativa · Cambio en mi
  negocio · Otro motivo.
- `isValidCancelReason(value: unknown): value is CancelReason` —
  type guard para validación de body en endpoints.
- Comentario referencia el CHECK constraint BD para forzar
  sincronización si se modifica.

### B2 — Email #12 `sendCancellationRequestedEmail`

**Commit:** `9488f22`
**Archivo:** `lib/billingEmails.ts` (+69 líneas, función
[L294-364](lib/billingEmails.ts#L294-L364)).

- Subject: `"Cancelación recibida — sigues activo hasta el ${endDate}"`.
- Body con dos fechas: `endDateFormatted` (fin de acceso) y
  `endDateNextDayFormatted` (primer día en Free, calculado con +24h
  ms).
- Reusa `formatDateES` existente en el mismo archivo (locale `es-ES`,
  timezone `Europe/Madrid`).
- Reusa constante `MI_PLAN_URL` ya definida.
- CTA "Volver a mi plan" vía `buildCtaButton` apuntando a
  `${APP_URL}/mi-plan`.
- Decisión consistencia: sin firma "— Equipo Appoclick" inline (lo
  gestiona `wrapEmailHtml`); `endsAt: string` ISO no `Date` (patrón
  de las cuatro funciones existentes en el archivo).

Render dummy con `endsAt='2026-05-11T00:00:00.000Z'`:
- Subject: `Cancelación recibida — sigues activo hasta el 11 de mayo de 2026`
- Body: `Tu suscripción Starter sigue activa hasta el **11 de mayo
  de 2026**. (...) A partir del **12 de mayo de 2026** pasarás al plan Free.`

### B3 — Endpoint `/api/billing/cancel`

**Commit:** `bc045b5`
**Archivo:** `app/api/billing/cancel/route.ts` (261 líneas, nuevo).

- POST autenticado vía `requireCurrentClinicForApi` (compatible con
  impersonación admin).
- Validación body: `isValidCancelReason(reason)` + trim
  `reason_detail` + check obligatorio si `reason==='other'` + length
  ≤ 1000.
- Guards de negocio: `is_pilot===false` (403), `stripe_subscription_id
  NOT NULL` (400), `subscription_status IN ('active','trial')` (400).
- **Idempotencia:** `stripe.subscriptions.retrieve` antes de update;
  si `cancel_at_period_end===true` devuelve 200 con
  `already_canceled:true` sin reinsertar feedback ni reenviar email.
- `stripe.subscriptions.update(id, {cancel_at_period_end:true})`.
- INSERT en `subscription_cancellations` con
  `plan_at_cancel = clinic.plan` (snapshot). Non-fatal si falla — la
  fila es analítica, Stripe es la fuente de verdad.
- Email #12 con email del owner resuelto vía `clinic_users` →
  `auth.admin.getUserById` (mismo patrón que
  [setup-checkout/route.ts:146-158](app/api/billing/setup-checkout/route.ts#L146-L158)).
  Try/catch interno, non-fatal.
- `endsAt` desde `updated.items.data[0].current_period_end` o
  `updated.trial_end` si vigente. API `2026-03-25.dahlia` mueve
  `current_period_end` al item, no al subscription top-level.
- Error handling alineado con `portal/route.ts`: `ClinicAccessError`
  con su status, resto 500 con mensaje genérico al cliente y
  `console.error` con prefijo `[api/billing/cancel]`.

### B4 — Endpoint `/api/billing/reactivate`

**Commit:** `5f0fc65`
**Archivo:** `app/api/billing/reactivate/route.ts` (150 líneas, nuevo).

- POST sin body; opera sobre la clínica de la sesión.
- Guards: `is_pilot===false` (403), `stripe_subscription_id NOT
  NULL` (400), `subscription_status==='canceled'` (400),
  `plan_expires_at > NOW()` (400 con mensaje específico orientando
  a re-suscripción si ya expirado).
- Idempotencia: si `cancel_at_period_end===false` ya, devuelve 200
  con `already_active:true` sin llamar update.
- `stripe.subscriptions.update(id, {cancel_at_period_end:false})`.
- **NO toca BD** — el webhook `customer.subscription.updated` se
  encarga (ahora reset incluido por B7).
- **NO envía email** (D3).
- Devuelve `plan_expires_at` actualizado para que la UI refresque
  con la fecha real de Stripe.

### B5 — Componente `CancelSubscriptionModal`

**Commit:** `8491095`
**Archivo:** `components/billing/CancelSubscriptionModal.tsx` (245
líneas, nuevo, client component).

- Estado local: `reason`, `reasonDetail`, `loading`. Reset al abrir
  vía `useEffect` sobre `open`.
- Radios nativos `<input type="radio">` envueltos en `<label>` con
  estados visuales selected/hover/disabled. Brand color `primary`
  (teal) para selección.
- Textarea condicional cuando `reason==='other'` con `maxLength=1000`
  + `slice(REASON_DETAIL_MAX)` defensivo en onChange + contador
  `${length}/1000`.
- `<fieldset disabled={loading}>` bloqueo nativo de los radios
  durante request.
- Backdrop click + Escape **ignorados durante loading**. "Me lo
  pienso" siempre activo (decisión consciente: el usuario puede
  cambiar de idea durante los 2 segundos del request; bloquearle el
  escape se siente abusivo — el toast llegará igualmente cuando
  termine).
- Botón "Confirmar cancelación" rojo destructivo `bg-red-600
  hover:bg-red-700 rounded-[10px]` (no `rounded-xl` como
  `ConfirmModal` — coherencia con el sistema visual de billing).
- Toast diferenciado: `success` para nueva cancelación, `info` para
  `already_canceled`, `error` para fallo.

### B6 — Integración en `/mi-plan`

**Commit:** `298e4bd`

**Archivos:**
- `app/mi-plan/page.tsx` modificado (+25 / -4 líneas):
  - `+canceled_at: string | null` en `ClinicSummary` type.
  - `+canceled_at` en SELECT de `getClinicSummary`.
  - Bloque `subscription_status === "canceled"` mejorado: muestra
    fecha exacta `formatDateES(plan_expires_at)` resaltada en
    `font-semibold text-foreground`, fallback al texto antiguo si
    `plan_expires_at` es null.
  - Render `<SubscriptionActions />` al final del card "Estado del
    plan", con todas las props derivadas del clinic.
- `components/billing/SubscriptionActions.tsx` creado (~125 líneas,
  client component):
  - Guards condicionales: `isPilot` → null;
    `!stripeSubscriptionId` → null.
  - `showCancel` si status IN (`active`, `trial`).
  - `showReactivate` si status `canceled` AND
    `plan_expires_at > NOW()` (defensa-en-profundidad client-side).
  - `handleReactivate` con `fetch` + `toast` + `router.refresh()`.
  - Modal renderizado solo si `showCancel` (optimización).
  - `canceledAt` prop reservado con `void _canceledAt` — semántica
    para futura UI tipo "cancelada el X" sin necesidad de re-firmar
    props después.

**Bundle:** `/mi-plan` 3.58 kB → 5.26 kB (+1.68 kB), First Load JS
118 kB → 120 kB (+2 kB). Dentro del rango previsto en la spec.

### B7 — Webhook fix

**Commit:** `410a4ac`
**Archivo:** `app/api/stripe/webhook/route.ts` (+11 / -2 líneas en
`handleSubscriptionCreatedOrUpdated`).

**Cambio 1: detección `cancel_at_period_end` ampliada**
([L172-178](app/api/stripe/webhook/route.ts#L172-L178)):

```ts
const effectiveStatus: ClinicSubStatus =
  subscription.cancel_at_period_end &&
  (newStatus === "active" || newStatus === "trial")
    ? "canceled"
    : newStatus;
```

**Cambio 2: reset `canceled_at` en reactivación**
([L208-217](app/api/stripe/webhook/route.ts#L208-L217)):

```ts
if (effectiveStatus === "canceled" && clinic.subscription_status !== "canceled") {
  // Entrando a canceled: marcar timestamp.
  update.canceled_at = new Date().toISOString();
} else if (
  effectiveStatus !== "canceled" &&
  clinic.subscription_status === "canceled"
) {
  // Saliendo de canceled (reactivación): limpiar timestamp.
  update.canceled_at = null;
}
```

Verificación de los 4 escenarios (cancel desde active, cancel desde
trial, reactivar desde canceled, ciclo cancel-trial→reactivar)
documentada en spec B7 y validada por smoke test.

### Hotfix B7.1 — Migración Supabase Secret API key (sin commit)

**Bug raíz:** durante el smoke test, los webhooks
`customer.subscription.updated` devolvían 500 con error
`"claim failed: new row violates row-level security policy"` al
intentar el `INSERT` en `stripe_events_processed`. INSERTs manuales
desde el SQL Editor (rol `postgres`) funcionaban, las policies RLS
sobre la tabla estaban bien configuradas
(`TO service_role, ALL, true, true`), y otros endpoints de la app
no fallaban.

**Conclusión:** Supabase deprecó silenciosamente las legacy
`service_role` JWT keys, degradándolas a rol `authenticated`/`anon`
para `INSERT`s específicos. La key activa en Vercel
(`SUPABASE_SERVICE_ROLE_KEY`) era una JWT legacy rotada el 31 de
marzo, ya no respetada con privilegios de service_role por el
RLS engine.

**Acción aplicada:**

1. Supabase Dashboard → Settings → API → pestaña *"Publishable and
   secret API keys"*.
2. Copiar `Secret key default` (`sb_secret_*`).
3. Vercel → Settings → Environment Variables →
   `SUPABASE_SERVICE_ROLE_KEY`.
4. Reemplazar value JWT legacy por nueva `sb_secret_*`. Marcar
   *Sensitive*.
5. Manual redeploy del último commit `410a4ac` **sin build cache**
   (necesario para que Vercel re-lea el env var).
6. Verificación: webhooks subsiguientes procesados sin error.

**Archivo `lib/supabaseAdmin.ts` no requirió cambios** — el código
lee `process.env.SUPABASE_SERVICE_ROLE_KEY` ya y los nuevos
`sb_secret_*` keys son compatibles con `@supabase/supabase-js` sin
ajustes.

---

## Verificación e2e con outputs reales

### Estado pre-test

`clinics.b2-fix`:
- `subscription_status='active'`
- `canceled_at=NULL`
- `stripe_subscription_id='sub_1TQavkAL0qP42ZSx1yWZowqY'`
- `plan_expires_at='2026-06-05 09:41:16'`

### Flujo cancelación

- Click "Cancelar suscripción" en `/mi-plan` → modal abre con 5
  razones.
- Selección "Precio" → botón "Confirmar cancelación" enabled.
- Click confirmar → toast `"Cancelación confirmada"` + UI refresca.
- BD post-cancel:
  - `clinics.subscription_status='canceled'`
  - `clinics.canceled_at='2026-05-05 11:24:21'` (timestamp reciente)
  - `subscription_cancellations` 1 fila con `reason='price'`,
    `plan_at_cancel='starter'`, `reason_detail=NULL`
- Stripe: `cancel_at_period_end=true`, badge *"Cancela el 5 jun"*.
- Email #12 entregado a `corap56158@poisonword.com`.

### Flujo reactivación

- Click "Reactivar suscripción" → toast verde + UI vuelve a active.
- BD post-reactivate:
  - `clinics.subscription_status='active'`
  - `clinics.canceled_at=NULL` ← **validación crítica B7 ✓**
- Stripe: `cancel_at_period_end=false`.

### Webhooks procesados sin error (post-hotfix)

| Event ID | Hora | Tipo | Resultado |
|---|---|---|---|
| `evt_1TThBXAL...` | 11:30:43 | `customer.subscription.updated` (reactivar) | OK |
| `evt_1TTh5MAL...` | 11:24:20 | `customer.subscription.updated` (cancel) | OK |
| `evt_1TTh0HAL...` | 11:19:06 | `customer.subscription.updated` (reset Stripe) | OK |

---

## Tests negativos NO realizados (deuda no bloqueante)

La lógica está diseñada para soportarlos pero la verificación visual
queda pendiente. Recomendación: ejecutar el primer cliente paying
real post-cutover como smoke test natural.

| Test | Esperado | Status |
|---|---|---|
| Doble click rápido en "Cancelar suscripción" | `already_canceled=true` en 2º request | NO testado |
| Doble click rápido en "Reactivar" | `already_active=true` en 2º request | NO testado |
| Modal `Escape` key durante loading | ignorado | NO testado |
| Modal "Me lo pienso" durante loading | cierra modal, request sigue su curso | NO testado |
| Razón "Otro" sin texto | botón disabled | NO testado |
| Backdrop click | cierra modal sin acción | NO testado |
| Backdrop click durante loading | ignorado | NO testado |

---

## Hallazgos colaterales (NO Sprint 6)

### Sprint 7 — Cleanup técnico

1. **Cron `daily-lifecycle` no cubre el escenario "canceled → free"**
   como fallback de webhook fallido (matriz §6.4 lo menciona pero
   no es bloqueante post-cutover dada la idempotencia + retries de
   Stripe, y que pilots no entran en el flujo).
2. **Fila huérfana en `clinics`:** `sprint-2-dni-test` con
   `canceled_at=NULL` → `2026-05-01 08:06:16` (test residual del
   Sprint 2 e2e). Limpieza en futura tarea.
3. **`/mi-plan/page.tsx` sigue usando `requireCurrentClinicForRequest`**
   sin soporte de impersonación admin (deuda S7 conocida pre-Sprint 6).
4. **`NEXT_PUBLIC_ADMIN_API_SECRET` y `ADMIN_API_SECRET`** env vars
   inertes en Vercel desde Sprint 2.7 — pendiente eliminar.

### Pre-cutover urgente

1. **Migrar `NEXT_PUBLIC_SUPABASE_ANON_KEY` a `sb_publishable_*`** en
   Vercel para paridad con la nueva `sb_secret_*` y evitar drifts
   futuros si Supabase deprecara también las anon JWT.
2. **Verificar reintentos de los 2 webhooks fallidos**
   (`evt_1TTgNd...` 11:39:09 y 11:39:24 durante el bug RLS) — Stripe
   los reintenta automáticamente cada hora durante 3 días; deberían
   procesarse OK tras el hotfix.
3. **Documentar en runbook:** si futuras keys legacy de Supabase
   fallan con errores RLS aparentemente correctos, **sospechar
   degradación silenciosa** y migrar a las nuevas keys
   `sb_secret_*` / `sb_publishable_*`.

---

## Estado matriz v1.1 vs realidad

Gaps detectados durante Sprint 6 que requieren actualización a v1.2:

| Sección | Gap | Acción |
|---|---|---|
| §5.1 #12 | Marcado como hecho con check verde — **error**. No existía. | Creado en B2. Actualizar matriz a "Sprint 6". |
| §7.2 schema `subscription_cancellations` | Omite columna `plan_at_cancel TEXT` que sí existe en migration `20260422170641`. | Añadir a v1.2 con uso documentado. |
| §6.4 "Cancelación con feedback" | Implementación matchea spec al 100% tras Sprint 6. | Marcar como cerrado. |
| §3.1 webhook handler | No cubría `trialing+cancel_at_period_end`. Citado en B0 como bug latente. | Fix integrado en B7. Documentar nueva cobertura en v1.2. |

---

## Próximos pasos

### Inmediato (post-bloque D)

- Push del commit doc Sprint 6 a `main`.
- Actualizar memoria sesión (cierre Sprint 6 + cutover roadmap).

### Sprint 7 — Post-cutover

- Cleanup técnico (lista §"Hallazgos colaterales" arriba).
- Tests negativos cancelación (cuando llegue cliente paying real).
- Migrar `NEXT_PUBLIC_SUPABASE_ANON_KEY` a `sb_publishable_*`.
- Refactor `/mi-plan/page.tsx` a `requireCurrentClinicForApi` para
  soporte impersonación admin (deuda S7).

### Sprint 8 — Cutover Stripe LIVE

- Actualizar matriz a v1.2 con los 4 gaps detectados.
- Smoke test cancelación en LIVE post `STRIPE_MODE=live`.
- Revisión legal de los emails #12, #13, #4 por Davinia (BiPlaza).
- Buzón `hola@appoclick.com` operativo (referenciado en email #4
  footer; aún inertes los `mailto:` hasta entonces).
- Firma DPA por Miriam Lorenzo y Symbios Psicología (pilots).

---

## Reglas de oro validadas en Sprint 6

- **P10 — 1 sprint = 1 chat:** ✅ Sprint 6 cerrado en una sola
  conversación, desde A.0 hasta D.
- **P11 — Audit-first:** ✅ A.1 + A.2 + A.3 + B0 antes de tocar
  código. Sin esta disciplina no hubiéramos descubierto que email
  #12 no existía pese a la matriz, que B7 necesitaba ampliarse para
  cubrir `trialing`, ni habríamos contextualizado tan rápido el bug
  Supabase RLS durante el smoke.
- **P12 — Sin scope creep silencioso:** ✅ Tres ampliaciones (botón
  Reactivar, fix trialing, reset `canceled_at`) todas con
  justificación documentada y aprobadas explícitamente. Ninguna
  inflación inadvertida.
- **P13 — Tests críticos (`tsc` + `next build`) verdes en cada
  commit:** ✅ 7 commits, 7 builds verdes. Smoke e2e completo en TEST.
- **P14 — Pilots intocables:** ✅ Guard `is_pilot===true → null` en
  `SubscriptionActions` (B6) y guard `is_pilot===true → 403` en los
  endpoints `cancel` y `reactivate` (B3, B4). Pilots no pueden
  cancelar via UI ni via API.

---

**Sprint 6 cerrado el 5 mayo 2026.**
