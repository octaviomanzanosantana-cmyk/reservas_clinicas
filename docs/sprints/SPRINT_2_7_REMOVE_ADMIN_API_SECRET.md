# SPRINT 2.7 — Eliminar `NEXT_PUBLIC_ADMIN_API_SECRET` expuesto

**Fecha apertura:** 02/05/2026
**Fecha cierre:** 02/05/2026
**Tiempo real:** ~1.5 h (estimado 1.5-2 h, en presupuesto)
**Branch base:** `main` (sobre commit `53d77fb` — cierre Sprint 2.6)
**Bloqueante para cutover:** Sí (deuda crítica de seguridad)

---

## 1. Origen y objetivo

Detectado durante Sprint 2.6: `NEXT_PUBLIC_ADMIN_API_SECRET` estaba expuesto en el bundle público del frontend. El prefijo `NEXT_PUBLIC_*` hace que Next.js inyecte la variable en el JavaScript del cliente, accesible vía DevTools.

Cualquier visitante del sitio podía:
1. Abrir DevTools → Network tab y ver el secret en cualquier request al endpoint admin.
2. Ejecutar acciones admin con `curl` usando ese secret: cambiar plan de cualquier clínica, modificar estado de suscripción, disparar el cron diario, crear clínicas falsas, ver estadísticas privadas.

Riesgo en producción: **crítico antes de cobrar a clientes reales.**

Objetivo: eliminar el fallback `x-admin-secret` de **todos** los endpoints `/api/admin/*` y dejar la autenticación admin con un único camino: sesión Supabase + `ADMIN_EMAILS` vía `getAdminUser()`.

---

## 2. Hallazgos del Bloque A (exploración)

| # | Hallazgo | Implicación |
|---|---|---|
| 1 | `getAdminUser` ([`lib/adminAuth.ts`](../../lib/adminAuth.ts)) ya validaba sesión vía `supabase.auth.getUser()` + `ADMIN_EMAILS` | Suficiente para autenticar admin sin secret. Reusable directamente |
| 2 | **8 endpoints afectados, no 5** como pensábamos: 5 híbridos (`change-plan`, `change-subscription-status`, `clinic-stats`, `demo-clinics`, `run-daily-lifecycle`) + 3 solo-secret (`create-clinic`, `create-clinic-user`, `clinics/create`) | Ampliar alcance a los 8 |
| 3 | **2 frontends** envían el secret: `AdminDemoPanel.tsx` (constante `ADMIN_HEADERS`) y `AdminNewClinicForm.tsx` (header inline) | Ambos con sesión Supabase activa, migración trivial |
| 4 | **Solo `AdminNewClinicForm.tsx` línea 47** llama a los endpoints `create-*`. NO hay scripts externos, cron externo ni webhooks dependientes | Migración 100% segura |
| 5 | Endpoints híbridos usaban función `verifyAdmin(request, admin)` con fallback secret | Eliminar el fallback. Solo `if (!admin) return 401` |
| 6 | Endpoints solo-secret no tenían `import { getAdminUser }` | Añadir import + reemplazar lógica |
| 7 | `demo-clinics` resultó tener 3 handlers (GET, POST, DELETE), no solo POST. GET y POST ya estaban en el patrón final desde Sprint 2.6. Solo el DELETE conservaba el fallback | Menos trabajo del previsto, mismo patrón |

---

## 3. Decisiones cerradas

| Decisión | Resolución |
|---|---|
| Auth post-migración | Solo sesión Supabase + `ADMIN_EMAILS` vía `getAdminUser()` |
| Eliminación de env vars (`.env.local` / Vercel) | **NO tocar en este sprint.** `NEXT_PUBLIC_ADMIN_API_SECRET` y `ADMIN_API_SECRET` quedan huérfanas pero **inertes** (verificado: `grep "process.env.ADMIN_API_SECRET\|process.env.NEXT_PUBLIC_ADMIN_API_SECRET"` → 0 matches en código fuente). Limpieza separada post-cutover |
| Refactor `requireAdmin()` helper | **NO en este sprint.** Los 8 endpoints repiten ahora `const admin = await getAdminUser(); if (!admin) return 401;`. Extracción a helper es una mejora limpia, sin urgencia, post-cutover |
| `console.log` ruidoso de `getAdminUser` | **NO tocar.** Limpieza separada post-cutover |
| Tests | Validación e2e UI (S3-S10) + 3 tests de seguridad críticos (SEC1, SEC2, SEC2.5) |
| Commits | 1 commit por bloque agrupado lógicamente: B (5 endpoints híbridos), C (3 solo-secret), D (2 frontends), F (docs). 1 commit por endpoint sería excesivo |
| Scope creep | **Cero.** Solo eliminar secret + migrar a `getAdminUser`. NO refactorizar lógica de los endpoints |

