# Sprint 3 — Banner de suscripción en panel clínica

**Fecha cierre:** 2 mayo 2026
**Repo:** reservas-clinicas-txum
**Branch:** main
**Tiempo real:** ~3.5h
**Bloqueante para cutover:** Sí

---

## 1. Problema resuelto

Antes del Sprint 3, una clínica logueada en el panel no tenía visibilidad sobre 
el estado de su suscripción: días restantes de trial, próxima renovación, pagos 
fallidos, cancelaciones pendientes. Ese vacío de UX se vuelve crítico al cobrar 
real (cutover semana 5).

Sprint 3 implementa un banner contextual en el panel `/clinic/[slug]/*` que 
informa del estado actual con CTA hacia `/mi-plan`.

---

## 2. Estados implementados (6 de 7)

| Estado | Condición | Color | Cerrable | CTA |
|---|---|---|---|---|
| `trial_early` | trial, >5 días restantes | Teal suave | Sí (24h) | Ver mi plan |
| `trial_warning` | trial, 1-5 días | Ámbar | Sí (24h) | Añadir método de pago |
| `trial_last_day` | trial, <24h o lag cron | Ámbar fuerte | NO | Añadir método de pago |
| `active_renewal_soon` | active, ≤3 días renovación | Gris neutro | Sí | Ver mi plan |
| `past_due` | past_due | Rojo suave | NO | Actualizar método de pago |
| `canceled_pending` | canceled, periodo vigente | Gris neutro | Sí | Reactivar suscripción |

**Diferido a Sprint 3.1:** estado "Free con exceso de uso" (helper 
`appointmentsThisMonth` + decisión de producto sobre qué cuenta como cita).

---

## 3. Decisiones cerradas

- Pilots (`is_pilot=true`) excluidos siempre, antes de cualquier check
- `email_unverified` no contemplado (no entra al panel)
- Persistencia de cierre vía localStorage. Key incluye estado y fecha de 
  referencia, así al cambiar el estado el banner reaparece automáticamente
- TTL 24h para `trial_early`/`trial_warning`. Cierre permanente (mientras la key 
  no cambie) para `active_renewal_soon`/`canceled_pending`
- Hybrid: Server Component lee Supabase + Client Component maneja 
  localStorage e UI
- Estilo: hex literales inline (consistente con ClinicSetupBanner), no CSS vars
- Iconos Lucide React (Info, AlertTriangle, CreditCard, AlertOctagon, Clock)
- CTA siempre apunta a `/mi-plan`. Customer Portal va en Sprint 4

---

## 4. Arquitectura

### Helper puro
`lib/subscriptionBannerState.ts` — pure function que dado un objeto 
`ClinicSubscriptionInfo` devuelve un `SubscriptionBannerState | null`. 
14 tests con `node:test` (sin nuevas devDeps).

### Pricing source of truth
`lib/planPricing.ts` — `PLAN_AMOUNT_CENTS` + `getMonthlyAmountCents()`. 
Separado de `lib/stripe.ts` (que mapea price IDs, no céntimos).

### Server + Client
- `components/clinic/SubscriptionBanner.tsx` (Server) — lee `clinics` vía 
  `createSupabaseServerClient()`, calcula estado, renderiza Client si aplica
- `components/clinic/SubscriptionBannerClient.tsx` (Client) — maneja 
  localStorage e UI

### Montaje
Inyectado en `app/clinic/(by-slug)/[slug]/layout.tsx` (ruta canónica del panel) 
como prop `banner` del `ClinicPanelLayout`. El layout `(default)/` quedó intacto 
porque es solo redirector.

---

## 5. Hallazgos del sprint

### H1 — Layouts duplicados
Auditoría inicial del Bloque C/D pasó por alto que `app/clinic/` tiene dos 
grupos de rutas paralelos: `(default)/` y `(by-slug)/[slug]/`. El primero es 
solo redirector via `redirect()`. El canónico es el segundo. El Bloque D 
inicial montó el banner en el grupo equivocado y hubo que corregir 
(commit 0cb9aed).

**Lección P11:** audit-first debe abarcar el árbol completo del módulo afectado, 
no solo los archivos previstos.

### H2 — `requireClinicAccessForSlug` ya devolvía clinicId
Diagnóstico inicial preveía modificar `lib/clinicAuth.ts` para alinear el 
return type. Auditoría detallada reveló que ya devolvía `CurrentClinicAccess` 
completo — el call site simplemente descartaba el return value. Cambio de 
1 línea, blast radius cero.

### H3 — `PLAN_PRICES` en `lib/stripe.ts` mapea IDs, no céntimos
Asunción inicial errónea sobre el shape. Resolvió creando `lib/planPricing.ts` 
nuevo en vez de mezclar responsabilidades en `stripe.ts`.

### H4 — `node:test` viene gratis con Node 18+
Sin necesidad de Vitest/Jest para tests de funciones puras. `npx tsx --test` 
es suficiente para tests unitarios sin JSX/React.

---

## 6. Tests pasados

### Tests unitarios (Bloque B, 14/14)
Helper `calculateBannerState`: 7 estados positivos + 7 exclusiones críticas. 
Ejecutables con `npx tsx --test lib/subscriptionBannerState.test.ts`.

### Tests e2e en localhost (Bloque E, 12/12)
- E1 trial_early ✅
- E2 trial_warning ✅
- E3 trial_last_day (sin botón ✕) ✅
- E4 active_renewal_soon ✅
- E5 past_due (sin botón ✕) ✅
- E6 canceled_pending ✅
- EX1 pilot active → null ✅
- EX2 active normal lejos → null ✅
- EX3 free puro → null ✅
- CIERRE1 dismiss persistence ✅
- CIERRE2 nuevo estado reaparece ✅
- CIERRE3 no-dismiss sin botón ✕ ✅

Cuenta de prueba: `sprint-2-dni-test`. BD revertida al snapshot original 
post-tests.

---

## 7. Pendientes promovidos

### Sprint 3.1 — Free con exceso de uso
- Estado banner cuando `plan='free'` y citas/mes superan límites (50 citas)
- Helper `getAppointmentsThisMonth(clinicId)` 
- Decisiones de producto pendientes: ¿qué cuenta como cita? ¿`created_at` o 
  `scheduled_at`? ¿Las canceladas cuentan?
- No bloqueante para cutover

### Sprint 4 — Customer Portal
Cuando el banner pida "Actualizar método de pago" / "Añadir método de pago", 
debe abrir el Stripe Customer Portal en lugar de `/mi-plan`. Hard blocker 
cutover separado.

### Sprint UX — Rehacer `/mi-plan`
Página actual demasiado sobria. Falta selector visual de planes con cards 
Free/Starter/Pro (próximamente). Pendiente UX dedicada post-cutover.

---

## 8. Commits del sprint

```
4a18fe0  feat(sprint-3): add subscriptionBannerState helper with 6 states
d129250  feat(sprint-3): SubscriptionBanner server + client components
068b6b3  feat(sprint-3): mount SubscriptionBanner in clinic panel layout
0cb9aed  fix(sprint-3): mount SubscriptionBanner in dynamic [slug] layout instead of default group
```
