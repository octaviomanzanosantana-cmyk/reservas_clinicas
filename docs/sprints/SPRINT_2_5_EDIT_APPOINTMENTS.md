# SPRINT 2.5 — Editar fecha/hora de cita desde panel clínica

**Fecha apertura:** 01/05/2026
**Branch base:** `main`
**Predecesor:** Sprint 2 cerrado
**Bloqueante para cutover:** No (mejora UX, demos BNI)

---

## 1. Problema

En `ClinicCalendarPage.tsx`, el click sobre una cita usaba `<Link href="/a/${token}">` y redirigía al flujo paciente. La clínica no podía editar fecha/hora desde su propio panel sin pedir al paciente que lo hiciera.

`EditPatientModal` (mal nombrada — en realidad editaba "cita": paciente + modalidad + video link) ya existía y se usaba desde `ClinicDashboardPage` y `ClinicPatientsPage`. Sprint 2.5 la **extiende** para cubrir también fecha/hora, en lugar de crear una modal nueva, y la renombra a `EditAppointmentModal`.

---

## 2. Hallazgos Bloque A (cerrados pre-implementación)

| # | Hallazgo | Implicación |
|---|---|---|
| 1 | `<Link href="/a/${token}">` aparece **2 veces** en `ClinicCalendarPage.tsx` (vista día y vista semana). NO en otros archivos | 2 reemplazos en un único archivo |
| 2 | `ClinicDashboardPage.tsx` ya usa `EditPatientModal` con callback `handleSavePatient` | Patrón establecido, replicar |
| 3 | `EditPatientModal` también se usa en `ClinicPatientsPage.tsx` (no contemplado en brief original) | Render condicional con `onReschedule` opcional para no romper esa página |
| 4 | Endpoint actual `/api/appointments/update-patient` cubre paciente + modalidad + video. NO mezclar con reschedule | Crear endpoint nuevo para reagendar |
| 5 | `appointments.scheduled_at timestamptz` (UN campo). `updated_at` y `reminder_sent_at` ya existen, `datetime_label` duplicado de `scheduled_at` | Solo migrar `updated_by_clinic_user_id`. Regenerar `datetime_label` derivado |
| 6 | Cron `app/api/cron/appointment-reminders/route.ts` usa `reminder_sent_at` como guard | Reset a NULL al reagendar para que cron mande nuevo recordatorio |
| 7 | Endpoint `/api/availability` interno reutilizable como HTTP (`?clinicSlug=&date=&service=&excludeToken=`) | Reuso desde modal |
| 8 | Hallazgo no anticipado: **endpoint `/api/appointments/reschedule` ya existe** y lo consume el flujo paciente (`/a/[token]/reschedule/page.tsx`) | Decisión arquitectónica con Octavio (ver §3) |
| 9 | `appointments.clinic_id text NULL` sin FK a `clinics(id)`. Deuda histórica | NO tocar en este sprint |
| 10 | Sin triggers ni webhooks sobre `UPDATE appointments` (solo `tax_data_updated_at_trigger` existe) | Sin riesgo de doble disparo en B4 |

---

## 3. Decisiones cerradas

| Decisión | Resolución |
|---|---|
| Naming endpoint clínica | **`POST /api/clinic/appointments/reschedule`** — namespace `/api/clinic/...` inaugurado en este sprint. Justificación: namespace escala mejor que sufijo (`-by-clinic`), separación clara de endpoints públicos vs autenticados, facilita futuros endpoints del panel (Sprint 3, 4, 6, Holded, WhatsApp). El endpoint `/api/appointments/reschedule` (flujo paciente) queda intacto |
| Tono email | Reusar `sendAppointmentRescheduledEmail` ya existente — ya es neutro ("Tu cita ha sido reprogramada"). No se añade template nuevo |
| Campos editables | Solo `scheduled_at`. Regenerar `datetime_label` derivado vía `buildDateTimeLabel` |
| Notificación al paciente | Checkbox "Notificar al paciente del cambio" marcado por defecto |
| `reminder_sent_at` al reagendar | Reset a NULL. Cron disparará nuevo recordatorio cuando entre ventana 24-48 h de la nueva fecha |
| Auditoría | `updated_at = NOW()` (ya gestionado en `lib/appointments`) + nueva columna `updated_by_clinic_user_id` (FK a `clinic_users(id) ON DELETE SET NULL`) |
| Estados editables | Solo `confirmed` y `pending`. Bloqueado en `completed`, `cancelled`, `no_show` |
| Citas pasadas | No editables (validación servidor + bloqueo UI) |
| Modal | Renombrada `EditPatientModal` → `EditAppointmentModal`. Estructura interna en 2 secciones con su propio botón cada una. `onReschedule` es opcional: `ClinicPatientsPage` no lo pasa (esa página solo edita datos paciente) |
| Click handler en calendario | `handleAppointmentClick` extraído como callback. Cualquier vista futura (mes, 3 meses) lo importa sin reescribir lógica |
| Tocar `/a/[token]` | NO tocado |

