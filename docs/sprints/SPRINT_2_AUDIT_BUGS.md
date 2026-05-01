# SPRINT 2 — Auditoría bugs latentes + verificación cron + validación fiscal

**Fecha inicio:** 30/04/2026
**Branch base:** main (e75ec93)
**Predecesor:** Sprint 1 + Sprint 1.5 cerrados
**Sucesor previsto:** Sprint 2.5 (bug edición citas calendario clínica)

---

## Propósito

Cerrar deuda detectada antes del cutover Stripe LIVE. Trabajo de calidad, NO feature. Tres categorías:

1. **Plan original Sprint 2** (planteado pre-Sprint 1): cron lifecycle audit, edición citas, email trial start
2. **Hallazgos test e2e Sprint 1** (descubiertos 30/04): 5 bugs latentes nuevos
3. **Validación fiscal pendiente** (D8 doc Sprint 1): tax_regime para autónomo DNI peninsular

---

## Scope — 6 bloques

### Bloque 0 — Confirmación cierre previo
- Bug original "Email trial empieza no se dispara" → **RESUELTO en Sprint 1 vía test e2e (30/04)**
- Email "Bienvenido a Appoclick — tu prueba de 15 días empieza ahora" se recibió correctamente
- `app/auth/confirm/route.ts:4` tenía import correcto y SÍ se invoca
- **Acción Sprint 2:** ninguna, solo documentar resolución (este bloque).

### Bloque A — Validación fiscal D8
- Auditar lógica `tax_regime` para autónomo DNI peninsular (esperado: `isp`, NO `iva_21`)
- Eliminar validación VIES bloqueante si existe (D9)
- Test e2e nuevo con DNI peninsular

### Bloque B — Bugs detectados test e2e Sprint 1
- **Bug 1:** `/mi-plan` UI no refresca tras guardar datos fiscales (banners ámbar persisten hasta F5)
- **Bug 2:** `plan_expires_at` queda en fecha fin trial tras End trial now (race condition webhooks)
- **Bug 3:** `invoices.stripe_charge_id` queda NULL tras cobro exitoso
- **Bug 4:** Email "Suscripción cancelada → Free" no se envía
- **Bug 5:** `clinics.canceled_at` queda NULL tras cancelación

### Bloque C — Auditoría cron daily-lifecycle
- Confirmar cobertura: `past_due → free` tras 3 semanas, `pending_plan_change_at` vencido, `canceled` con periodo vencido

### Bloque D — Mejora UX comprobante
- `/mi-plan` Comprobantes: traducir descripción Stripe inglesa a español

### Bloque E — Cierre y documentación
- Listar SHAs, bugs cerrados, gaps detectados que pasan a sprints futuros

---

## NO HACER en Sprint 2

- Bug edición citas calendario clínica → Sprint 2.5 dedicado
- Refactor PlanIntervalSelector → Sprint 7
- Rehacer cards Free/Starter/Pro en /mi-plan → sprint UX dedicado post-cutover
- Banner suscripción 7 estados → Sprint 3
- Customer Portal Stripe → Sprint 4
- Páginas legales /cookies/RGPD → Sprint 5
- Tocar Stripe LIVE config → Sprint 8
- Tocar landing (appoclick.com)

---

## Hallazgos auditoría (Fase 1)

_Pendiente de completar tras Fase 1._

---

## Fixes aplicados (Fases 2-3)

_Pendiente de completar tras commits._

---

## Test e2e validación (Fase 5)

_Pendiente de completar._

---

## Cierre

_Pendiente de completar al final del sprint._

## Hallazgos auditoría Bloque A (D8 + D9)

**Auditados:** `lib/taxData.ts` (computeTaxRegime), `app/api/billing/tax-data/route.ts`, `lib/viesValidator.ts`

### D8 — `tax_regime` para autónomo DNI peninsular: NO ES BUG ✅

`lib/taxData.ts:174-178` — la rama "Empresa peninsular o autónomo peninsular → ISP" cubre los tres tipos correctamente:

```ts
if (
  isES &&
  (input.tax_id_type === "cif" ||
    input.tax_id_type === "dni_autonomo" ||
    input.tax_id_type === "nie_empresarial")
) {
  return "isp";
}
```

