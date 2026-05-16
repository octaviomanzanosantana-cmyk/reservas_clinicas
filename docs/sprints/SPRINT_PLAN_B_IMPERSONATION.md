# Sprint Plan B Impersonación — RPC SECURITY DEFINER para /api/admin/impersonate-clinic

**Fecha cierre:** 16 mayo 2026
**Branch:** main
**Tiempo real:** ~2h (auditoría + implementación + validación)
**Bloqueante para cutover S8 (lunes 19/5):** Sí — resuelto

---

## 1. Problema resuelto

El endpoint `POST /api/admin/impersonate-clinic` devolvía 404 "Clínica no encontrada" para slugs que sí existían en BD. Reproducido en producción 15/5/26 tarde:

- `miriamlorenzo` → 404 (6 reintentos consecutivos)
- `symbios-psicologia` → 404 (mismos 6 reintentos)

El bug era intermitente: en ventanas anteriores el mismo endpoint con los mismos slugs había funcionado. La nueva ruta `/admin/go` (commit `8f2a0d6`, 15/5 tarde) fue la que reveló el alcance real porque permite probar slugs arbitrarios sin pasar por la lista de `/admin/clinics`.

El sprint anterior `b98c21c` (15/5 mañana) había aplicado Plan B RPC SECURITY DEFINER al endpoint `/api/admin/clinic-stats` con la función `get_all_clinics()`. Resolvió el listado admin pero no tocó el flujo de impersonación porque ese endpoint no estaba aún en el cuadro clínico del bug.

---

## 2. Causa raíz

Diagnóstico cerrado tras 2 días de investigación intermitente. Evidencia clave en logs Supabase del técnico:

- `sql_state_code: 42501` (permission denied)
- `user_name: "authenticator"` (en vez del esperado `service_role`)

PostgREST está ejecutando queries como rol `authenticator` en lugar de `service_role` en ventanas no determinísticas. La causa probable es la migración interna Supabase de **Legacy JWT Secret → JWT Signing Keys** (`CURRENT KEY + PREVIOUS KEY` visibles en Dashboard). Algunos workers PostgREST validan el legacy JWT correctamente y resuelven el rol; otros caen al rol base `authenticator` sin escalada a `service_role`.

**Verificación empírica que descarta causa en código o env vars:**
- `curl` directo desde fuera de Vercel con el mismo JWT → 200 OK 14 clínicas.
- `jwt.io` confirmó payload del token con `role: service_role`.
- El bug "se cura solo" en ventanas, lo que produjo falsos positivos durante validación en los 2 días previos.

El bug está en la infraestructura Supabase durante su propia transición de JWT, no en código de aplicación ni configuración del cliente.

---

## 3. Decisión

Aplicar el mismo patrón Plan B ya validado con `get_all_clinics`: reemplazar la query directa a la tabla `clinics` por una RPC `SECURITY DEFINER`. La función SQL se ejecuta como su owner (`postgres`) y no depende del `SET ROLE service_role` que el bug PostgREST no aplica correctamente.

**Descartado en este sprint:**
- Migración real a `sb_secret_*`: sigue diferida desde hotfix B7.1 revertido el 9/5/26. Resuelve la causa raíz pero no fue drop-in en su momento. Backlog post-cutover.
- Aplicar Plan B también al INSERT de `impersonation_tokens`: sin evidencia que lo requiera (el bug se manifestó como 404 = SELECT silenciosamente vacío, no como 500 que sería failure del INSERT). P12 — sin scope creep.

---

## 4. Implementación

### 4.1 Migration

Path: `supabase/migrations/20260516_get_clinic_by_slug_rpc.sql`

Función `public.get_clinic_by_slug(p_slug text)` con shape mínimo:

- `RETURNS TABLE (id uuid)` por consistencia con `get_all_clinics` y por permitir ampliación futura sin migration extra. El endpoint actual solo usa `clinic` como guard de existencia, no consume `id`.
- `LANGUAGE sql` + `SECURITY DEFINER` + `SET search_path = public, pg_temp` (anti-hijack).
- `REVOKE EXECUTE` de `PUBLIC`, `anon`, `authenticated`. `GRANT EXECUTE` solo a `service_role`.

Aplicada manualmente vía Supabase SQL Editor (tooling `supabase db push` sigue roto, ver doc `docs/sprints/SPRINT_BUG_INVESTIGATION.md`). El archivo `.sql` queda en repo como historia versionada.

### 4.2 Código

Modificación única en `app/api/admin/impersonate-clinic/route.ts` (líneas 23-32):

- Sustituida `supabaseAdmin.from("clinics").select("id").eq("slug", slug).maybeSingle()` por `supabaseAdmin.rpc("get_clinic_by_slug", { p_slug: slug })`.
- Cast `as Array<{ id: string }> | null` para extraer la primera fila, mismo patrón que el commit `b98c21c` en `/api/admin/clinic-stats`.
- Guard `if (!clinic)` preservado: ahora dispara solo cuando la función realmente devuelve 0 filas (slug inexistente), no por bug del rol.

Resto del endpoint intacto:
- `getAdminUser()` check inicial.
- INSERT en `impersonation_tokens` con `token`, `clinic_slug`, `expires_at`.
- Set cookie httpOnly `admin_token` con TTL 60min.
- Return `{ redirect_to: "/clinic/<slug>" }`.

---

## 5. Validación

### 5.1 SQL post-migration (4 queries)

