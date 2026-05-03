# Sprint 4 — Customer Portal de Stripe en /mi-plan

**Fecha cierre:** 3 mayo 2026
**Repo:** reservas-clinicas-txum
**Branch:** main
**Bloqueante para cutover:** Sí

---

## 1. Problema resuelto

Antes del Sprint 4, una clínica con suscripción activa no tenía forma de
actualizar su tarjeta, descargar facturas históricas o ver su historial de
pagos sin escribir a soporte. Es un bloqueante operativo para el cutover
LIVE del 1 jun: cualquier tarjeta caducada paraliza al cliente y consume
tiempo de soporte por algo que Stripe ya gestiona out-of-the-box.

Sprint 4 integra el **Stripe Customer Portal** detrás de un botón
"Gestionar pago y facturas" en `/mi-plan`, visible solo para clínicas con
suscripción Stripe gestionable.

---

## 2. Scope entregado

| Pieza | Archivo | Tipo |
|---|---|---|
| Configuración Portal Stripe Dashboard (TEST + LIVE) | (Dashboard) | Manual |
| Endpoint sesión Customer Portal | `app/api/billing/portal/route.ts` | Server route |
| Botón "Gestionar pago y facturas" | `components/billing/PaymentMethodSection.tsx` | Client component |

No requirió cambios de schema ni en `app/mi-plan/page.tsx` (la prop
`hasSubscription` ya existía y se deriva de `stripe_subscription_id`).

---

## 3. Decisiones cerradas

