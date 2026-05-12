# Sprint Fix Signup Flow — bucle infinito post-confirmación

**Fecha:** 12 mayo 2026
**Estado:** CERRADO (smoke propio OK; validación social José pendiente, no bloqueante)
**Sprint:** Fix Signup Flow (crítico pre-S8)
**HEAD origin/main al inicio:** `40b6333`
**HEAD post-fix:** `5a04e19`
**Commit fix:** `5a04e19` — `fix(auth): break signup loop when clinic provisioning incomplete`

---

## 1. Síntoma reportado

Compañero José (jvillar@aqia.es) intenta registrarse el 12/5 ~14:35 UTC:

1. Llena `/register` (email + password + clinic_name + DPA).
2. Recibe email de confirmación.
3. Click en "Confirmar email" → vuelve a `/login`.
4. Login con credenciales → recarga sin entrar.
5. A veces pide código 2FA por email; introducirlo → vuelve a `/login`.
6. Bucle indefinido.

Mismo patrón confirmado para **sellarco@gmail.com** (mismo usuario, intento previo el 12/5 11:55 UTC). Confirmado por Octavio que ambos emails son la misma persona física (José, AQIA).

Evidencia SQL al iniciar el sprint: ninguna `clinic` creada en las ventanas afectadas, y los users existían en `auth.users` con `email_confirmed_at` seteado pero sin fila en `clinic_users`.

---

## 2. Causa raíz — doble, ambos lados deben repararse

### 2.1 Causa A — bucle infinito en `lib/clinicAuth.ts:78`