Ejecutadas por Octavio en Supabase SQL Editor tras aplicar la migration:

| Query | Esperado | Resultado |
|---|---|---|
| `select * from public.get_clinic_by_slug('miriamlorenzo')` | 1 fila con `id` uuid | 1 fila |
| `select count(*) from public.get_clinic_by_slug('this-does-not-exist-xyz')` | 0 | 0 |
| `has_function_privilege('service_role', ..., 'execute')` | true | true |
| `has_function_privilege('anon', ..., 'execute')` + `authenticated` | ambos false | ambos false |

### 5.2 Visual producción (5 tests, P15)

Ejecutados sobre SHA `146083b` desplegado en Vercel production:

| Test | Acción | Resultado |
|---|---|---|
| 1 | `miriamlorenzo` vía `/admin/go` | OK — redirect `/clinic/miriamlorenzo` + banner naranja impersonación |
| 2 | `symbios-psicologia` vía `/admin/go` | OK — redirect + banner |
| 3 | Slug inexistente vía `/admin/go` | OK — error inline 404 preservado (no regresión) |
| 4 | Bookmark `/admin/go?slug=miriamlorenzo` prefill sin auto-submit | OK |
| 5 | `/admin/clinics` listado 14 clínicas + click "Impersonar" | OK — flujo viejo también beneficiado por compartir endpoint |

Recientes en localStorage tras Tests 1+2: chips visibles en orden inverso de uso, persistencia confirmada.

---

## 6. Deuda técnica y backlog

### T2-IMPERSONATION-INSERT-FALLBACK
Si el bug PostgREST se extiende del SELECT al INSERT (`impersonation_tokens`), aplicar un segundo RPC `SECURITY DEFINER insert_impersonation_token(p_token, p_slug, p_expires_at)`. Sin evidencia actual que lo requiera — el bug solo se manifestó como 404 falso, nunca como 500 por failure de INSERT. **NO crear ticket hasta reproducir.** P12 estricto.

### Sprint dedicado Mes 1 post-cutover: migración real a `sb_secret_*`
Resolver la causa raíz (transición Legacy JWT Secret → JWT Signing Keys) en lugar de seguir bypaseando con RPCs. Requerirá replanificar la operación drop-in que falló el 9/5/26 (hotfix B7.1 revertido).

### Sprint RLS Hardening pre-cutover S8 — pendiente
5 tablas con `rls_enabled=false`: `google_calendar_tokens`, `two_factor_codes`, `login_attempts`, `patient_deletion_log`, `impersonation_tokens`. Migration `supabase/migrations/20260515_rls_hardening_admin_tables.sql` ya redactada y verificada en auditoría FASE 1 (working tree dirty). No afectada por este sprint y no tocada deliberadamente para mantener el commit atómico.

---

## 7. Lecciones aprendidas

### P10 / P11 — Audit-first
La auditoría reveló que solo el SELECT por slug necesitaba RPC: el INSERT de `impersonation_tokens` no se ve afectado por el bug y aplicar el patrón allí también habría sido scope creep sin evidencia. La función `get_clinic_by_slug` quedó mínima (`RETURNS TABLE (id uuid)`) en vez de devolver el row completo como propuesta inicial.

### P12 — Sin scope creep
Backlog `T2-IMPERSONATION-INSERT-FALLBACK` anotado mentalmente, no creado como ticket sin reproducción. Migration RLS Hardening dirty en working tree no se tocó pese a estar lista — su sprint dedicado vive aparte.

### P15 — Validación visual
5 tests visuales en producción antes de cerrar, incluyendo Test 3 (regresión de 404 legítimo) para garantizar que el guard sigue rechazando slugs inexistentes con el mismo mensaje que antes.

### Diagnóstico empírico vs hipótesis
El bug "se cura solo" en ventanas dio falsos positivos durante 2 días: cada validación en ventana sana hacía pensar que el problema estaba resuelto. El log de Supabase del técnico (`user_name=authenticator`) fue la pieza definitiva. **Lección operativa:** cuando un bug intermitente parece imposible, mirar logs del servidor de BD, no solo del cliente.

---

## 8. Commits del sprint

```
146083b  fix(admin): RPC get_clinic_by_slug bypasea bug PostgREST authenticator en impersonación
```

Push directo a `main` (mismo flujo que `/admin/go` el 15/5 — sin PR intermedio porque sprint es solo-fix de bloqueante crítico).

---

## 9. Estado pre-cutover S8

| Campo | Valor |
|---|---|
| HEAD `origin/main` | `146083b` |
| Commits sprint en producción | 1 (`146083b`) |
| Migration aplicada en BD | `get_clinic_by_slug()` con grants verificados |
| Working tree | dirty (1 archivo intencional: `20260515_rls_hardening_admin_tables.sql`) |
| Vercel deploy | Production Current = `146083b` Ready |
| Bloqueante S8 técnico | 0 (resuelto) |
| Bloqueantes S8 no técnicos | 0 (legal Davinia, hola@ operativo, DPAs firmados Miriam+Symbios) |

Sprint Plan B Impersonación cerrado en producción con 1 commit atómico, migration aplicada manualmente, 4 verificaciones SQL OK y 5 tests visuales OK. Disciplina P10-P15 mantenida. Cutover S8 lunes 19/5/26 desbloqueado 100%.

---

**Próxima revisión:** cutover S8 lunes 19/5/26 tras flip `STRIPE_MODE=test → live` en Vercel UI.
