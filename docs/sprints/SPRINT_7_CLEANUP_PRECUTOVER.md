# Sprint 7 — Cleanup pre-cutover

**Periodo**: 5–7 mayo 2026
**Cierre**: 2026-05-07
**Branch**: `main`

---

## 1. Resumen ejecutivo

Sprint 7 ejecutado como cleanup pre-cutover. Audit-first reveló que 4 de 8 bloques planificados eran innecesarios o riesgosos: B1 (migrations format), B3 (anon key, ya migrada), B4 (BD cleanup, datos vinculados críticos), B7 (cuerpos email, falsa alarma). 4 bloques con commit ejecutados (B2, B5, B6, B8) totalizando 11 archivos modificados, +23 líneas / -34 líneas (net -11). Sprint descubrió 3 bugs Tier 1 que justifican Sprint 7.5: reactivate guard incorrecto (bloqueante S8), 2FA error handling silencioso (6 puntos), endpoints admin sweep (post-S6.2). Validaciones C parciales (5 de 9 puntos C.2 cubiertos). Doc contiene 18 hallazgos Tier 2 informativos para backlog post-cutover.

---

## 2. Bloques completados

### Con commit (fase B)

| Bloque | Commit | Descripción | Archivos | Líneas |
|---|---|---|---|---|
| B2 | `24072ee` | chore(rgpd): remove personal data from console logs | 7 | +10/-29 |
| B5 | `6576ef7` | feat(reviews): add review_email_enabled flag to clinics | 1 (migration) | +5 |
| B6 | `6ddd62a` | feat(reviews): gate review email behind review_email_enabled flag | 2 | +2/-1 |
| B8 | `a41a89d` | fix(auth): add admin impersonation fallback to requireCurrentClinicForRequest | 1 | +6/-4 |

**Total**: 11 archivos, +23/-34 (net −11).

### Validaciones (fase C, parcial)

- **C.3** webhooks B7.1 reintentados: cierre con caveat documental.
- **C.2** smoke test general: 5 de 9 puntos validados (P1, P2, P3 reducido, P7, P9).

---

## 3. Bloques cancelados con justificación

| Bloque | Razón cancelación | Promovido a |
|---|---|---|
| **B1** migration rename | A.4 confirmó 20 migrations OK aplicadas en orden cronológico correcto. `schema_migrations` no tiene `executed_at`, ordena por `version`. Sin bug latente. Renombrado puramente estético. | Tier 2 backlog |
| **B3** anon key migration | B0/B3.1 verificación en Vercel reveló que `NEXT_PUBLIC_SUPABASE_ANON_KEY` ya estaba en `sb_publishable_*`. Migración previa no documentada (drift documental B7.1). | N/A — ya completado |
| **B4** cleanup BD ADD-2 | A.3 reveló datos críticos vinculados a `sprint-2-dni-test` (1 clinic_user, 2 invoices, 1 tax_data, 1 service, 10 clinic_hours) y `sprint1` (1 clinic_user, 2 invoices, 1 tax_data). DELETE no seguro. | Sprint Test Data Hygiene post-cutover |
| **B7** cuerpos email coherentes | A.2 reveló `EMAIL_FROM=hola@` con 0 menciones a `citas@`. NO había incoherencia que arreglar (drift matriz §5.2). | N/A — falsa alarma |
| **C.1** tests negativos S6 | C.1.0 descubrió bug reactivate guard incorrecto. `b2-fix` imposible reactivar para repetir tests. | Sprint 7.5 |
| **C.5** Stripe Test Clock | Camino C complejidad mayor que estimación inicial. Test Clock + customer creados (`clock_1TUUh1AL0qP42ZSxefIJwYFq`, `cus_UTRcFUv01TYAAj`) conservados para retomar S7.5. | Sprint 7.5 |

---

## 4. Hallazgos críticos Tier 1

### Tier 1.A — Bug reactivate guard incorrecto

**Detectado**: C.1.0 Sprint 7.

**Síntoma**: endpoint `/api/billing/reactivate` devuelve "Tu suscripción ya estaba activa" cuando BD `subscription_status='canceled'` con `canceled_at NOT NULL`.

**Causa probable**: el guard comprueba estado Stripe API (`subscription.status='active'` porque la sub está en período de gracia hasta `plan_expires_at`) sin comprobar BD (`subscription_status='canceled' AND canceled_at IS NOT NULL`).

**Implicación**:
- Cliente cancela durante período → period gracia activo en Stripe → intenta reactivar → endpoint rechaza creyendo que está activa.
- Cliente atrapado en estado canceled sin poder reactivar pese a UI con botón "Reactivar suscripción".

**Caveat técnico**: B7 fix S6 ("reset `canceled_at` on reactivation") nunca llega a ejecutarse porque el guard rechaza antes. B7 está bien implementado pero protegido por una guard incorrecta.

