# Sprint Bug Investigation — fallos intermitentes producción

**Fecha de apertura:** ≤ 12 mayo 2026 (investigación previa al sprint, fecha exacta interna)
**Fecha causa raíz confirmada:** 12 mayo 2026
**Fecha cierre técnico (parcial):** 12 mayo 2026 (fix desplegado)
**Cierre total (Fase D):** pendiente — requiere 7 días producción sin incidente
**Sprint asociado al fix:** [SPRINT_FIX_RLS_PERFORMANCE.md](SPRINT_FIX_RLS_PERFORMANCE.md)

---

## 1. Síntomas reportados

Patrón intermitente "va y viene" sin acción humana, sobre 3 superficies:

| Superficie | Síntoma observado |
|---|---|
| `/admin/clinics` | "clinic_users query failed" |
| `/b/<slug>` | "Clínica no disponible" |
| Signup confirm | Email confirma pero no entra al panel |

Característica clave: el fallo se resuelve solo tras unos minutos sin
intervención. Eso descartó causas estáticas (bug de código, datos
corruptos, config rota) y apuntó a causa dependiente de carga concurrente
o estado transitorio.

---

## 2. Hipótesis evaluadas

| # | Hipótesis | Veredicto | Notas |
|---|---|---|---|
| H1-H5 | Hipótesis previas descartadas | DESCARTADAS | Detalle en bitácora interna de investigación; no impactan el fix final |
| **H6** | **RLS policies ineficientes — `auth.uid()` re-evaluado por fila** | **CONFIRMADA** | Audit SQL sobre `pg_policies` detectó 17 policies con el patrón. Sub-ms con InitPlan vs degradación bajo carga sin él. |

> Nota: H1-H5 se descartaron en investigación interna previa al sprint. Si
> se necesita el detalle de cada una (BD down, auth issues, cron collisions,
> Stripe webhook backlog, etc.), revisar bitácora interna o expandir este
> doc en commit posterior.

---

## 3. Causa raíz — H6

**Mecánica del bug**:

En Postgres, una RLS policy que llama `auth.uid()` directamente (no
envuelto en subquery escalar) provoca que el planner **re-evalúe la
función por cada fila escaneada**. Para una tabla pequeña esto es
imperceptible. Bajo carga concurrente sobre compute NANO (Supabase FREE
tier, eu-west-1, t4g.nano):

- Cron jobs (recordatorios, lifecycle diario) → escaneos completos
- Visitas a `/admin/clinics` → joins múltiples con RLS
- Visitas públicas `/b/<slug>` → SELECTs con policies que también
  llamaban `auth.uid()` aunque el caller no estuviera autenticado

El acumulado degradaba queries hasta tocar `statement_timeout` (default
postgres) o devolver error genérico. Una vez pasaba la ráfaga de carga,
volvía a funcionar — patrón "va y viene".

**Por qué no se detectó antes**:

- No es bug de código fuente.
- No es bug de datos.
- No aparece en local (carga 1) ni con `EXPLAIN` en idle.
- Aparece en Supabase Advisor → categoría "Performance / RLS InitPlan".

---

## 4. Fix aplicado

Sprint paralelo [SPRINT_FIX_RLS_PERFORMANCE.md](SPRINT_FIX_RLS_PERFORMANCE.md).

**Cambio único**: envolver `auth.uid()` en `(SELECT auth.uid())` en las 17
policies afectadas. Migration en
[supabase/migrations/20260512145902_fix_rls_initplan.sql](../../supabase/migrations/20260512145902_fix_rls_initplan.sql).

Commit `a9a12f3`, fix vivo en producción desde su ejecución manual en SQL
Editor (la BD compartida no espera al deploy Vercel para tener las
policies activas).

---

## 5. Estado actual

| Fase | Estado |
|---|---|
| A — Síntoma identificado | ✓ |
| B — Hipótesis evaluadas | ✓ (H6 confirmada) |
| C — Fix técnico desplegado | ✓ (commit `a9a12f3`) |
| D — Monitoreo 7 días en producción | ⏳ en curso desde 12 mayo 2026 |

### Criterio cierre Fase D

- Sin reporte de "clinic_users query failed" en 7 días naturales.
- Sin reporte de "Clínica no disponible" intermitente.
- Sin signup que confirme email y no entre al panel.

Si pasa: **Sprint Bug Investigation queda cerrado**, H6 confirmada como
causa raíz definitiva.

Si reaparece: re-abrir investigación con H6 descartada como causa única,
explorar causas mezcladas (índices ausentes, statement_timeout config,
saturación de connections en plan FREE, etc.).

---

## 6. Referencias

- Sprint fix: [SPRINT_FIX_RLS_PERFORMANCE.md](SPRINT_FIX_RLS_PERFORMANCE.md)
- Migration aplicada: [supabase/migrations/20260512145902_fix_rls_initplan.sql](../../supabase/migrations/20260512145902_fix_rls_initplan.sql)
- Migration madre RLS (origen del patrón): [supabase/migrations/20260330_enable_rls_all_tables.sql](../../supabase/migrations/20260330_enable_rls_all_tables.sql)
- Commit fix: `a9a12f3`