[lib/clinicAuth.ts:78](../../lib/clinicAuth.ts#L78) (pre-fix) ejecutaba `redirect("/login")` cuando un user autenticado, con email confirmado, no tenía fila en `clinic_users`. Path del bucle:

```
/clinic/* → middleware deja pasar (user válido + email_confirmed)
         → layout RSC → requireClinicAccessForSlug
         → requireCurrentClinicForRequest
         → getCurrentClinicForUser → null (no clinic_users)
         → tryAdminImpersonation → null
         → redirect("/login")  ← AQUÍ
/login   → submit OK → /clinic/* → vuelta a empezar
```

Loop infinito garantizado para cualquier user en estado "auth válido + email confirmado + sin clinic_users".

### 2.2 Causa B (H10) — template Supabase enviaba a su path nativo

El email "Confirm signup" en Supabase Dashboard tenía el template default:

```html
<a href="{{ .ConfirmationURL }}">Confirm your mail</a>
```

`{{ .ConfirmationURL }}` resuelve a `https://<project>.supabase.co/auth/v1/verify?token=...&type=signup&redirect_to=<Site URL>`. Mecánica:

1. User click → request directo a `/auth/v1/verify` de Supabase.
2. Supabase verifica el token → setea `email_confirmed_at`.
3. Supabase redirige a Site URL (`https://app.appoclick.com/`, raíz).
4. **El endpoint custom `/auth/confirm` nunca se invoca** — es justo el endpoint que ejecuta `createClinic` + insert `clinic_users` (ver [app/auth/confirm/route.ts:115-141](../../app/auth/confirm/route.ts#L115-L141)).
5. User llega a `/` autenticado pero sin clínica → home redirige a `/login` → loop por Causa A.

El email custom (Resend) sí construye `/auth/confirm?token_hash=...&type=signup` correctamente ([app/api/register/route.ts:169-171](../../app/api/register/route.ts#L169-L171)), pero José (y casi seguro otros) hizo click en el email auto-Supabase, no en el custom.

### Por qué hay que arreglar **ambas**

- Solo Causa B (template) → futuros signups OK, pero **cualquier provisioning fallido futuro por otra razón** (DB transient, deploy a medias) deja al user en bucle infinito.
- Solo Causa A (redirect) → rompe el bucle pero el provisioning sigue sin ejecutarse en signups, así que el user cae siempre en pantalla de error.
- **A + B**: signups happy path correctos + sistema robusto ante fallos parciales.

---

## 3. Evidencia (FASE 1 audit-first)

### 3.1 Logs Supabase Auth (12/5 14:35-15:16 UTC, retention 1h plan Free)

Para `user_id dc616fef-a7fc-4bcc-9e4f-34292ee9d761` (jvillar):

- 8+ eventos "Login" exitosos entre 14:36:42 y 14:38:46 UTC, path `/token`, status 200, grant_type password.
- GET `/user` posteriores todos status 200.
- IP origen del user: `62.43.185.6` (consistente, mismo dispositivo).
- **Cero eventos** de `signup`, `verifyOtp`, ni `email_confirmation` visibles en la ventana disponible.
- Eventos del signup inicial (14:35) fuera de retention.

Interpretación: auth Supabase funciona correctamente; el user obtiene token cada login. El bucle es 100% lado Next.js (Causa A).

### 3.2 Capturas Dashboard Supabase (cierre H10)

**Auth → Email Templates → Confirm signup (pre-fix):**

```html
<h2>Confirm your signup</h2>
<p>Follow this link to confirm your user:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your mail</a></p>
```

**Auth → URL Configuration:**

- Site URL: `https://app.appoclick.com`
- Redirect URLs: `https://app.appoclick.com/**` (wildcard)

H10 confirmado al 100% por la presencia de `{{ .ConfirmationURL }}` (no `{{ .TokenHash }}` a path custom).

### 3.3 Estado users afectados (SQL pre-DELETE)

| user_id | email | email_confirmed_at | has_clinic_users_row | has_clinic |
|---|---|---|---|---|
| dc616fef-a7fc-4bcc-9e4f-34292ee9d761 | jvillar@aqia.es | 2026-05-12 14:36:12 | false | false |
| `(obtenido por SELECT 4.a)` | sellarco@gmail.com | 2026-05-12 11:56 | false | false |

Confirmado: `clinic_users` **no tenía fila** (no es "fila con clinic_id NULL" como sugería la query inicial; era LEFT JOIN devolviendo nulls por fila inexistente). Schema [supabase/migrations/20260328_create_clinic_users.sql:5](../../supabase/migrations/20260328_create_clinic_users.sql#L5) define `clinic_id uuid NOT NULL` — una fila con clinic_id null es físicamente imposible.

---

## 4. Plan ejecutado: A + D2c

### Decisión de scope (P12)

| Opción | Decisión | Razón |
|---|---|---|
| A — redirect destino seguro | ✅ Aplicada | Mínima, rompe bucle |
| C — endpoint self-heal `/api/auth/complete-signup` | ❌ Descartada | Scope creep. No necesaria si A+D2c cubren happy path y casos rotos están limpiados (José se re-registra). |
| D2c — template Supabase a `/auth/confirm` | ✅ Aplicada | Arregla raíz de Causa B. Manual Dashboard. |
| B — self-heal in-place en clinicAuth | ❌ Descartada | Mete escritura en helper de auth. Anti-patrón. |

### 4.1 Cambios de código (commit `5a04e19`)

**[lib/clinicAuth.ts:78](../../lib/clinicAuth.ts#L78):**

```diff
-  redirect("/login");
+  // User autenticado pero sin clinic_users (provisioning incompleto del signup,
+  // p.ej. confirmación vía path Supabase nativo que se salta /auth/confirm).
+  // Redirigir a /login crea bucle: login OK → /clinic → aquí → /login → ...
+  // /verify-email con ?error= muestra CTA reenviar email; si no hay sesión
+  // real, su useEffect detecta !user y redirige a /login (1 hop extra, OK).
+  redirect("/verify-email?error=no_clinic_provisioned");
```

**[app/verify-email/page.tsx](../../app/verify-email/page.tsx):**

Reestructura completa:

- Extracción a `VerifyEmailContent` envuelto en `<Suspense fallback={null}>` (requisito Next 15 para `useSearchParams` en client component).
- Helper `normalizeErrorCode` mapea 4 codes conocidos (`no_clinic_provisioned`, `invalid_link`, `verify_failed`, `provisioning_failed`) + fallback `unknown`.
- Constante `ERROR_COPY` con título + mensaje por code.
- `useEffect` modificado: si `errorCode` presente, **no** autoredirige a `/clinic` aunque `email_confirmed_at` esté seteado. Esto rompe el bucle latente `/clinic → /verify-email → /clinic`.
- CTA principal: "Reenviar email de verificación" reutiliza `handleResend` existente. Self-heal con un click: tras D2c, el reenvío sí lleva a `/auth/confirm`.
- CTA secundaria: "Cerrar sesión" preservada.

Net diff: +92 -17 (2 archivos).

### 4.2 Cambios manuales Dashboard Supabase (D2c)

**Auth → Email Templates → Confirm signup** — HTML reemplazado por versión idéntica al email custom Resend, pero usando variables Supabase:

```html
<h1 style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#1A1A1A;line-height:1.3;">
  Confirma tu email y activa tu panel AppoClick
</h1>
<p style="margin:0 0 20px;...">
  Bienvenido a AppoClick. Para activar tu panel y empezar a recibir reservas, confirma tu email pulsando el botón:
</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
  <tr>
    <td style="background-color:#0E9E82;border-radius:10px;">
      <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup"
         style="...">Confirmar mi email</a>
    </td>
  </tr>
</table>
<!-- ... fallback link + footer expiración 24h + disclaimer ... -->
```

**Subject:** `Confirma tu email — AppoClick`

**Contract `/auth/confirm` ↔ `{{ .TokenHash }}`:** `verifyOtp({ type: "signup", token_hash })` es la API canónica Supabase ([app/auth/confirm/route.ts:70-73](../../app/auth/confirm/route.ts#L70-L73)). Compatible 1:1 sin tocar código del endpoint.

**Auth → URL Configuration:** sin cambios. Site URL y wildcard ya correctos.

### 4.3 DELETE users rotos

Ejecutado post-deploy + post-D2c, envuelto en transacción:

```sql
begin;
-- sanity check 0 filas:
select c.id, c.slug, c.name, c.created_at
from public.clinics c
join public.clinic_users cu on cu.clinic_id = c.id
where cu.user_id in (
  'dc616fef-a7fc-4bcc-9e4f-34292ee9d761',
  '<user_id_sellarco>'
);
-- → 0 filas confirmado (no hay clinics que limpiar)

delete from auth.users
where id in (
  'dc616fef-a7fc-4bcc-9e4f-34292ee9d761',  -- jvillar@aqia.es
  '<user_id_sellarco>'                      -- sellarco@gmail.com
);
-- → DELETE 2 confirmado

commit;
```

`ON DELETE CASCADE` en `clinic_users` ([supabase/migrations/20260328_create_clinic_users.sql:6](../../supabase/migrations/20260328_create_clinic_users.sql#L6)) limpia membresías. No había clinics asociadas (consecuencia de Causa B), nada más que limpiar.

**No se tocaron** `appoclick+rotationtest` ni `appoclick+rotationretest` del 9/5 — son test data histórica del revert B7.1, no producción real.

---

## 5. Validación

### 5.1 Pre-commit

- `tsc --noEmit`: silent success, 0 errores.
- `next build`: `Compiled successfully in 9.4s`, 86 static pages, `/verify-email` sigue `○ Static` con `1.91 kB`. Sin warnings nuevos (los 15 preexistentes no tocan archivos modificados). Sin nuevas rutas.

### 5.2 Validación visual local — pausada por env local roto

Login local falla con "Unregistered API key" tras rotación secretos del 11/5. Deuda Tier 2 preexistente (ver T2-SIGNUP-1). Decisión: P15 modificado, **validación diferida a producción**.

### 5.3 Smoke producción end-to-end (Octavio, post-deploy + post-D2c)

| Paso | Resultado |
|---|---|
| `/register` con email fresh | ✅ Form OK, 201 |
| Email recibido | ✅ Subject `Confirma tu email — AppoClick`, link a `app.appoclick.com/auth/confirm?token_hash=...&type=signup` |
| Click botón → `/auth/confirm` | ✅ verifyOtp OK, `createClinic` + insert `clinic_users` ejecutados |
| Redirect post-confirm | ✅ `/clinic/<slug>` sin pasar por `/login` |
| Sesión activa | ✅ Panel accesible, sin bucle |

Doble causa raíz erradicada.

### 5.4 Pendiente no bloqueante

- **Validación social José** (~5 min cuando le venga bien): re-registrarse desde cero como caso real reproductor original. No bloquea S8 ni cierre de sprint.

---

## 6. Items NO aplicados (con razón explícita)

### Opción C — endpoint `/api/auth/complete-signup` para self-heal server-side

Descartada por **scope creep** bajo P12. C habría sido un nuevo endpoint que ejecuta el mismo provisioning de `/auth/confirm` para users con sesión válida pero sin clínica. Razones para no incluirlo:

- A + D2c cubren happy path futuro (D2c) y rompen el bucle ante cualquier fallo parcial (A → user llega a `/verify-email` con CTA reenviar).
- El CTA "Reenviar email de verificación" en `/verify-email` ya es self-heal de un click: tras D2c el reenvío lleva a `/auth/confirm` correcto.
- Los 2 users rotos identificados (jvillar, sellarco) son la misma persona y se gestionaron por DELETE + re-registro.
- C añade superficie de mantenimiento (3 archivos nuevos: endpoint, página de finalización, lógica de redirect en clinicAuth con auth.getUser extra) sin upside actual.

Si en algún sprint futuro aparecen casos rotos en masa sin causa raíz Supabase template (que ya está arreglada), reabrir C.

### Migration BD para hacer signup atómico

Considerada brevemente: trigger BD sobre `auth.users.AFTER INSERT` que cree `clinics` + `clinic_users` desde `raw_user_meta_data`. Descartada porque:

- Mete lógica de aplicación en BD (anti-patrón en stack actual).
- Acopla schema a flow específico de signup.
- D2c + `/auth/confirm` ya garantiza atomicidad funcional sin trigger.

---

## 7. Hallazgos Tier 2 derivados

### T2-SIGNUP-1 — Env local desactualizado tras rotación secretos 11/5

Login local falla con "Unregistered API key". Tras rotación de secretos del 11/5 (Stripe + Supabase), el `.env.local` no se actualizó. Bloqueó la validación visual P15 en este sprint, forzando validación diferida a producción.

**Acción Tier 2** (decisión Octavio + Claude.ai durante el sprint): evaluar **separar BD dev de producción** como solución estructural. Mientras no se separe, `.env.local` necesita re-sync manual tras cada rotación.

### T2-SIGNUP-2 — Warning preexistente `edge runtime disables static generation`

Build emite:

```
⚠ Using edge runtime on a page currently disables static generation for that page
```

Preexistente al sprint, no causado por los cambios. Probablemente middleware u otra ruta con `runtime: 'edge'`. Apuntado para revisión en sprint de limpieza.

### T2-SIGNUP-3 — 15 warnings ESLint preexistentes

Lista completa en el output de `next build` del paso 5.1: useMemo missing deps, `<img>` vs `next/image`, unused vars/imports. Ninguno crítico, ninguno bloquea cutover. Limpiar en sprint dedicado.

### T2-SIGNUP-4 — `RegisterForm` importa `useRouter` sin usarlo

[components/auth/RegisterForm.tsx:8](../../components/auth/RegisterForm.tsx#L8) declara `const router = useRouter()` y nunca lo usa. Trivial, parte de T2-SIGNUP-3.

---

## 8. Criterio de cierre

### Sprint cerrado parcial (este doc)

- [x] Doble causa raíz identificada y documentada (Causa A bucle redirect + Causa B / H10 template Supabase)
- [x] Fix código aplicado y desplegado (commit `5a04e19`, push `40b6333..5a04e19`)
- [x] D2c template Supabase aplicado en Dashboard
- [x] DELETE jvillar + sellarco ejecutado, transacción verificada
- [x] Smoke propio end-to-end OK (Octavio, post-deploy)
- [x] Doc de cierre publicado

### Sprint cerrado total (post-validación social)

- [ ] José re-registrado de cero sin incidencia (no bloqueante)

---

## 9. Impacto en cutover S8

**S8 desbloqueado en este aspecto.** Bloqueantes no-técnicos S8 que siguen pendientes (fuera de scope de este sprint):

- Buzón `hola@appoclick.com` aún sin configurar.
- Legal: revisión Davinia (asesoría externa) de DPA v1.5 final.
- Firma DPA Miriam + Symbios.

Sprint adicional pre-S8 identificado: **Sprint RLS Hardening** (5 tablas con `RLS DISABLED` documentadas en T2-RLS-6 del Sprint Fix RLS Performance: `google_calendar_tokens`, `impersonation_tokens`, `login_attempts`, `patient_deletion_log`, `two_factor_codes`).

---

## 10. Referencias

- Commit fix: `5a04e19` — `fix(auth): break signup loop when clinic provisioning incomplete`
- HEAD pre-fix: `40b6333` — sprint anterior cerrado (Fix RLS Performance)
- Archivos modificados:
  - [lib/clinicAuth.ts](../../lib/clinicAuth.ts)
  - [app/verify-email/page.tsx](../../app/verify-email/page.tsx)
- Endpoints implicados (sin cambios, validados compatibles):
  - [app/api/register/route.ts](../../app/api/register/route.ts) — flujo público signup (genera link custom)
  - [app/auth/confirm/route.ts](../../app/auth/confirm/route.ts) — provisioning post-verifyOtp
  - [components/auth/RegisterForm.tsx](../../components/auth/RegisterForm.tsx) — frontend
  - [middleware.ts](../../middleware.ts) — gate auth + email_confirmed
- Sprint relacionado (paralelo, ya cerrado parcial): [SPRINT_FIX_RLS_PERFORMANCE.md](SPRINT_FIX_RLS_PERFORMANCE.md)
- Sprint madre del 12/5: [SPRINT_BUG_INVESTIGATION.md](SPRINT_BUG_INVESTIGATION.md)