El enum `TaxIdType` no contempla un "dni" particular — solo `dni_autonomo`. El form solo permite los 4 tipos del array `VALID_TAX_ID_TYPES` (`app/api/billing/tax-data/route.ts:27-32`). Imposible que llegue un DNI particular y que devuelva `iva_21`.

La rama `if (tax_regime === "iva_21")` en `tax-data/route.ts:89-93` es código defensivo muerto: `computeTaxRegime` jamás devuelve `iva_21` con el enum actual de tax_id_type. No hace daño, no se toca.

**Acción:** ninguna. La memoria del proyecto que listaba D8 como pendiente está obsoleta.

### D9 — VIES bloqueante: NO ES BUG ✅

`app/api/billing/tax-data/route.ts:95-104` — VIES solo se invoca para `tax_id_type === "vat_eu"` (intracomunitario UE no-ES). Si la validación falla, `vat_validated` queda en `false` pero el flujo de upsert continúa. Para CIF/dni_autonomo/nie_empresarial NO se llama a VIES.

**Acción:** ninguna. Comportamiento correcto.

### Pendiente Fase 5
Test e2e adicional con autónomo DNI peninsular real para evidencia empírica de que `tax_regime='isp'` se persiste correctamente.

---

## Hallazgos auditoría Bloque B (5 bugs webhook + UI)

**Auditados:** `app/api/stripe/webhook/route.ts` (handlers líneas 123-441), `lib/billingEmails.ts` completo.

### Bug B1 — UI `/mi-plan` no refresca tras POST tax-data: CONFIRMADO ⚠️
Causa: el handler de submit del formulario fiscal no llama `router.refresh()` ni invalida cache. Banners ámbar persisten hasta F5 forzado.
**Fix propuesto:** localizar componente cliente del form fiscal y añadir `router.refresh()` post-éxito del POST.
**Pendiente Fase 2:** localizar archivo exacto.

### Bug B2 — `plan_expires_at` queda en fecha trial tras End trial now: CONFIRMADO ⚠️
`app/api/stripe/webhook/route.ts:286-296` — `handleInvoicePaymentSucceeded` lee `invoice.period_end` (deprecado en Stripe API moderna). El campo viene vacío → guard `if (periodEnd && amount_paid > 0)` falla → `plan_expires_at` no se actualiza tras cobro real.
Síntoma confirmado: email y Stripe Dashboard muestran fecha correcta porque leen `invoice.lines.data[0].period.end` (sí poblado, ver línea 410 del mismo handler).
**Fix:** sustituir `invoice.period_end` por `invoice.lines.data[0].period.end` en líneas 286-296.

### Bug B3 — `invoices.stripe_charge_id` queda NULL: CONFIRMADO ⚠️
`app/api/stripe/webhook/route.ts:314-318` — lee `invoice.charge` directo, deprecado en API 2026-03-25.dahlia.
**Fix:** retrieve `invoice.payment_intent`, leer `latest_charge` del PaymentIntent, persistir ese ID en `invoices.stripe_charge_id`. Misma técnica que ya se usa para retrieve del price (línea 379).

### Bug B4 — Email "Suscripción cancelada → Free" no se envía: CONFIRMADO ⚠️
`lib/billingEmails.ts` solo exporta 3 funciones (`sendPaymentMethodAddedEmail`, `sendPaymentSucceededEmail`, `sendPaymentFailedEmail`). NO existe `sendSubscriptionCanceledEmail`.
`app/api/stripe/webhook/route.ts:225-258` — `handleSubscriptionDeleted` hace UPDATE pero NO invoca ningún email.
**Fix:** crear `sendSubscriptionCanceledEmail` siguiendo patrón de `sendPaymentMethodAddedEmail` (con `wrapEmailHtml` + `buildCtaButton` + `MI_PLAN_URL`). Conectar en `handleSubscriptionDeleted`.