---

## 4. Archivos modificados

### Nuevos
- `supabase/migrations/20260501113041_add_updated_by_clinic_user_id.sql` — migración versionada (pendiente aplicar manualmente, ver §6)
- `lib/appointmentReschedule.ts` — 3 helpers compartidos: `validateSlotAvailable`, `regenerateDatetimeLabel`, `applyRescheduleUpdate`
- `app/api/clinic/appointments/reschedule/route.ts` — endpoint clínica autenticado
- `components/clinic/EditAppointmentModal.tsx` — modal renombrado con sección reschedule
- `docs/sprints/SPRINT_2_5_EDIT_APPOINTMENTS.md` — este documento

### Eliminados
- `components/clinic/EditPatientModal.tsx` — renombrado a `EditAppointmentModal.tsx`

### Modificados
- `components/clinic/ClinicCalendarPage.tsx` — helper `handleAppointmentClick`, reemplazo de 2 `<Link>` por `<button>` (preservando `title` tooltip), render del modal, `handleSavePatient` y `handleReschedule` callbacks, toast feedback, `reloadCounter` para refrescar datos
- `components/clinic/ClinicDashboardPage.tsx` — import renombrado, prop `onSave` → `onSavePatient`, añadido `handleReschedule` y prop `clinicSlug`
- `components/clinic/ClinicPatientsPage.tsx` — import renombrado, prop `onSave` → `onSavePatient`, añadido `clinicSlug` (sin `onReschedule`)
- `app/api/appointments/by-date/route.ts` — SELECT extendido con `patient_email` y `video_link` (necesarios para alimentar el modal desde calendario)

---

## 5. Validaciones del endpoint `/api/clinic/appointments/reschedule`

Orden estricto (todos errores con código + mensaje claro):
1. Auth: `requireCurrentClinicForApi` → 401 si no autenticado
2. Body: `token` y `new_scheduled_at` requeridos → 400
3. Cita existe → 404
4. `current.clinic_id === access.clinicId` → 403 si no
5. `status` ∈ {`confirmed`, `pending`} → 400 "No se puede mover una cita ya completada o cancelada"
6. Cita actual no pasada → 400 "No se puede mover una cita ya pasada"
7. Nueva fecha no pasada → 400 "La nueva fecha no puede ser anterior a hoy"
8. Slot disponible (vía `validateSlotAvailable` → reusa `getAvailableSlotsForClinicDate` que ya valida horario clínica + bloques de vacaciones + colisiones) → 409 "Ese horario ya está ocupado o no encaja con los horarios de la clínica"
9. UPDATE atómico vía `applyRescheduleUpdate` (`scheduled_at`, `datetime_label` regenerado, `reminder_sent_at = NULL`, `updated_at = NOW()`, `updated_by_clinic_user_id`)
10. Sincronizar Google Calendar si `google_event_id` (no bloqueante, devuelve `calendarWarning`)
11. Email vía `sendAppointmentRescheduledEmail` si `notify_patient !== false` (no bloqueante)

---

## 6. SQL pendiente de aplicar manualmente en Supabase

Pegar en Supabase SQL Editor:

```sql
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS updated_by_clinic_user_id UUID
  REFERENCES public.clinic_users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.appointments.updated_by_clinic_user_id IS
  'Último usuario de la clínica que editó la cita (reschedule, update-patient futuro). NULL si la última edición no vino del panel clínica (ej. paciente reagendando desde /a/[token]).';
```

Comportamiento esperado: idempotente (`IF NOT EXISTS`), sin downtime, sin lock de tabla relevante. Reversible vía `ALTER TABLE ... DROP COLUMN updated_by_clinic_user_id;`.

---

## 7. Tests e2e (D1-D10)

Ejecutados pre-commit con cuenta `appoclick+test25@gmail.com`. SQL aplicado en Supabase antes de validación.

### Críticos pasados ✅

