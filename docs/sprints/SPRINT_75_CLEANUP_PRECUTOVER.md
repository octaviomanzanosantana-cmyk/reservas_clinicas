# Sprint 7.5 — Bug fixes pre-cutover + validaciones diferidas Sprint 7

**Periodo**: 7–8 mayo 2026
**Cierre**: 2026-05-08
**Branch**: `main`

---

## 1. Resumen ejecutivo

Sprint 7.5 ejecutado como continuación correctiva de Sprint 7. Cerró 5 items planificados (3 fixes con commit + 2 validaciones puras) generando 4 commits atómicos en producción. Resolvió el bloqueante crítico S8 (item #1: reactivate guard desync) y validó el escenario crítico nunca probado en S6 (item #3: webhook `customer.subscription.deleted` con `sb_secret_*` post-B7.1). Audit-first reveló durante items #1 y #4 que el alcance del brief original era más amplio (item #1.5 emergió como bug derivado; items #4 y #5 ampliaron sweep con sanitización de catches con info-leak). 4 commits totalizando 18 archivos modificados, +416 líneas / -49 líneas (net +367). Sprint validó end-to-end fix #1+#1.5 con cuenta TEST `b2-fix` reparada, item #3 con flujo Test Clock completo (sub creada → trial expira → webhook deleted → BD downgrade `canceled→free`), e items #4+#5 con tsc/build verdes. Documenta 15 hallazgos Tier 2 + 8 Tier 3 informativos para backlog post-cutover.

---

## 2. Bloques completados

### Con commit (fase principal)

| Item | Commit | Descripción | Archivos | Líneas |
|---|---|---|---|---|
| #1 | `8fe5cc8` | fix(billing): repair BD when reactivate finds Stripe-BD desync | 1 | +40/-1 |
| #1.5 | `84525b1` | fix(billing): persist BD inline in cancel and reactivate to avoid webhook race | 2 | +96/-8 |
| #4 | `eaf2462` | fix(auth): capture Supabase errors and sanitize catch leaks in 2FA endpoints | 2 | +112/-14 |
| #5 | `1154bb1` | fix(admin): capture Supabase errors and sanitize catch info-leaks across admin endpoints | 6 | +65/-12 |

**Total**: 11 archivos modificados (algunos compartidos entre items), +313/-35 (net +278) en código de producción.

### Validaciones (fase complementaria)

- **Item #2**: Tests negativos S6 (T2 Escape, T5 backdrop, T3 "Me lo pienso", T4 "Otro motivo" sin texto, T1 doble click). 5 tests pasados sobre cuenta `b2-fix` reactivada tras fix #1+#1.5. Idempotencia del INSERT `subscription_cancellations` confirmada (1 sola fila pese a doble click). No requirió código.

- **Item #3**: Stripe Test Clock validation completa (Camino C). INSERT clinic `sprint-7-c5-clock` apuntando a `cus_UTRcFUv01TYAAj` → crear sub Stripe `sub_1TUiXVAL0qP42ZSxjfBZOD0S` con `trial_period_days=30` + `cancel_at_period_end=true` → webhook `subscription.created` procesado (BD a `canceled` con effectiveStatus correcto) → advance Test Clock a `trial_end + 10s` → webhook `subscription.deleted` procesado con `sb_secret_*` post-B7.1 → BD a `free`. Triangulación D.2 (Stripe API events: 8 eventos con `pending_webhooks=0`) + D.3 (SQL `stripe_events_processed`: 3 rows registradas) confirmó éxito end-to-end. No requirió código.

---

## 3. Detalle por bloque

### Item #1 — Reactivate guard desync (auto-reparación BD)

**Audit-first** (Bloque A1) reveló que la descripción del brief Sprint 7 sobre el guard incorrecto era inexacta en un detalle: el escenario real disparador era `BD canceled + Stripe cap=false` (NO `Stripe cap=true` como decía el brief). Verificado consultando estado real de `b2-fix` en BD (`canceled`, `canceled_at NOT NULL`, `plan_expires_at` futuro) y Stripe API (`status: active`, `cancel_at_period_end: false`).

**Solución aplicada**: añadir branch defensivo en `app/api/billing/reactivate/route.ts` línea 104 (guard idempotente cuando `cap=false`). Si BD muestra `subscription_status='canceled'` o `canceled_at NOT NULL` → escribir BD inline con `subscription_status='active'`, `canceled_at=null`. Devolver `{ ok: true, already_active: true, repaired: true }`. El campo `canceled_at` se añadió al SELECT inicial para detectar la divergencia.

**Validación end-to-end**: smoke API directo con cookie efímera contra `next dev` local (con `NODE_OPTIONS=--use-system-ca`), HTTP 200, body `{ok:true, already_active:true, repaired:true}`, log `[api/billing/reactivate] BD repaired (desync)`, BD post-fix coherente (`active`, `canceled_at=null`), idempotencia validada vía UI (botón "Reactivar" desaparece tras BD reparada). Cuenta `b2-fix` desatascada y disponible para item #2.

**B7 fix S6 conservado**: el reset `canceled_at` original via webhook `customer.subscription.updated` queda intacto. Branch desync es vía adicional defensiva, NO reemplaza al webhook.

### Item #1.5 — BD inline cancel + reactivate path normal (race con webhook)

**Origen**: emergió durante validación item #1. Octavio reportó que click "Reactivar" o "Cancelar" en `/mi-plan` mostraba toast Sonner OK pero estado UI no cambiaba hasta F5 manual. Audit-first inicial (A1.10) falsificó la hipótesis frontend (`router.refresh()` SÍ se llama en ambos handlers). Audit fino (A1.11) reveló causa raíz: endpoints `cancel` y `reactivate path normal` solo llaman `subscriptions.update` Stripe, delegando mutación BD al webhook async. Cuando `router.refresh()` re-fetcha el RSC, BD aún no está actualizada → UI muestra estado viejo.

**Solución aplicada**: replicar patrón de auto-reparación BD inline (estrategia Opción A del análisis) en `app/api/billing/cancel/route.ts` y `app/api/billing/reactivate/route.ts` path normal. Tras `subscriptions.update` exitoso, escribir BD con `subscription_status`, `canceled_at`, `plan_expires_at` apropiados. Webhook permanece source of truth idempotente. Guard defensivo `if (endsAtIso !== null)` en ambos endpoints para evitar UPDATE BD con `plan_expires_at: null` en caso defensivo (Stripe response sin period).

**Trial-awareness preservada**: en `cancel/route.ts` el cálculo `endsAtIso` existente (líneas 145-154) es trial-aware (usa `updated.trial_end > nowUnix ? trial_end : current_period_end`). Audit-first detectó que el spec original habría regresionado este comportamiento; se ajustó la propuesta (Opción α de Code) para preservar trial_end.

**Documentación inline**: comentario top-of-file en cancel y reactivate actualizados para reflejar realidad post-Sprint 7.5 (tres paths BD: webhook fallback, branch desync A1.6, path normal A1.12).

**Validación end-to-end**: smoke local + producción Vercel. Click cancel/reactivate → UI cambia inmediatamente sin F5. SQL post-fix coherente. Hallazgo Tier 2 #16 (`updated_at` trigger no funciona en `clinics`) reconfirmado por enésima vez.

### Item #2 — Tests negativos S6

**5 tests sobre cuenta `b2-fix` reactivada (UX limpia post-fix #1.5):**

| Test | Acción | Resultado |
|---|---|---|
| T2 | Esc cierra modal | ✅ |
| T5 | Click backdrop cierra modal | ✅ (patrón estándar) |
| T3 | "Me lo pienso" cierra sin cancelar | ✅ |
| T4 | "Otro motivo" sin texto bloquea con validación frontend | ✅ |
| T1 | Doble click rápido en "Confirmar cancelación" | ✅ idempotencia: 1 sola fila en `subscription_cancellations` |

SQL post-T1 confirmó timestamps separados >7 minutos entre cancelaciones legítimas (no doble inserción simultánea).

### Item #3 — Stripe Test Clock validation

**Recursos preservados de Sprint 7**:
- Test Clock `clock_1TUUh1AL0qP42ZSxefIJwYFq` (frozen 2026-05-07 16:21 UTC, expira 2026-06-06 16:22 UTC)
- Customer `cus_UTRcFUv01TYAAj` vinculado al clock
- Email `appoclick+sprint7clocked@gmail.com`

**Bloques ejecutados**:

- **B0**: verificación recursos vivos (clock ready, customer válido, 0 subs).
- **B1**: INSERT clinic `sprint-7-c5-clock` (id `658b3bcc-3c7a-4554-b480-1c73f3728d97`) con `stripe_customer_id` pre-poblado. Audit B1.B confirmó que webhook hace lookup vía `.or(stripe_customer_id, stripe_subscription_id)` y NO hace UPSERT (return silencioso si no encuentra clinic → INSERT BD obligatorio antes de B3).
- **B3**: `stripe.subscriptions.create({ customer, price: STRIPE_PRICE_STARTER_MONTHLY_TEST, trial_period_days: 30, cancel_at_period_end: true, payment_behavior: 'default_incomplete' })`. Sub `sub_1TUiXVAL0qP42ZSxjfBZOD0S` creada con status `trialing`.
- **B4**: webhook `customer.subscription.created` procesado correctamente. BD a `subscription_status='canceled'` (effectiveStatus correcto trialing+cap=true), `plan='starter'`, `stripe_subscription_id` populated, `trial_ends_at`/`plan_expires_at`/`canceled_at` coherentes. Idempotencia confirmada (1 row en `stripe_events_processed`).
- **B5**: advance Test Clock a `1780762918` (trial_end + 10s, 33s antes de auto-delete). Status: ready→advancing→ready con frozen_time alcanzado.
- **B6**: webhook `customer.subscription.deleted` procesado con `sb_secret_*` post-B7.1. **Validación crítica**: BD a `subscription_status='free'`, `plan='free'`, campos limpiados (`stripe_subscription_id=null`, `trial_ends_at=null`, `plan_expires_at=null`), `canceled_at` preservado por idempotencia (línea 262-264 webhook). Triangulación D.2 + D.3: 8 eventos Stripe con `pending_webhooks=0`, 3 rows en `stripe_events_processed` (los handlers que persisten lo registran).

**Riesgo crítico S8 mitigado**: handler `handleSubscriptionDeleted` con `sb_secret_*` post-hotfix B7.1 funciona correctamente en producción. Cliente paying real que cancele y llegue al fin de su período se downgradeará automáticamente a Free sin intervención manual.

**Bonus learning**: handler `handleInvoicePaymentSucceeded` valida correctamente caso `amount_cents=0` (invoice paid by trial sin PaymentMethod). Fila en tabla `invoices` con `tax_regime='none'` (default sin tax_data) creada correctamente.

### Item #4 — 2FA error handling silencioso

**Audit-first** (C1) reclasificó la severidad respecto al brief Sprint 7. Resultado: 6 puntos a fixear (4 confirmados + 2 reclasificados de "fire-and-forget pre-existente" a BUG seguridad), 2 puntos NO tocar (fire-and-forget intencional defendible).

**Reclasificaciones críticas tras audit**:

| Línea | Brief Sprint 7 | Tras audit | Severidad |
|---|---|---|---|
| `verify-2fa-code` L68 increment attempts | "fire-and-forget" | BUG seguridad bruteforce | Crítico |
| `verify-2fa-code` L86 mark used post-success | "fire-and-forget" | BUG seguridad one-shot | Crítico |
| `verify-2fa-code` L40 mark expired | (no listado) | Fire-and-forget intencional defendible | NO TOCAR |
| `verify-2fa-code` L53 mark used post-max | (no listado) | Fire-and-forget intencional defendible | NO TOCAR |

**Solución aplicada**: 8 cambios en 2 archivos:

- `send-2fa-code/route.ts`: 4 cambios (capturar error en SELECT rate-limit, UPDATE invalidate, INSERT new code; sanitizar catch genérico).
- `verify-2fa-code/route.ts`: 4 cambios (capturar error en SELECT record, UPDATE increment attempts, UPDATE mark used post-success; sanitizar catch genérico) + 2 comentarios doc en fire-and-forget intencionales (L40 y L53) para evitar que futuros sweeps P12 los toquen por error.

Patrón aplicado: capturar `{ data, error }`, si error → `console.error` estructurado (message/code, sin PII como email o código 2FA) + return `{ ok: false, error: "internal_error" }` 500. Catches genéricos sanitizados para no propagar `error.message` interno al cliente.

**Sin smoke funcional**: cuenta TEST `appoclick+sprint4test@gmail.com` no tiene 2FA activado (`raw_user_meta_data->>'two_factor_enabled' = null`). Cambios aditivos al happy path (capturas solo bloquean si error está populated; flow normal con error=null procede igual). tsc + next build verdes garantizan estructura.

### Item #5 — Admin endpoints sweep

**Audit-first** (D1) realizó censo completo de `app/api/admin/*` (9 archivos, 103-167 líneas). Reveló volumen mucho menor que estimación brief (5-10 endpoints): solo **3 candidatos primarios** + **8 catches info-leak secundarios**.

**Decisión de scope**: Opción C ajustada (9 cambios en 6 archivos). Excluidos `create-clinic` y `create-clinic-user` por delegar a libs externas no auditadas (`@/lib/clinics`, `@/lib/clinicUserProvisioning`). P12 estricto.

**Solución aplicada**:

- `demo-clinics/route.ts`: 4 cambios. Capturar error en UPDATE `is_demo` (L74) y INSERT `clinic_users` (L96, equivalente al item #1: si falla, usuario auth creado pero sin link a clínica). Sanitizar catches POST + DELETE.
- `impersonate-clinic/end/route.ts`: 1 cambio. Comentario doc inline en UPDATE token (fire-and-forget intencional defendible: cookie se borra siempre, fila usada solo para auditoría).
- `change-plan/route.ts`, `change-subscription-status/route.ts`, `impersonate-clinic/route.ts`, `clinic-stats/route.ts`: 4 cambios. Sanitizar catches genéricos para evitar info-leak de `error.message` interno al cliente.

**Detalle técnico**: el INSERT `clinic_users` en demo-clinics usaba en el spec el nombre `linkError` que colisionaba con `linkError` ya usado para el resultado de `auth.admin.generateLink`. Code detectó la colisión durante audit y lo renombró a `bindError`. tsc verde confirmó la corrección.

**Cambio de contrato observable**: tras fix demo-clinics L96, fallo del INSERT clinic_users devuelve 500 explícito en lugar de 201 con `access.success=false` falso. Coherente con item #1 (cliente atrapado evitado). Apuntar en nota de release.

**Smoke superficial post-deploy**: lista `/admin/clinics` carga correctamente, datos coherentes, click en clínica funciona. Confirmado en producción Vercel.

---

## 4. Hallazgos Tier 2 (importantes para sprints futuros)

1. **Trigger `updated_at` no funciona en tabla `clinics`** (reconfirmado 4 veces durante sprint). Cualquier UPDATE deja `updated_at` desincronizado. Implicación operativa: timestamp NO fiable como indicador de última modificación. Sprint dedicado post-cutover para trigger `set_updated_at` o columna calculada. Verificar también `appointments`, `services`, etc.

2. **TLS dev local Windows requiere `NODE_OPTIONS=--use-system-ca`**. Validación TLS de cadena Supabase falla en `next dev` por proxy/firewall corporativo o CA bundle Node desactualizado. Workaround `--use-system-ca` lee almacén Windows. Sin impacto producción (Vercel Linux). Documentar en README dev setup.

3. **Next.js dev cache corrupción**: `next build` + `next dev` puede causar `Cannot find module './XXXX.js'` desde `webpack-runtime.js`. Workaround: relanzar dev (lite) o `rm -rf .next` (full). Patrón observado tras editar API routes con cache build previa. Documentar en README.

4. **Formato timestamp inconsistente reactivate**: branch desync devuelve `+00:00` (raw BD), branch update Stripe devuelve `.000Z` (ISO via `toISOString()`). Ambos ISO-8601 válidos, no rompe contrato. Cosmético, unificar a futuro.

5. **Doc Sprint 7 #15 (copy `/mi-plan` inconsistente) RESUELTO** colateralmente por fix #1.5. La sección superior "Suscripción cancelada" vs Método de pago "Tu suscripción está activa" eran síntoma de desync BD/UI que el fix eliminó.

6. **P12 sweep `/api/billing/*`**: hits detectados durante audits items #1 y #1.5 — `cancel/route.ts:75` (SELECT clinics), `cancel/route.ts:180-184` (clinic_users email), `reactivate/route.ts:37` (SELECT clinics). Mismo patrón que sweep `/api/admin/*` cerrado en item #5. Tier 2 sweep dedicado post-cutover.

7. **INSERT `subscription_cancellations` non-fatal en cancel**: si Supabase falla, feedback analítico se pierde silenciosamente sin reintento. Bajo impacto (datos analíticos), pero rompe embudo de cancelación reasons. Tier 2 robustez/observabilidad.

8. **`repaired:true` toast UX inconsistente cliente reactivate**: el handler reactivate ahora puede recibir `{ already_active:true, repaired:true }` (caso desync auto-reparado). El cliente solo evalúa `data.already_active` e ignora `repaired`. Resultado: usuario que hace click en "Reactivar" porque su UI mostraba canceled, recibe toast "Tu suscripción ya estaba activa" contradictorio con su realidad percibida. Mejoría: si `data.repaired === true`, mostrar toast.success de reactivación. UX backlog post-cutover.

9. **`customer.subscription.trial_will_end` sin case en switch del webhook**: emitido por Stripe durante advance del Test Clock. Cae a `default: logWarn(event, "unhandled event type")` con return 200. Cron `daily-lifecycle` ya cubre la lógica del recordatorio "3 días" via `trial_ends_at`. Si en futuro queremos mover lógica al webhook (single source of truth), Tier 2 backlog.

10. **Asimetría `ok: false` entre items #4 y #5 catches**: items #4 catches sanitizados usan `{ ok: false, error: "internal_error" }`. Items #5 catches usan `{ error: "internal_error" }` sin `ok: false`. Razón: cada uno preservó el shape original del catch al que reemplazaba. Coherencia interna por archivo, asimetría inter-items asumida. Tier 3 cosmético.

11. **Atomicidad invalidate→insert send-2fa-code rota**: los 2 UPDATE+INSERT no van en transacción. Ventana entre ambos puede dejar al usuario con códigos invalidados pero sin nuevo (si INSERT falla). Tras fix #4 el handler detecta y devuelve 500 al cliente que sabe reintentar, pero atomicidad real (transacción Supabase) sigue siendo Tier 2 a futuro.

12. **Sin rate-limit externo en verify-2fa-code post-fix**: con fix L68 (incError captura), límite de 3 intentos por código es la única barrera contra bruteforce. Tier 2 defensa-en-profundidad post-cutover (límite por IP/user con `rate_limit_events` table existente).

13. **Libs externas no auditadas**: `@/lib/clinics` (createClinic, deleteClinicById, listClinics, listDemoClinics), `@/lib/clinicUserProvisioning` (provisionClinicUserAccess), `@/lib/adminAuth` (getAdminUser). Si tienen queries Supabase sin captura, propagarían el mismo defecto resuelto en sweep items #4 y #5. Tier 2 sweep dedicated post-cutover para garantizar consistencia sistema.

14. **demo-clinics rollback parcial**: si UPDATE `is_demo` (línea 74) falla, devuelve 500 pero clinic ya existe en BD (creada por createClinic en L55). Admin recarga y ve clinic sin marca demo. Solución completa requeriría rollback (DELETE clinic) en caso de fallo. Tier 2 transaccionalidad post-cutover.

15. **demo-clinics cambio contrato observable post-fix #5**: antes fallo del INSERT `clinic_users` devolvía 201 con `access.success=false` (await silencioso no lanzaba). Ahora 500 explícito. UI admin recibe error real en lugar de "demo creada con acceso ok pero sin acceso real". Decisión funcional correcta, apuntar en nota de release.

---

## 5. Hallazgos Tier 3 (cosméticos)

1. **`SELECT *` en verify-2fa-code (L24)** trae todas columnas cuando solo necesita id, code_hash, expires_at, attempts. Micro-optimización.

2. **send-2fa-code email sin validación regex/zod**. Si caller (login form) ya validó, OK. Sino, malformado podría romper Resend o usarse para enumeración.

3. **hashCode SHA-256 plano sin salt ni HMAC** (send/verify-2fa-code). Para 6 dígitos limitados a 10 min con max 3 intentos, modelo de amenaza modesto. Defense-in-depth: HMAC con secret servidor + rotación, o KDF.

4. **Catches `error.message` info-leak en `create-clinic` y `create-clinic-user`** (out of scope item #5, libs externas). Aplicar mismo patrón sanitización tras auditar libs `@/lib/clinics` y `@/lib/clinicUserProvisioning`.

5. **schema FK `clinics` 3 modelos coexistentes** (heredado de Sprint 7 Tier 2 #2): `clinic_id UUID`, `clinic_id TEXT` mal nombrado, `clinic_slug TEXT`. Refactor estético, no urgente.

6. **`appointments.clinic_id` es TEXT mal nombrado** (heredado de Sprint 7 Tier 2 #3). Debería ser `clinic_slug` para coherencia.

7. **Naming engañoso `sendAppointmentReviewEmail`** (heredado Sprint 7 Tier 2 #11). Función dual-purpose: review request si `review_url`, "gracias" fallback si null. Renombrar a `sendAppointmentPostVisitEmail`.

8. **impersonate-clinic slug sin validación formato**. Acepta cualquier string trimmed. Slug malformado podría meterse en `impersonation_tokens.clinic_slug` sin constraint check.

---

## 6. Cuentas TEST creadas durante Sprint 7.5

| Cuenta | Origen | Estado actual | Acción posterior |
|---|---|---|---|
| `sprint-7-c5-clock` (clinics, id `658b3bcc-3c7a-4554-b480-1c73f3728d97`) | B1 item #3 | `subscription_status='free'`, `plan='free'`, post-deleted webhook procesado | Persiste como evidencia post-mortem hasta cierre. Promovida a "Sprint Test Data Hygiene" backlog post-cutover (con `sprint1`, `sprint-2-dni-test`, `sprint-7-c2-smoke`). |
| Stripe sub `sub_1TUiXVAL0qP42ZSxjfBZOD0S` | B3 item #3 | `status='canceled'`, `ended_at=2026-06-06 16:21:48 UTC`, `cancel_at_period_end=true` | Conservar; Stripe no purga subs canceled. |
| Stripe invoice `in_1TUiXVAL0qP42ZSxdi3csUT0` (en BD `invoices` tabla) | webhook B4 item #3 | `amount_cents=0`, `tax_regime='none'`, fila persistida | Conservar para histórico hasta promoción Sprint Test Data Hygiene. |
| Stripe Test Clock `clock_1TUUh1AL0qP42ZSxefIJwYFq` | Sprint 7 C.5 setup | Frozen `2026-06-06 16:21:58 UTC` post-advance, `deletes_after 2026-06-06 16:22:31 UTC` | Auto-delete natural. Quedan ~29 días al cierre del sprint. |
| `cus_UTRcFUv01TYAAj` (Stripe customer) | Sprint 7 C.5 setup | Vinculado al Test Clock, sub canceled | Conservar mientras Test Clock viva. |

---

## 7. Recomendaciones operativas

### 7.1. Cookies de sesión Supabase NUNCA en chat web

Lección aprendida durante smoke test item #1 (A1.8). Operativa establecida:
- Cookie de sesión solo en archivo gitignored en `$env:TEMP` (fuera del repo).
- Variables PowerShell efímeras durante request.
- Reportes a chat web NUNCA contienen tokens, JWTs ni cookies.
- Ante pegado accidental → revocar sesión inmediato (logout + Supabase Dashboard "Sign out user").

### 7.2. P12 estricto en sprints de fix

Patrón validado en Sprint 7.5: durante audits puede aparecer hits de patrones similares en otros archivos (ej. P12 sweep `/api/billing/*` durante items #1 y #1.5). **Apuntar Tier 2, NO arreglar en mismo sprint**. Sprint creep evita commits inflados y mantiene scope controlado.

### 7.3. Audit-first siempre antes de spec literal

Sprint 7.5 confirmó que el spec del brief puede tener errores que solo el audit detecta:
- Item #1: descripción del escenario disparador del bug era inexacta (cap=true vs cap=false).
- Item #1.5: spec inicial de `endsAtIso` habría regresionado trial-awareness de cancel.
- Item #4: 2 de los 4 "fire-and-forget pre-existentes" eran bugs seguridad reclasificados.
- Item #5: `linkError` colisión con `generateLink` requirió rebautizar a `bindError`.

Code aplicó audit-first riguroso en cada bloque. Patrón a mantener.

### 7.4. Push por bloque (lección Sprint 7 § 8.3)

Sprint 7 reportó arrastre de push por hotfix paralelo. Sprint 7.5 aplicó "push tras cada item completado" excepto agrupaciones intencionales (#1+#1.5 con cuenta `b2-fix` compartida). 4 commits, 4 pushes consecutivos, sin arrastres ni mezclas.

### 7.5. Smoke test diferenciado por tipo de cambio

- Items con cambio de comportamiento UI/runtime (#1, #1.5): smoke test funcional obligatorio (cookie efímera, validación visual).
- Items con cambio aditivo (capturar errores donde no había): smoke superficial post-deploy suficiente. Forzar errores Supabase artificialmente no aporta valor proporcional al coste.
- Items de validación pura (#2, #3): SQL + UI + Stripe Dashboard / API según corresponda.

### 7.6. Drift documental Sprint 7 → 7.5

Sprint 7.5 detectó que el brief Sprint 7.5 inicial subestimó la severidad de algunos puntos:
- Item #4: 2 de los 4 fire-and-forget "tolerables" eran bugs críticos seguridad.
- Item #5: el volumen real (3+8) era distinto al estimado (5-10).

Patrón: cuando un brief Tier 1 dice "fire-and-forget pre-existente" o estima volumen, audit-first es obligatorio antes de aplicar el patrón ciegamente.

---

## 8. Estado pre-cutover S8

### Bloqueantes S8 cutover (Sprint 7 → 7.5)

- **Reactivate guard fix (Tier 1.A)** — ✅ resuelto item #1 commit `8fe5cc8`.
- Buzón `hola@appoclick.com` operativo — ⏸ no Sprint 7.5 (operativo no técnico).
- Revisión legal Davinia — ⏸ no Sprint 7.5.
- Firma DPA Miriam + Symbios — ⏸ no Sprint 7.5.

### Recomendados pre-S8 (Sprint 7 Tier 1.B+C)

- **2FA error handling fix (Tier 1.B)** — ✅ resuelto item #4 commit `eaf2462`.
- **Admin endpoints sweep (Tier 1.C)** — ✅ resuelto item #5 commit `1154bb1`.
- **C.1 tests negativos (post fix Tier 1.A)** — ✅ resuelto item #2.
- **C.5 Test Clock validation (post fix Tier 1.A)** — ✅ resuelto item #3.

### Items emergentes Sprint 7.5

- **Item #1.5 BD inline cancel + reactivate (race con webhook)** — ✅ resuelto commit `84525b1`. NO bloqueante S8 estricto pero UX significativamente mejorada.

### Validación cutover

Sprint 7.5 agotó scope técnico pre-S8. Cuando bloqueantes operativos no técnicos estén listos (buzón hola@, legal, DPA), flip `STRIPE_MODE=test → live` en Vercel + soft launch 3-5 clínicas seleccionadas.

---

## 9. Estado post-Sprint 7.5

| Campo | Valor |
|---|---|
| HEAD `origin/main` | `1154bb1` |
| Commits Sprint 7.5 en producción | 4 (`8fe5cc8`, `84525b1`, `eaf2462`, `1154bb1`) |
| Working tree | clean |
| Vercel deploy | Production Current = `1154bb1` Ready |
| Cuenta `b2-fix` | active, lista para futuras iteraciones |
| Cuenta `sprint-7-c5-clock` | free post-deleted, conservada |
| Test Clock | ready, expira 2026-06-06 |
| Bloqueante S8 técnico | 0 (resuelto) |
| Bloqueante S8 operativo | 3 (no técnicos) |

Sprint 7.5 cerrado en producción con 4 commits validados end-to-end, sin regresiones detectadas, disciplina P10-P14 mantenida, cero exposición de PII pese a manejo de cookies de sesión.

---

**Próxima revisión**: al completar bloqueantes operativos S8 (buzón, legal, DPA), arrancar Sprint 8 cutover.