### Bug B5 — `clinics.canceled_at` queda NULL: CONFIRMADO ⚠️ (con matiz)
`handleSubscriptionCreatedOrUpdated` líneas 175-177 SÍ escribe `canceled_at` cuando `cancel_at_period_end=true` (cancelación normal con periodo activo restante).
`handleSubscriptionDeleted` líneas 240-247 NO lo escribe (cancelación inmediata desde Stripe Dashboard, salta el flujo normal).
**Fix:** añadir `canceled_at: new Date().toISOString()` al UPDATE de `handleSubscriptionDeleted`, **solo si todavía es NULL** (no sobrescribir el `canceled_at` ya capturado por `handleSubscriptionCreatedOrUpdated`). Hace falta SELECT previo o UPDATE con condicional WHERE.

---

## Hallazgos auditoría Bloque C (cron daily-lifecycle)

**Auditado:** `app/api/cron/daily-lifecycle/route.ts` completo (418 líneas).

El cron procesa exclusivamente clínicas en `subscription_status='trial'` con `stripe_subscription_id IS NULL` y `is_pilot=false`. Tres pasos: email 5d, email 24h, downgrade trial-expired. Idempotencia vía `last_trial_email_sent`.

### Escenarios pendientes del plan original
- **`past_due → free` tras 3 semanas:** ✅ Cubierto por webhook `customer.subscription.deleted` cuando Stripe deja de reintentar. NO hace falta tocar el cron.
- **`pending_plan_change_at` vencido:** 🟡 Gap real pero NO bloquea cutover (Pro como "Próximamente" sin price IDs aún). **Promover a sprint dedicado de pre-launch Pro** o crear tarea backlog.
- **`canceled` con `current_period_end` vencido:** ✅ Cubierto por webhook `customer.subscription.deleted`. NO hace falta tocar el cron.

**Acción Sprint 2:** ninguna en código. Documentado.

---

## Hallazgos auditoría Bloque D (UX comprobante)

**Auditado:** `app/mi-plan/InvoicesSection.tsx:54-64` — función `inferPlanLabel`.

La función YA tiene fallback en español por `amount_paid` (1900 → "Starter mensual", 19000 → "Starter anual", default "Suscripción"). **El problema:** el `if` previo (líneas 58-61) cortocircuita el fallback usando `invoice.description` que viene de Stripe en inglés ("1 × Starter (at €19.00 / month)").

**Fix:** eliminar las líneas 58-61. Una línea de impacto efectivo. Sprint 7 ya tiene marcado "magic numbers en lugar de PLAN_PRICES" como deuda — ahí se hace refactor más profundo si vale la pena.

---

## Plan de fixes Fase 2-3 — 6 commits propuestos

1. `fix(billing): canceled_at en handleSubscriptionDeleted (B5)` — más simple, sin dependencias
2. `fix(billing): stripe_charge_id desde payment_intent (B3)` — aislado en una función
3. `fix(ui): comprobantes en español (D)` — 4 líneas, baja superficie
4. `fix(billing): plan_expires_at desde lines[0].period.end (B2)` — race condition
5. `feat(emails): sendSubscriptionCanceledEmail + invocación en webhook (B4)` — nuevo template + integración
6. `fix(ui): router.refresh tras POST tax-data (B1)` — depende de localización del archivo

Total estimado: 60-90 min de fixes activos.

---

## Fase 2-3 · Implementación · 6 fixes aplicados

| # | Bug | Commit |
|---|---|---|
| 1 | B5 — `canceled_at` NULL en cancelación inmediata | `82e7bc4` |
| 2 | B3 — `stripe_charge_id` NULL (1ª iter) | `0cca5f4` |
| 3 | D — comprobantes en español | `41dded2` |
| 4 | B2 — `plan_expires_at` race condition | `f6f7591` |
| 5 | B4 — email Suscripción cancelada → Free | `b377d6c` |
| 6 | B1 — UI refresh datos fiscales | `8ba5b06` |

Tras push y test e2e, B3 reabierto:

| # | Iter B3 | Commit |
|---|---|---|
| 7 | B3 — cascada extendida payments.data | `4f46a69` |
| 8 | B3 — retrieve invoice expandida (definitivo) | `546b4fe` |
| 9 | wip — diagnóstico estructura invoice | `fafe347` |
| 10 | revert wip | `c1b8ad9` |

---

## Fase 5 · Validación e2e con cuenta sprint-2-dni-test