---

## 4. Cambios aplicados

### Bloque B — Endpoints híbridos (5 archivos)

Patrón eliminado en cada uno:

```typescript
function verifyAdmin(request: Request, admin: { id: string; email: string } | null): boolean {
  if (admin) return true;
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret && secret === process.env.ADMIN_API_SECRET?.trim());
}
```

Reemplazado por: `const admin = await getAdminUser(); if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });`

| # | Endpoint | Notas |
|---|---|---|
| B1 | [`app/api/admin/change-plan/route.ts`](../../app/api/admin/change-plan/route.ts) | Eliminada `verifyAdmin` |
| B2 | [`app/api/admin/change-subscription-status/route.ts`](../../app/api/admin/change-subscription-status/route.ts) | Igual |
| B3 | [`app/api/admin/clinic-stats/route.ts`](../../app/api/admin/clinic-stats/route.ts) | Eliminado bloque "Fallback: check ADMIN_API_SECRET". Firma `GET()` (request ya no se usa) |
| B4 | [`app/api/admin/demo-clinics/route.ts`](../../app/api/admin/demo-clinics/route.ts) | Solo handler **DELETE** tenía fallback (GET y POST ya estaban limpios) |
| B5 | [`app/api/admin/run-daily-lifecycle/route.ts`](../../app/api/admin/run-daily-lifecycle/route.ts) | Eliminada `verifyAdmin`, comentario actualizado, firma `POST()` |

### Bloque C — Endpoints solo-secret (3 archivos)

Patrón eliminado en cada uno:

```typescript
const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET?.trim();
// ...
if (!ADMIN_API_SECRET) return NextResponse.json({ error: "Missing ADMIN_API_SECRET" }, { status: 500 });
const providedSecret = request.headers.get("x-admin-secret")?.trim();
if (!providedSecret || providedSecret !== ADMIN_API_SECRET) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

Reemplazado por `import { getAdminUser } from "@/lib/adminAuth";` + el patrón de B.

| # | Endpoint | Notas |
|---|---|---|
| C1 | [`app/api/admin/create-clinic/route.ts`](../../app/api/admin/create-clinic/route.ts) | Constante eliminada, comentario obsoleto sobre "header o cookie" eliminado |
| C2 | [`app/api/admin/create-clinic-user/route.ts`](../../app/api/admin/create-clinic-user/route.ts) | Constante eliminada |
| C3 | [`app/api/clinics/create/route.ts`](../../app/api/clinics/create/route.ts) | Constante eliminada |

Diff Bloque C: 9 líneas añadidas, 32 eliminadas (reducción neta -23 líneas).

### Bloque D — Frontends (2 archivos)

| # | Archivo | Cambio |
|---|---|---|
| D1 | [`app/admin/clinics/AdminDemoPanel.tsx`](../../app/admin/clinics/AdminDemoPanel.tsx) | Constante `ADMIN_HEADERS` eliminada (incluía `x-admin-secret: process.env.NEXT_PUBLIC_ADMIN_API_SECRET`). 5 fetches actualizados: `clinic-stats` GET sin headers; `demo-clinics` DELETE / `change-plan` POST / `change-subscription-status` POST con `{ "Content-Type": "application/json" }`; `run-daily-lifecycle` POST sin headers |
| D2 | [`app/admin/clinics/new/AdminNewClinicForm.tsx`](../../app/admin/clinics/new/AdminNewClinicForm.tsx) | Header `x-admin-secret` eliminado, `Content-Type` mantenido |

Limpieza colateral en D1: spread duplicado (`{ "Content-Type": "application/json", ...ADMIN_HEADERS }`) simplificado a `{ "Content-Type": "application/json" }` en `change-subscription-status` (el spread ya incluía `Content-Type`).

---

## 5. Tests pasados

### Automatizados (Bloque E parcial)

| Test | Esperado | Resultado |
|---|---|---|
| **S2** bundle público | secret value NO presente en `.next/static/chunks/*.js` | ✅ **0** archivos con el valor. **0** archivos en `.next/server/` tampoco. Bundle limpio |
| **SEC1** sin auth | 401 | ✅ HTTP 401 `{"error":"Unauthorized"}` |
| **SEC2** secret falso (`x-admin-secret: fake-attacker-value-12345`) | 401 | ✅ HTTP 401 |
| **SEC2.5** secret REAL (`NEXT_PUBLIC_ADMIN_API_SECRET` del `.env.local`) | 401 | ✅ HTTP 401 — **el secret real ya no autentica** |
| **SEC2.5b** secret REAL (`ADMIN_API_SECRET` sin prefijo del `.env.local`) | 401 | ✅ HTTP 401 |
| **grep** `process.env.ADMIN_API_SECRET\|process.env.NEXT_PUBLIC_ADMIN_API_SECRET` en código fuente | 0 matches | ✅ 0 referencias residuales fuera de `docs/` |

### UI manuales (Octavio)

| Test | Resultado |
|---|---|
| **S1** DevTools Network | Saltado (cubierto por SEC2.5 + grep) |
| **S3** cambiar plan | ✅ Free→Starter persistido (clínica `Sprint 2 DNI Test`) |
| **S4** cambiar estado suscripción | ✅ Trial→Free→Trial revertido |
| **S5** clinic-stats | ✅ `/admin/clinics` carga lista de 9 clínicas con stats agregados |
| **S6** demo-clinics DELETE | ✅ eliminada `Test Sprint 2.7 - Borrar` |
| **S7** run-daily-lifecycle | **Saltado con justificación.** Ejecutar el botón en local dispara efectos reales (emails + downgrades) sobre BD producción (local apunta a `wvggsgtsjtouqsiwwcls.supabase.co`). El endpoint comparte el patrón de auth idéntico al de los otros 7 ya validados. **Confirmación final diferida a logs Vercel del 03/05/2026 ~09:00 UTC tras deploy** |
| **S8** create-clinic + clinics/create | ✅ creada `Test Sprint 2.7 - Borrar` con email `appoclick+sprint27test@gmail.com` y checkbox demo |
| **S10** | Cubierto en S8 |

`tsc --noEmit` verde tras cada bloque (B, C, D) y antes de cada commit.

---

## 6. Pendientes promovidos (post-cutover)

- **Limpieza de env vars huérfanas** en `.env.local` y Vercel: `NEXT_PUBLIC_ADMIN_API_SECRET`, `ADMIN_API_SECRET`. Verificado que ningún código fuente las lee, pero quedan declaradas. Riesgo cero, simple limpieza.
- **Refactor `requireAdmin()` helper:** los 8 endpoints repiten `const admin = await getAdminUser(); if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });`. Extracción a helper en `lib/adminAuth.ts`.
- **`console.log` ruidoso** en `getAdminUser` ([`lib/adminAuth.ts`](../../lib/adminAuth.ts)) — limpiar logs (mencionado ya en pendientes Sprint 2.6).
- **Auditoría persistente de acciones admin** (qué admin hizo qué cuándo, en BD).
- **Limpieza worktrees** `.claude/worktrees/*` huérfanos.

---

## 7. Verificación pendiente operativa

| # | Acción | Cuándo |
|---|---|---|
| V1 | Smoke test producción: login admin real en `app.appoclick.com/admin/clinics` → cambiar plan de clínica de prueba → verificar que funciona sin secret. Tests rápidos no destructivos | Tras auto-deploy Vercel del commit de cierre |
| V2 | Logs Vercel del cron `daily-lifecycle` para confirmar que `run-daily-lifecycle` procesa correctamente con `getAdminUser`-only | 03/05/2026 ~09:30 UTC |

---

**Fin del cierre Sprint 2.7.**