**Carga estimada fix**: 30–45 min.
- Audit del guard.
- Cambiar lógica: reactivar si BD `canceled_at IS NOT NULL` OR Stripe `cancel_at_period_end=true` (cualquiera de las 2).
- Re-test con `b2-fix`.

**Bloqueante S8 cutover**: SÍ. Cliente paying real no podrá reactivar tras cancelar. Si descubierto post-cutover con clientes reales = incidente.

### Tier 1.B — Error handling silencioso 2FA

**Detectado**: B2 archivos 3-4 Sprint 7.

**Patrón problemático**: destructuring de operaciones Supabase sin capturar/evaluar `error`. El `console.log` RGPD eliminado en B2 era el ÚNICO rastro post-mortem de fallos.

**6 puntos confirmados**:
- `app/api/auth/send-2fa-code/route.ts`: `insertError` destructurado no evaluado (B2 resolvió logs, NO el manejo).
- `app/api/auth/verify-2fa-code/route.ts`: `queryError` destructurado no evaluado (B2 resolvió logs, NO el manejo).
- 4 fire-and-forget pre-existentes en `verify-2fa-code` (L40, L53, L68, L86 post-edit).

**Implicación tras B2**:
- Insert código 2FA falla → usuario no recibe código → soporte sin visibilidad.
- Verify código 2FA falla update → estado inconsistente.

**Carga estimada fix**: 30–45 min para ambos archivos + posibles otros patrones similares.

### Tier 1.C — Endpoints admin sweep post-S6.2

**Detectado**: hotfix S6.2 (07/05/2026 commit `01a4f3e`), aplicado durante pausa nocturna Sprint 7.

**Bug producción**: `/api/admin/clinic-stats` devolvía `200` con `[]` silenciando errores Supabase por destructuring sin captura (3 queries + `auth.admin.listUsers`).

**Fix aplicado en S6.2**: capturar `{ data, error }`, `console.error` estructurado (message/code/details, sin PII), return `500`.

**Patrón a replicar**:
- Barrido sistemático endpoints admin (5–10 estimados).
- `grep -rn "const { data" app/api/admin/ --include="*.ts"`.
- Para cada hit sin `error:` → aplicar mismo patrón S6.2.

**Carga estimada fix**: 30–60 min.

---

## 5. Sprint 7.5 propuesto

**Sprint 7.5**: "Supabase error handling sweep + bug fixes pre-cutover".

**Carga total estimada**: 90–120 min.

**Items en orden recomendado**:

1. Reactivate guard fix (30–45 min) — desbloquea C.1.
2. C.1 tests negativos S6 (15 min, dependiente fix #1).
3. C.5 Stripe Test Clock validation (15–20 min, infra ya creada).
4. 2FA error handling fix (30–45 min).
5. Admin endpoints sweep (30–60 min).

**Bloqueante S8 cutover**: ítem 1 (reactivate guard).

---

## 6. Hallazgos Tier 2 informativos

Lista numerada (18 hallazgos):

1. **Drift matriz v1.1 §5.2 sender hola@ vs citas@** (descubierto A.2). Realidad: `EMAIL_FROM=hola@` con 0 menciones a `citas@`. Decisión futura S7.5/S8 sobre split semántico `citas@`/`hola@`.

2. **Schema FK `clinics` inconsistente — 3 modelos coexistentes** (descubierto A.3): `clinic_id UUID` (clinic_users, invoices, tax_data, etc.), `clinic_id TEXT` mal nombrado (appointments, patient_deletion_log), `clinic_slug TEXT` (services, clinic_hours, impersonation_tokens). Documentado conscientemente en migration `20260330`. Refactor estético deseable, no urgente.

3. **`appointments.clinic_id` es TEXT mal nombrado** (debería ser `clinic_slug` para coherencia). Tier 2 backlog.

4. **ADD-2 cancelado**, promovido a "Sprint Test Data Hygiene" post-cutover. Limpiar 2 clinics test (`sprint-2-dni-test`, `sprint1`) con plan cascade controlado por datos vinculados.

5. **20 migrations formato corto** (`YYYYMMDD_*`) histórico, sin bug latente verificado en `schema_migrations` (A.4). Renombrado puramente estético. Tier 2 backlog.

6. **Migrations `20260311` y `20260312` duplicadas idénticas** (create_clinic_hours). **Curiosidad Tier 3**.

7. **Memoria S2.6 imprecisa** "/clinic/*" → realidad "/clinic/[slug]/*". B8 fix corrigió la divergencia haciendo que la simplificación sea literal post-fix.

8. **B8 mejora colateral**: `app/clinic/(default)/*` hereda fallback impersonation automáticamente (paridad con `(by-slug)`).

9. **Confirmación accidental bug RGPD durante `next build`** (B0.2). Email superadmin loggeado en cada build Vercel. Cerrado en B2.

10. **Movimientos manuales Stripe Sprint 6 no documentados** (B0.3): editar `trial_end` UI Stripe + "no cancelar" UI Stripe + cancel/reactivate via API. Recomendación operativa: documentar cualquier movimiento manual Stripe Dashboard en sprint doc activo.

11. **Naming engañoso función `sendAppointmentReviewEmail`** (B6.0). Función dual-purpose: review request si `review_url`, "gracias" fallback si null. Renombrar a `sendAppointmentPostVisitEmail` o similar. Tier 2 backlog.

12. **Sub-flag cron `appointment-reminders`** (B6 audit): pasa `review_url` al sender, NO investigado si reminder usa para CTA review. Tier 2 audit (~15 min) + posible fix (~5 min).

13. **Drift documental Vercel env vars**: cambios durante hotfixes no documentados en sprints docs. Sprint 6 chat afirmó "pendiente migrar anon key" cuando ya estaba migrada. Recomendación: checklist pre-sprint con env vars relevantes y valor actual.

14. **B5 `schema_migrations` desincronizada**: migration aplicada manualmente vía SQL Editor (Supabase CLI `db push` roto, deuda conocida). 33 migrations en filesystem vs no-tracking en BD. Sprint dedicado post-cutover para fix tooling + reconciliación.

15. **Inconsistencia copy `/mi-plan` UI** (C.1.0): sección superior "Suscripción cancelada" vs sección Método de pago "Tu suscripción está activa". Tier 2 backlog UX.

16. **`updated_at` `b2-fix` desincronizado** (C.1.0): valor `2026-04-26 22:11:13` pese a cancelación `2026-05-05`. Operación cancelación NO actualizó `updated_at`. Tier 2 backlog.

17. **Banner sticky NO aparece en `/mi-plan`** (C.2). Comportamiento intencional: vive en `(by-slug)/[slug]/layout.tsx` solamente. Coherente con A.5.

18. **Footer legal NO presente en panel autenticado app** (C.2.P9). Era ítem 3 alcance original Sprint 7 "decision pending", mantenido pendiente tras audit. Considerar para S8 o post-launch.

---

## 7. Cuentas TEST creadas durante Sprint 7

| Cuenta | Origen | Estado actual | Acción posterior |
|---|---|---|---|
| `sprint-7-c2-smoke` (clinics) | C.2.P1 registro | trial, plan starter, `review_email_enabled=true`, sin tax_data, sin método pago | Persiste en BD. Promovida Sprint Test Data Hygiene. |
| Sprint 7 C.5 Test Clock (Stripe) | C.5 setup | `clock_1TUUh1AL0qP42ZSxefIJwYFq`, frozen 2026-05-07 17:21 WEST, expires 30 days | Conservada para Sprint 7.5. |
| `cus_UTRcFUv01TYAAj` (Stripe customer) | C.5 setup | Vinculado al Test Clock, sin suscripción | Conservado para Sprint 7.5. |

---

## 8. Recomendaciones operativas

**8.1.** Documentar cambios manuales en Stripe Dashboard durante hotfixes/sprints. Si tooling automatizado falla, dejar registro en sprint doc activo en el momento del cambio.

**8.2.** Documentar cambios Vercel env vars en sprint doc activo. Drift documental detectado: `NEXT_PUBLIC_SUPABASE_ANON_KEY` estaba migrada sin docs.

**8.3.** Sprint 7 push fue arrastrado por hotfix S6.2 durante pausa nocturna. Patrón: si hay commits locales sin push y se ejecuta hotfix sobre `main`, el push del hotfix arrastra todo. Decidir: push diario al cierre sesión vs push final del sprint. P10 puede ser ambiguo aquí.

**8.4.** Audit-first (P11) descubrió 4 bloques innecesarios + 3 bugs Tier 1. Patrón validado para sprints futuros: presupuestar 30–40 % del sprint para Bloque A audit antes de tocar código.

---

## 9. Estado pre-cutover S8

### Bloqueantes S8 cutover identificados durante Sprint 7

- **Reactivate guard fix** (Tier 1.A) — bloqueante crítico.
- Buzón `hola@appoclick.com` operativo (no Sprint 7).
- Revisión legal Davinia (no Sprint 7).
- Firma DPA Miriam + Symbios (no Sprint 7).

### NO bloqueantes pero recomendados S7.5 antes de S8

- 2FA error handling fix (Tier 1.B).
- Admin endpoints sweep (Tier 1.C).
- C.1 tests negativos (post fix Tier 1.A).
- C.5 Test Clock validation (post fix Tier 1.A).

Sprint 7 completó scope comprometido en cleanup pre-cutover. Sprint 7.5 necesario antes de S8. Carga total ruta hasta S8: ~3–5 días.