| Bug | Validación |
|---|---|
| Bloque A (D8) | ✅ Validado en BD: `tax_regime='isp'` para DNI peninsular `12345678Z` Madrid (28). VIES no llamado, vat_validated=false. |
| B1 | ✅ Validado UI: tras submit datos fiscales, banners ámbar desaparecen sin F5 forzado. |
| B2 | ✅ Validado en BD: tras End trial → cobro €19, `plan_expires_at = 2026-05-30` (HOY+30), no fecha trial. |
| B3 | ⚠️ **PARCIAL** — código limpio en main, pero `stripe_charge_id` sigue NULL en tabla invoices. NO bloquea producción. Promovido a Sprint 2.1 — ver sección abajo. |
| B4 | ✅ Validado: email "Tu suscripción ha terminado — sigues con Free" recibido tras cancelación, copy correcto, branding correcto, CTA funcional. |
| B5 | ✅ Validado en BD: tras cancelación inmediata, `canceled_at = 2026-05-01 08:06:16`, `subscription_status='free'`, `plan='free'`, `stripe_subscription_id=NULL`. |
| D | ✅ Validado UI: `/mi-plan` sección Comprobantes muestra "Starter mensual" en español, no la cadena Stripe en inglés. |

---

## Promovido a Sprint 2.1 — Resolver `stripe_charge_id`

**Estado:** parcial cerrado en Sprint 2.

**Síntoma:** tabla `invoices` tiene `stripe_charge_id = NULL` para cobros reales aunque el charge sí existe en Stripe (verificado: `ch_3TS3KLAL0qP42ZSx05G4RSMX` para invoice `in_1TS3KKAL0qP42ZSxbfoBOMbM`).

**Lo que se intentó (3 iteraciones):**
1. Lectura directa de `invoice.charge` legacy → campo deprecado en API 2026-03-25.dahlia, viene undefined.
2. Cascada con paths anidados `invoice.payments.data[0].payment.latest_charge` desde el payload del webhook → falló porque `invoice.payments` no viene expandido por defecto.
3. Retrieve invoice con `expand: ["payments.data.payment"]` → técnicamente correcto, retrieve devuelve 200 OK, pero el path concreto `payments.data[0].payment.latest_charge` no resuelve a string ni objeto. El warn final `could not resolve charge id for paid invoice` dispara.

**Qué falta investigar:**
- Documentación oficial Stripe API `2026-03-25.dahlia` — estructura exacta de `invoice.payments` con el `expand` aplicado.
- Posiblemente el path correcto sea distinto a `.payment.latest_charge` (puede ser `.charge` directo o algún campo intermedio).

**Por qué NO bloquea producción:**
- Cobro funciona, factura se inserta correctamente con `stripe_invoice_id` poblado.
- Email "Cobro procesado" llega correctamente.
- BD se actualiza: `subscription_status`, `plan`, `plan_expires_at`.
- Datos íntegros en Stripe Dashboard, recuperables manualmente.
- Solo afecta a auditoría interna (poder rastrear charge desde nuestra BD).

**Cuándo retomar:** semana del 11-17 mayo 2026, antes del cutover Stripe LIVE (Sprint 8 / 1 junio).

**Tiempo estimado:** 60-90 min (30 min lectura doc Stripe + 30 min fix + 15 min e2e).

**Criterio de cierre Sprint 2.1:** test e2e nuevo → cobro real en TEST mode → SQL `SELECT stripe_charge_id FROM invoices` devuelve `ch_xxx` no NULL para fila del cobro.

**TODO inline:** comentario añadido en `app/api/stripe/webhook/route.ts` justo antes de la lógica de resolución de chargeId. Cualquiera que toque ese handler lo verá.

---

## Cierre Sprint 2

- **Total commits:** 10 (incluyendo revert)
- **Bugs cerrados al 100%:** 6 (Bloque A + B1 + B2 + B4 + B5 + D)
- **Bugs parciales:** 1 (B3, promovido a Sprint 2.1)
- **Working tree:** limpio
- **Push final:** pendiente tras commit del doc
- **Cron audit (Bloque C):** ningún cambio en código. Documentado: `past_due → free` y `canceled` con periodo vencido cubiertos por webhook `customer.subscription.deleted`. Gap real `pending_plan_change_at` queda como tarea futura (Pro no existe aún, no urgente).

**Sprint 2 cerrado el 1 de mayo de 2026.**
