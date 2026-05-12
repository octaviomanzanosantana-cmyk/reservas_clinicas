# Sprint Fix RLS Performance — auth.uid() initplan

**Fecha:** 12 mayo 2026
**Estado:** FASE 1-4 cerradas, FASE 5 en validación visual + 2h logs
**Sprint:** Fix RLS Performance (paralelo a Sprint Bug Investigation H6)
**HEAD origin/main al inicio:** `6a33cd1`
**HEAD post-fix:** `a9a12f3`
**Migration:** `supabase/migrations/20260512145902_fix_rls_initplan.sql`

---

## 1. Causa raíz (H6 confirmada)

Bug recurrente intermitente en producción:

- `/admin/clinics` → "clinic_users query failed"
- `/b/<slug>` → "Clínica no disponible"
- Signup confirm → email confirma pero no entra al panel

Patrón "va y viene" sin acción humana. Audit SQL sobre `pg_policies` confirmó
**H6 (RLS policies ineficientes)**: 17 policies con `auth.uid()` re-evaluado
por fila en lugar de una vez por query. En compute NANO (Supabase FREE,
eu-west-1, t4g.nano) con carga concurrente (cron + admin + visitas públicas),
las queries degradaban hasta `statement_timeout` o error genérico. Pasada la
carga puntual, volvía a funcionar — de ahí el "va y viene".

---

## 2. Scope confirmado por audit (FASE 1.3)

Query auxiliar contra `pg_policies` listó exactamente **17 policies** (no 18
como decía el header inicial del brief — error de conteo confirmado). No
aparecieron policies extra en `stripe_events_processed`,
`subscription_cancellations` ni en tablas con RLS disabled.

| # | Tabla | Policy | Cmd | Role | Patrón |
|---|---|---|---|---|---|
| 1 | clinic_users | `clinic_users_select_own` | SELECT | authenticated | A — directo |
| 2 | clinics | `clinics_select_own` | SELECT | authenticated | B — EXISTS |
| 3 | clinics | `clinics_update_own` | UPDATE | authenticated | B — EXISTS |
| 4 | appointments | `appointments_select_own_clinic` | SELECT | authenticated | B + CAST `::text` |
| 5 | appointments | `appointments_update_own_clinic` | UPDATE | authenticated | B + CAST `::text` |
| 6 | clinic_hours | `clinic_hours_select_own_clinic` | SELECT | authenticated | C — JOIN slug |
| 7 | clinic_hours | `clinic_hours_insert_own_clinic` | INSERT | authenticated | C — JOIN slug |
| 8 | clinic_hours | `clinic_hours_update_own_clinic` | UPDATE | authenticated | C — JOIN slug |
| 9 | services | `services_select_own_clinic` | SELECT | authenticated | C — JOIN slug |
| 10 | services | `services_insert_own_clinic` | INSERT | authenticated | C — JOIN slug |
| 11 | services | `services_update_own_clinic` | UPDATE | authenticated | C — JOIN slug |
| 12 | clinic_blocks | `"Clinic owners can view their blocks"` | SELECT | **public** | D — IN |
| 13 | clinic_blocks | `"Clinic owners can insert their blocks"` | INSERT | **public** | D — IN |
| 14 | clinic_blocks | `"Clinic owners can delete their blocks"` | DELETE | **public** | D — IN |
| 15 | invoices | `"Clinic members read own invoices"` | SELECT | authenticated | D — IN |
| 16 | tax_data | `"Clinic members read own tax_data"` | SELECT | authenticated | D — IN |
| 17 | tax_data | `"Clinic members update own tax_data"` | UPDATE | authenticated | D — IN + WITH CHECK |

---

## 3. Fix aplicado

**Cambio único, semánticamente nulo, mecánicamente decisivo**:

```sql
-- ANTES
USING (user_id = auth.uid())

-- DESPUÉS
USING (user_id = (SELECT auth.uid()))
```

Envolver `auth.uid()` en subquery escalar fuerza al planner a evaluar la
función una sola vez por query (InitPlan) en lugar de por fila.

**Reglas preservadas literalmente (P12, no refactor)**:

- Role original de cada policy (3 `public` + 14 `authenticated`).
- CAST `(cu.clinic_id)::text` en las 2 policies de `appointments` (la
  columna es TEXT, no UUID).
- Patrón D mantiene `IN (subquery)`, **no** se convierte a EXISTS.
- Alias preservados (clinic_blocks sin alias; resto con `cu`).
- Nombres de policies idénticos, incluido el entrecomillado de las 6 con
  frase humana en inglés.
- Policy de UPDATE en `tax_data` envuelve `auth.uid()` en USING **y** en
  WITH CHECK (tenía ambos).

Migration envuelta en `BEGIN; … COMMIT;` para rollback atómico ante fallo.

---

## 4. Validación

### 4.1 Pre-fix (FASE 1)

- **Tipos de columnas**: confirmado `appointments.clinic_id = TEXT`,
  resto UUID o TEXT consistente. Solo el CAST de appointments es necesario.
- **Índices**: `clinic_users_user_id_key` UNIQUE on (user_id), `clinics_slug_key`
  UNIQUE on (slug), y todos los `clinic_id`/`clinic_slug` en tablas hijas
  cubiertos. **Ningún índice falta** — bottleneck es 100% el initplan.