- **Label del botón:** "Gestionar pago y facturas" (no "Gestionar
  suscripción"). Refleja exactamente lo que el Portal permite hacer hoy
  (cambiar tarjeta + ver/descargar facturas) y no promete capacidades
  ausentes (cancelación, cambio de plan).
- **Visibilidad:** condición única `stripe_subscription_id IS NOT NULL`.
  Excluye automáticamente pilots (siempre `NULL`) y Free puro (sin
  suscripción Stripe). No requiere prop adicional al componente.
- **Cancelación de suscripción NO incluida** en Portal. Va a Sprint 6 con
  flujo propio + recogida de feedback (cancellation reasons). Permitir
  cancelación silenciosa por Portal pierde señal de churn.
- **Cambio de plan / pausa NO incluidos** en Portal. Mismo argumento:
  necesitamos UX propia para upsell/downgrade y prorrateo controlado.
- **Información del cliente en Portal:** ON con SOLO Nombre + Teléfono
  editables. Email + dirección de facturación + ID fiscal **DESACTIVADOS**
  (más restrictivo que el brief original) para preservar la sincronización
  con `auth.users.email` (Supabase Auth) y con `tax_data` (régimen fiscal
  validado por asesoría). Si el cliente cambia su dirección o NIF, debe
  hacerlo desde `/mi-plan/datos-fiscales` para que `tax_regime` se
  recalcule. Decisión nueva del Bloque 0, no estaba en el brief inicial.
- **URLs legales (Privacy, Terms) en Portal:** VACÍAS en Sprint 4. La web
  appoclick.com no tiene `/privacidad` ni `/terminos` publicados todavía.
  Sub-tarea formal promovida a Sprint 5 (ver §7).
- **Manejo de errores en frontend:** `sonner` toast (estándar del
  proyecto, ya usado en `components/billing/FiscalDataForm.tsx`). No se
  usa `alert()` ni se introduce nuevo state inline.
- **Inconsistencia heredada `/mi-plan` ↔ endpoint:** la página
  `/mi-plan` usa `requireCurrentClinicForRequest` (no soporta
  impersonación admin). El endpoint `/api/billing/portal` sí usa
  `requireCurrentClinicForApi` (soporta impersonación). Inconsistencia
  pre-existente desde Sprint 2.6 — documentada como deuda Sprint 7,
  no se aborda aquí para evitar scope creep.

---

## 4. Configuración Stripe Dashboard

Aplicada idéntica en TEST y LIVE (Settings → Billing → Customer portal):

| Sección | Valor |
|---|---|
| Configuración portal | Predeterminada |
| Métodos de pago | ON, marcado como Default |
| Facturas / Historial de pagos | ON |
| **Cancelaciones de suscripción** | **OFF** (crítico) |
| Suscripciones — cambio de plan | OFF |
| Suscripciones — actualizar cantidad | OFF |
| Suscripciones — pausa | OFF |
| Información del cliente | ON, solo **Nombre + Teléfono** editables |
| Información del cliente — email | OFF |
| Información del cliente — dirección facturación | OFF |
| Información del cliente — ID fiscal | OFF |
| Encabezado | "Gestiona tu suscripción de Appoclick" |
| Redirect URL | `https://app.appoclick.com/mi-plan` |
| Privacy policy URL | (vacío — Sprint 5) |
| Terms of service URL | (vacío — Sprint 5) |
| Branding | Heredado de la cuenta Stripe (logo + colores) |

Configuration IDs (`bpc_...`) correspondientes:

- TEST: `bpc_1TSuJEAL0qP42ZS...`
- LIVE: `bpc_1TSuSpAL0qP42ZS...`

Nota: el endpoint `app/api/billing/portal/route.ts` no fija `configuration`
explícita en `billingPortal.sessions.create`, por lo que Stripe usa la
configuración Default de la cuenta — alineada con la decisión "Configuración
portal: Predeterminada" de arriba.

---

## 5. Arquitectura

### Endpoint
`app/api/billing/portal/route.ts` — POST sin body. Pasos:
1. `requireCurrentClinicForApi()` (auth + impersonación admin si aplica).
2. Lee `clinics.stripe_customer_id` + `stripe_subscription_id` de la
   clínica del access.
3. Valida que ambos no son `NULL` (defensa adicional sobre la condición
   de visibilidad del botón).
4. `getStripe().billingPortal.sessions.create({ customer, return_url })`.
   El cliente Stripe hereda TEST/LIVE de `STRIPE_MODE` vía `getStripe()`.
5. Devuelve `{ url }` o `{ error }`. Errores `ClinicAccessError` se
   propagan con su `status` (401/403). Resto → 500 genérico sin filtrar
   detalles internos.

### Botón
`components/billing/PaymentMethodSection.tsx` — Client component.
Añadido dentro del **Caso 1** (`hasSubscription === true`), debajo del
check "Tu suscripción está activa" + fecha próxima renovación. Usa
`useState<boolean>` local `portalSubmitting` separado del `submitting`
del Caso 3 (mutuamente excluyentes en el render, pero state aislado por
claridad). Click → `POST /api/billing/portal` →
`window.location.href = url`. Errores → `toast.error("No se pudo abrir
el portal", { description })`.

---

## 6. Tests pasados

### D0 — Estado inicial cuenta TEST `b2-fix`
- Suscripción TEST viva, `stripe_subscription_id` no nulo,
  `stripe_customer_id = cus_UPPkH4YswHwi2I`.

### D1-D8 — Flujo happy path (TEST)
- Login OK, `/mi-plan` carga, sección "Método de pago" muestra ✓
  "Tu suscripción está activa" + próxima renovación + botón
  "Gestionar pago y facturas".
- Click → redirect a Customer Portal Stripe TEST.
- Configuración visual confirma: solo Métodos de pago, Facturas,
  Información (Nombre+Tel). Sin opción cancelar, sin cambio plan.
- Tarjeta TEST `5555 5555 5555 4444` añadida y marcada como default.
- Volver a `/mi-plan` desde el botón "Volver" del Portal funciona.

### EX1 + EX2 — Pilots y Free puro NO ven botón
- Validados por análisis de código: el botón está dentro del Caso 1
  (`hasSubscription`), que se deriva de
  `Boolean(clinic.stripe_subscription_id)` en `app/mi-plan/page.tsx`.
  Pilots y Free puro tienen `stripe_subscription_id = NULL` por
  construcción → caen en Caso 2/3, nunca en Caso 1.
- E2e bloqueado por rate limit de registro Gmail consumido en
  e2e previos de Sprints 1-3. Aceptado: la condición es estructural,
  no comportamental.

### EX3 — Protocolo revert (5 pasos)
- Forzado un escenario de error (cliente sin `stripe_customer_id` válido)
  vía cambio temporal en BD para verificar el toast de error.
- Toast "No se pudo abrir el portal" con `description` correcta del
  endpoint verificado en UI.
- Restore ejecutado: `stripe_customer_id` revertido a
  `cus_UPPkH4YswHwi2I` con `SELECT` post-revert confirmando que la
  cuenta `b2-fix` quedó como antes del experimento.

---

## 7. Pendientes promovidos

### Sprint 5 — URLs legales en Portal (bloqueante para cutover)
1. Publicar `/privacidad` y `/terminos` en `appoclick.com`.
2. En Stripe Dashboard TEST + LIVE → Settings → Billing → Customer
   portal → Información de la empresa: rellenar **Privacy policy URL**
   y **Terms of service URL**.
3. Validar abriendo una sesión nueva del Portal (TEST primero) que los
   enlaces aparecen en el footer.

### Sprint 7 — Cleanup técnico
- Migrar `/mi-plan/page.tsx` de `requireCurrentClinicForRequest` a
  `requireCurrentClinicForApi` para soportar impersonación admin
  end-to-end en el flujo de billing.
- Sincronizar Stripe Customer email ↔ Supabase Auth email (webhook
  `customer.updated` o flujo propio en `/mi-plan`). Mientras el campo
  esté desactivado en el Portal, el riesgo es bajo, pero sigue siendo
  un punto de divergencia silenciosa.
- Refactorizar Caso 3 de `PaymentMethodSection.tsx` para usar `sonner`
  en lugar del `errorMessage` inline + `<div>` rojo. Alinea con el
  estándar del proyecto (`FiscalDataForm`).
- Documentar en CLAUDE.md o `/docs`: insertar usuarios `auth.users` con
  `crypt()` SQL no garantiza login funcional. Para tests programáticos
  usar `supabase.auth.admin.createUser`.

### Sprint 4.x opcional (~30 min, no bloqueante)
- Banner `past_due` redirige directamente al Customer Portal saltando
  `/mi-plan`. Reduce 1 click. Decidir según uso real post-cutover; si
  los clientes en `past_due` interactúan poco con `/mi-plan` antes de
  reaccionar, vale la pena.

---

## 8. Lecciones aprendidas

### L1 — `/mi-plan` no soporta impersonación admin
Descubierto durante Bloque D al intentar validar como admin impersonado.
Bug pre-existente de Sprint 2.6 (cuando se introdujo
`requireCurrentClinicForApi`), no del Sprint 4. La auditoría P11 del
Bloque B captó la inconsistencia entre el endpoint y la página, pero
no bloqueamos Sprint 4 por ello: el endpoint sí soporta impersonación
y la página no es un regresion. Promovido a Sprint 7.

### L2 — Crear usuarios via SQL `crypt()` ≠ login funcional
Intento de crear cuentas TEST adicionales para EX1/EX2 vía INSERT
directo en `auth.users` con `crypt(password, gen_salt('bf'))`. La fila
queda creada pero el login Supabase falla (faltan campos internos que
solo la API de Auth gestiona: identities, audit logs, etc.). Para
fixtures programáticos usar `supabase.auth.admin.createUser`.

### L3 — Bloque 0 endureció el brief original
La configuración inicial del brief permitía editar email + dirección +
ID fiscal en el Portal. Durante Bloque 0 quedó claro que cualquier
edición allí desincroniza `auth.users` y/o `tax_data` → `tax_regime`
recalculado. Decisión final más restrictiva: solo Nombre + Teléfono.
El brief debe leerse como punto de partida, no como contrato cerrado:
las decisiones operativas mandan.

---

## 9. Commits del sprint

```
870b8fe  feat(sprint-4): add billing portal endpoint
594af60  feat(sprint-4): add Gestionar pago y facturas button on /mi-plan
```