| # | Test | Resultado |
|---|---|---|
| D1 | Editar fecha/hora futura confirmada con `notify=true` | ✅ Cita movida lunes 4 mayo 10:00 → miércoles 6 mayo 12:00. Modal cerró, toast verde, email recibido con datos correctos, calendario refrescado |
| D5 | Mover a slot ocupado | ✅ Capa 1: `/api/availability` filtra slot ocupado (no aparece en UI). Capa 2: POST directo a `/api/clinic/appointments/reschedule` con slot ocupado devuelve 409 Conflict |
| D7 | Persistencia BD post-edit | ✅ `scheduled_at` actualizado, `datetime_label` regenerado ("Miércoles · 12:00"), `reminder_sent_at = NULL`, `updated_at` reciente, `updated_by_clinic_user_id = 7a53debf-e5f9-4813-a97e-2a4216ab1a29`, `created_at` intacto, `status='confirmed'` |
| D8 | Click desde vista día Y vista semana | ✅ Ambas vistas del calendario abren la modal idéntica. Ninguna redirige a `/a/[token]` |

### Pendientes post-commit (no bloqueantes para cierre del sprint)

| # | Test | Resultado esperado |
|---|---|---|
| D2 | Editar con `notify=false` | BD actualizada, NO email enviado |
| D3 | Editar cita pasada | 400 "No se puede mover una cita ya pasada" |
| D4 | Editar cita cancelada | 400 "No se puede mover una cita ya completada o cancelada" |
| D6 | Mover a fecha pasada | 400 "La nueva fecha no puede ser anterior a hoy" |
| D9 | Cita con `reminder_sent_at` ya rellenado, mover a +5 días | `reminder_sent_at = NULL`. Cron enviará nuevo recordatorio en ventana 24-48 h de la nueva fecha |
| D10 | Editar paciente sin tocar fecha/hora | Solo `update-patient` llamado. Verifica separación de secciones |

---

## 8. Pendientes promovidos

### Sprint 2.5.1 — Pulido UX modal (hallazgos durante validación 01/05/2026)

Detectados durante tests críticos D1/D5/D7/D8. NO bloquean el cierre de Sprint 2.5 — la modal funciona correctamente, son mejoras de comodidad:

- **Modal alta con scroll vertical**: la grilla de slots disponibles infla la modal por encima del viewport. Considerar grid de slots con `max-height` + scroll interno propio, o reducir tamaño de los chips
- **Sin X de cerrar arriba a la derecha**: solo hay botón "Cerrar" al fondo, lo que obliga a buscarlo
- **Click en backdrop no cierra modal**: comportamiento estándar de modales no implementado
- **Botón "Cerrar" abajo del todo**: requiere scroll para alcanzarlo cuando hay muchos slots renderizados

Estimación 2.5.1: ~30 min, 1 commit en `EditAppointmentModal.tsx`. Se puede tomar antes o después del cutover Stripe LIVE — bajo riesgo, alta visibilidad.

### Post-cutover (sprints futuros)

- **Consolidar endpoint paciente con helpers compartidos**: `/api/appointments/reschedule` (paciente) actualmente duplica lógica que ya existe en `lib/appointmentReschedule.ts`. Sprint dedicado post-cutover lo migrará. Decisión registrada: cuando se consolide, `resetReminder = true` también para el flujo paciente (mismo razonamiento que clínica — recordatorio del nuevo slot)
- Razón del cambio (campo opcional textarea + email)
- Histórico de cambios en tabla `appointment_changes`
- Cron detector de citas movidas a fechas pasadas
- Vistas mes/trimestre del calendario (FR2 Miriam, Tier 1 post-cutover)
- WhatsApp Business API: cuando esté integrado, resetear también `whatsapp_reminder_sent_at` al reagendar
- Limpieza de worktrees huérfanos `.claude/worktrees/*`
- Refactor `/api/availability` para extraer lógica a módulo reutilizable
- Resolver `appointments.clinic_id` como FK real (deuda histórica)

---

## 9. Lecciones / errores a evitar reproducidos

- ✅ `setReloadCounter((c) => c + 1)` post-éxito en calendario (lección B1 Sprint 2). El frontend Next.js no se refresca solo
- ✅ Endpoint específico (`/reschedule`) en namespace nuevo, no reutilización del genérico
- ✅ `/a/[token]` intacto — flujo paciente no tocado
- ✅ Modal claramente "panel admin" — preserva el estilo existente
- ✅ Email tono neutro: "Tu cita ha sido reprogramada", no "la clínica decidió"
- ✅ Permisos: `completed`/`cancelled`/`no_show` bloqueados en backend Y en UI
- ✅ `datetime_label` regenerado vía `buildDateTimeLabel` con timezone clínica
- ✅ `handleAppointmentClick` extraído como callback reutilizable

---

## 10. Cierre

- `tsc --noEmit` verde antes y después
- Commits atómicos (ver historial git)
- Bloqueante: aplicar SQL en Supabase antes de validación e2e