### 4.2 Post-fix (FASE 3)

- **Ejecución migration**: SQL Editor Supabase, "Success. No rows returned".
- **Re-validación pg_policies**: 0 filas con `auth.uid()` sin envolver →
  17/17 reescritas.
- **EXPLAIN smoke test** sobre `clinic_users`:
  ```
  Index Only Scan using clinic_users_user_id_key
    Index Cond: (user_id = (InitPlan 1).col1)
    Heap Fetches: 0
  Planning Time: 13.477 ms
  Execution Time: 0.098 ms
  ```
  `InitPlan 1` presente → `auth.uid()` precomputado una vez. ✓
- **TypeScript**: `tsc --noEmit` clean.
- **Next build**: exit 0, 86 static pages, `Compiled successfully in 4.2s`.

### 4.3 Smoke producción (FASE 5.2)

| Endpoint | HTTP | Tiempo | Notas |
|---|---|---|---|
| `/admin/clinics` | 307 → /login | 572ms | Redirect esperado sin auth |
| `/b/miriamlorenzo` | 200, 13.5KB | 713ms | Carga normal, sin "Clínica no disponible" |
| `/auth/confirm` (sin token) | 307 | 472ms | Redirect esperado |

Sin 500/503, sin string de error en HTML.

---

## 5. Hallazgos Tier 2 (no tocar en este sprint)

### T2-RLS-1 — Índices duplicados en `clinic_users`

`clinic_users` tiene 3 índices sobre `clinic_id`:

- `clinic_users_clinic_id_idx` (no unique)
- `clinic_users_clinic_id_key` (UNIQUE)
- `clinic_users_clinic_user_unique` (UNIQUE compuesto `clinic_id, user_id`)

El `_idx` es redundante con el `_key`. Limpieza menor.

### T2-RLS-2 — Modelo 1:1 user↔clinic implícito

`clinic_users_clinic_id_key` UNIQUE sobre `clinic_id` **y**
`clinic_users_user_id_key` UNIQUE sobre `user_id` implican:

- 1 user → 1 sola clinic (no multi-clinic admin)
- 1 clinic → 1 solo user (no multi-staff)

Probablemente intencional MVP. Bloqueador para escalado multi-staff o
admin cross-clinic. Revisar cuando producto requiera.

### T2-RLS-3 — Bug en query auxiliar pg_policies original (FASE 1.3)

La query inicial:

```sql
AND NOT (
  COALESCE(qual, '') ~* '\(\s*select\s+auth\.uid\(\)'
  AND COALESCE(with_check, '') ~* '\(\s*select\s+auth\.uid\(\)|^$'
)
```

producía falsos positivos en policies INSERT (donde `qual` es NULL → COALESCE
'' → no matchea regex → primera condición FALSE → AND FALSE → NOT FALSE =
TRUE → policy aparece aunque esté correcta).

**Versión corregida** (chequeo independiente por columna que sí contiene
`auth.uid()`):

```sql
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual ~* 'auth\.uid\(\)' OR with_check ~* 'auth\.uid\(\)')
  AND (
    (qual ~* 'auth\.uid\(\)' AND qual !~* '\(\s*select\s+auth\.uid\(\)')
    OR
    (with_check ~* 'auth\.uid\(\)' AND with_check !~* '\(\s*select\s+auth\.uid\(\)')
  );
```

Usar la versión corregida en futuras auditorías RLS.

### T2-RLS-4 — Discrepancia doc tax_data

Spec original mencionó discrepancia entre doc y BD sobre `tax_data`. No
investigada en este sprint (out of scope). Apuntada para revisión.

### T2-RLS-5 — rate_limit_events sin policies

`rate_limit_events` tiene RLS=true pero 0 policies → deny-all efectivo.
No estaba en scope del fix initplan. Revisar si es intencional o gap.

### T2-RLS-6 — Tablas con RLS DISABLED

`google_calendar_tokens`, `impersonation_tokens`, `login_attempts`,
`patient_deletion_log`, `two_factor_codes` tienen RLS deshabilitado.
Sprint **RLS Hardening** separado, no este.

---

## 6. Criterio de cierre

### Parcial (FASE 5 OK)

- [x] 17 policies reescritas en producción (FASE 3.3 confirmó 0 filas bug)
- [ ] Validación visual Octavio en 3 endpoints
- [ ] 2h smoke producción sin "clinic_users query failed" en logs Vercel

### Total (Fase D del Sprint Bug Investigation)

- [ ] 7 días de producción sin incidente intermitente reportado
- [ ] Si pasa: Sprint Bug Investigation queda cerrado, H6 confirmada como
      causa raíz definitiva

---

## 7. Referencias

- Migration: [supabase/migrations/20260512145902_fix_rls_initplan.sql](../../supabase/migrations/20260512145902_fix_rls_initplan.sql)
- Migration madre RLS: [supabase/migrations/20260330_enable_rls_all_tables.sql](../../supabase/migrations/20260330_enable_rls_all_tables.sql)
- Sprint Bug Investigation: [SPRINT_BUG_INVESTIGATION.md](SPRINT_BUG_INVESTIGATION.md)
- Commit: `a9a12f3` — `fix(rls): optimize auth.uid() evaluation in 17 policies to fix intermittent query failures`
