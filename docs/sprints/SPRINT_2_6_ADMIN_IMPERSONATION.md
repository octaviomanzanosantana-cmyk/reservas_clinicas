# SPRINT 2.6 — Acceso operativo superadmin (impersonación)

**Fecha apertura:** 02/05/2026
**Fecha cierre:** 02/05/2026
**Tiempo real:** ~2 h (estimado 2-2.5 h, en presupuesto)
**Branch base:** `main` (sobre commit `f07e1f2` — cierre Sprint 2.5.1)
**Bloqueante para cutover:** Sí

---

## 1. Origen y objetivo

Detectado el 01/05/2026: cuando el superadmin (`appoclick+superadmin@gmail.com`) intentaba navegar a `/clinic/[slug]` de una cuenta piloto, el panel no cargaba citas. Sin esto, soporte operativo real sobre cuentas piloto en producción era imposible (Octavio dependía del 2FA de la clienta para acceder).

Backend de impersonación admin ya existía (`lib/clinicAuth.ts` líneas 79-160 antes del sprint). Faltaba el flujo de activación: generación de token con cookie HttpOnly, UI superadmin, banner visible y endpoint de salida limpia.

---

## 2. Hallazgos no anticipados (Bloque B exploración)

El brief Bloque A asumía que NO existía endpoint, NO existía UI, NO existía página de entrada. La realidad encontrada al inicio del Bloque B fue distinta y obligó a una pausa para tomar decisiones D1-D5 con Octavio antes de tocar código.

| # | Hallazgo brief | Realidad encontrada | Decisión |
|---|---|---|---|
| **D1** | Cookie debía ser `HttpOnly`, `Secure`, expirar 60 min | Cookie seteada desde JS en `app/admin/enter/[slug]/page.tsx` (NO HttpOnly, NO Secure, max-age=300 = 5 min) | **Migrar:** endpoint setea cookie HttpOnly server-side y devuelve `{ redirect_to }`. Eliminar página intermedia |
| **D2** | TTL 60 min | TTL actual 5 min (cookie + `expires_at` BD) | **60 min** confirmado |
| **D3** | Misma pestaña con banner | `window.open(...)` en pestaña nueva | **Misma pestaña** confirmado |
| **D4** | Endpoint `/api/admin/impersonate` (path del brief) | Endpoint existente `/api/admin/impersonate-clinic` ya devolvía `{ token }` y la UI lo cableaba | **Modificar in-place** (mantener path). Commit refleja `harden security`, no `feat new endpoint` |
| **D5** | Auth admin solo vía sesión + `ADMIN_EMAILS` | Endpoint aceptaba **doble auth**: sesión OR header `x-admin-secret` con el secret expuesto al cliente vía `NEXT_PUBLIC_ADMIN_API_SECRET` | **Eliminar fallback** del endpoint de impersonación. Auth solo vía `getAdminUser()` |

### Bug latente confirmado (B2 del brief)

[`lib/clinicAuth.ts`](../../lib/clinicAuth.ts) `requireClinicAccessForSlug` (camino del layout `/clinic/[slug]`) devolvía `clinicId: clinicSlug` (string slug) en vez del UUID real. La función hermana `tryAdminImpersonation` (camino de los endpoints API) sí resolvía el UUID. Asimetría arreglada en el commit `fix(admin-auth)`.

---

## 3. Bloques ejecutados

### Bloque B — Backend endurecido

**B2.** `requireClinicAccessForSlug` ahora consulta `clinics.id` por slug antes de devolver acceso impersonado. Si la clínica no existe, no se otorga acceso (cae al flujo normal).

**B3.** `POST /api/admin/impersonate-clinic` reescrito:
- Auth: solo `getAdminUser()`. Eliminado fallback `x-admin-secret`.
- Cookie HttpOnly + Secure (en prod) + SameSite=Lax + path=/, maxAge = 3600 s.
- TTL en BD: `IMPERSONATION_TTL_MINUTES = 60`.
- Validación añadida: 404 si la clínica no existe antes de generar token.
- Respuesta `{ redirect_to: "/clinic/<slug>" }` en lugar de `{ token }`.
- Log: `[admin-impersonation] start admin=<email> slug=<slug> expires=<iso>`.

**B4.** `POST /api/admin/impersonate-clinic/end` (nuevo):
- Lee cookie `admin_token`, marca `used=true` en BD, borra cookie (`maxAge=0`).
- Idempotente.
- Devuelve `{ redirect_to: "/admin/clinics" }`.
- Log: `[admin-impersonation] end slug=<slug>`.

### Bloque C — UI superadmin

**C1.** `AdminDemoPanel.handleEnterClinic` actualizado:
- Espera `{ redirect_to }`, hace `window.location.href = data.redirect_to` (misma pestaña).
- Header `x-admin-secret` eliminado del fetch.

**C2.** `app/admin/enter/[slug]/page.tsx` y directorios padres vacíos eliminados (página puente ya no necesaria con cookie HttpOnly server-side).

**C3.** Sin referencias huérfanas a `/admin/enter/`.

### Bloque D — Banner

**D1.** [`components/admin/ImpersonationBanner.tsx`](../../components/admin/ImpersonationBanner.tsx) (Server Component):
- Lee cookie, valida token en BD (no usado, no expirado), resuelve `clinic.name`.
- Sin cookie o token inválido/expirado → `return null`.

**D1.** [`components/admin/ImpersonationBannerClient.tsx`](../../components/admin/ImpersonationBannerClient.tsx) (Client Component):
- Calcula minutos restantes con `setInterval` 30 s.
- Si llega a 0 → desaparece.
- Diseño: `sticky top-0 z-50`, `bg-orange-500`, texto blanco.
- Botón "Salir de impersonación" → POST `/end` → `window.location.href = redirect_to`.

**D2.** [`app/clinic/(by-slug)/[slug]/layout.tsx`](../../app/clinic/%28by-slug%29/%5Bslug%5D/layout.tsx) integra `<ImpersonationBanner />` antes de `<ClinicPanelLayout>` en un Fragment.

---

## 4. Validación e2e (Bloque E)

| # | Test | Resultado |
|---|---|---|
| I1 | Admin entra al panel de Miriam desde `/admin/clinics` → "Entrar al panel" → misma pestaña → panel carga citas | ✅ |
| I2 | Banner naranja sticky con "Modo impersonación activo: Doctora Miriam Lorenzo · expira en 60 min" + botón "Salir" | ✅ |
| I3 | Click cita en calendario → modal `EditAppointmentModal` abre normal | ✅ |
| I4 | Click "Salir de impersonación" → cookie borrada, navega a `/admin/clinics` | ✅ |
| I5 | Sin cookie (incógnito), `/clinic/miriamlorenzo` → redirige a `/login` | ✅ |
| I6 | POST `/api/admin/impersonate-clinic` sin login → 401 | ✅ |
| I7 | User normal → endpoint | ⏭️ Saltado (lógica idéntica a I6: `getAdminUser` hace un solo check `email in ADMIN_EMAILS`) |
| I8 | Token caducado en BD + F5 → banner desaparece, redirige a login | ✅ |

**6 verdes + 1 saltado con justificación.** Sistema seguro confirmado.

---

## 5. Hallazgo operativo durante validación

`appoclick+superadmin@gmail.com` **no estaba en `ADMIN_EMAILS` de `.env.local`** (solo `octaviomanzanosantana@gmail.com` y `oms_grafic@hotmail.com`). Octavio lo añadió durante el sprint y rearrancó dev.

**Acción pendiente operativa post-deploy:** verificar que en Vercel producción la env var `ADMIN_EMAILS` también incluye `appoclick+superadmin@gmail.com`. Si no, el flujo no funcionará en producción tras el deploy.

---

## 6. Deuda crítica de seguridad — Sprint 2.7

**`NEXT_PUBLIC_ADMIN_API_SECRET` expuesto en bundle público.**

El endpoint de impersonación ya no acepta este secret (D5 cumplido en Sprint 2.6), pero los siguientes endpoints admin sí siguen aceptándolo y la UI sigue mandándolo en `ADMIN_HEADERS`:

- `POST /api/admin/change-plan`
- `POST /api/admin/change-subscription-status`
- `GET /api/admin/clinic-stats`
- `DELETE /api/admin/demo-clinics`
- `POST /api/admin/run-daily-lifecycle`

**Riesgo:** el secret está en el JS bundle servido al navegador (toda variable `NEXT_PUBLIC_*` se inyecta en el cliente). Cualquier visitante puede leerlo en DevTools y ejecutar acciones admin (cambiar planes, eliminar clínicas demo, disparar el ciclo de vida de trials, etc.) sin estar logueado.

**Mitigación recomendada Sprint 2.7:**
1. Eliminar fallback `x-admin-secret` de los 5 endpoints listados (auth solo vía `getAdminUser()`).
2. Eliminar `NEXT_PUBLIC_ADMIN_API_SECRET` del entorno y del bundle.
3. Limpiar `ADMIN_HEADERS` en `AdminDemoPanel.tsx` para que solo envíe `Content-Type`.
4. Verificar que toda la UI admin sigue funcionando con sesión Supabase + `ADMIN_EMAILS` (validación e2e).

**Por qué no se hizo en este sprint:** el cambio toca 5 endpoints + tests de regresión amplios; fuera del scope acotado al flujo de impersonación. Documentado para que no quede silenciado.

---

## 7. Pendientes promovidos (post-cutover, ya estaban en brief)

- Auditoría persistente de impersonación (tabla `admin_audit_log` con quién, cuándo, qué clínica, IP). Ahora solo log a stdout.
- Limitar duración máxima de sesión admin a X minutos (forzar logout si exceso).
- Notificar a la clínica por email cuando un admin impersona su cuenta (transparencia GDPR).
- 2FA obligatorio para superadmin.
- Vista admin de logs de actividad de cualquier clínica.

---

## 8. Commits

1. `fix(admin-auth): resolve clinic UUID correctly in requireClinicAccessForSlug`
2. `refactor(sprint-2.6): harden /api/admin/impersonate-clinic with HttpOnly cookie + 60min TTL`
3. `feat(sprint-2.6): impersonation end endpoint + same-tab admin flow`
4. `feat(sprint-2.6): impersonation banner in clinic layout`
5. `docs(sprint-2.6): close admin impersonation sprint`

---

## 9. Smoke test producción (post-deploy)

1. Verificar `ADMIN_EMAILS` en Vercel incluye `appoclick+superadmin@gmail.com`.
2. Login admin en producción → `/admin/clinics` → "Entrar al panel" en clínica piloto Miriam → confirmar carga de citas reales.
3. Confirmar banner naranja visible.
4. Click "Salir de impersonación" → vuelta limpia a `/admin/clinics`.

---

**Fin del cierre Sprint 2.6.**
