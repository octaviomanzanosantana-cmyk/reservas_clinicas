# Sprint Fix Doble Booking (parte 1 de 2 — código)

**Fecha cierre:** 28 mayo 2026
**Branch:** main
**Commits (en orden):** `22af5c4`, `562b29c`, `c70b7c9`
**Deploy:** pendiente push (3 commits acumulados en local; GitHub HTTPS auth roto en la máquina local).
**Bloqueante para soft launch S8:** No — el incidente está contenido (1 par duplicado conocido, Isabelle+Rosa), el fix de código cierra los dos agujeros conocidos.

---

## 1. Contexto

Incidente real reportado por clínica Miriam Lorenzo: dos citas con `status='confirmed'` sobre el mismo slot (jueves **28/5/2026 08:00 UTC = 09:00 Canarias**, mismo `clinic_id`, mismo `scheduled_at`).

- **Isabelle Garbisu**, primera_visita, `confirmed`, created 15 may, updated 27 may 08:56.
- **Rosa Hernández Hernández**, revisión, `confirmed`, created 26 may 20:45, nunca modificada.

El email de cancelación recibido por la paciente Isabelle fue real: en algún momento entre el 15 y el 27 de mayo la cita pasó a `cancelled` (liberando el slot), Rosa reservó el slot vía endpoint público el 26 may, e Isabelle fue **rescatada** a `confirmed` el 27 may sin que el sistema revalidara que el slot ya estaba ocupado por Rosa.

Datos NO se tocan en este sprint — la decisión producto sobre cuál de las dos citas se cancela queda en manos de Miriam y se ejecutará en la parte 2 junto con el índice DB.

---

## 2. Causa raíz

Dos endpoints de **transición de estado** pasaban una cita a `'confirmed'` sin revalidar que el slot estuviera libre:

- **Agujero #4** — `POST /api/appointments/confirm` (paciente abre link del email). Llamado automáticamente desde `app/a/[token]/confirm/page.tsx` al cargar la página.
- **Agujero #5** — `POST /api/appointments/update-status` (panel clínica). Usado por dashboard y página pacientes para confirmar/cancelar/completar.

Ambos hacían directamente `updateAppointmentStatus(token, "confirmed")` sin query previa de colisión. Una cita en `cancelled` o `pending`/`change_requested` se podía resucitar a `confirmed` aunque el slot ya estuviera tomado por otra cita activa.

Síntoma adicional (que ocultó el bug en producción durante 24h): la vista de agenda del panel solo renderizaba **una** cita por slot, no todas — la clínica no vio que había dos pacientes apilados en jueves 09:00.

---

## 3. Auditoría PASOS 1-5

Disciplina audit-first (P11): cinco pasos gated antes de tocar código, con confirmación "OK paso N" entre cada uno y reporte de hallazgos sin proponer fix prematuro.

| Paso | Foco | Veredicto |
|---|---|---|
| 1 | `POST /api/appointments/create` (reserva pública + creación manual panel; ambas POSTean al mismo endpoint) | **OK.** Doble check de colisión (busy ranges del día + `eq scheduled_at + eq clinic_id + neq cancelled`). No es la fuente del incidente — confirmado en DB que `Rosa` no pudo haber entrado por aquí sin que el Check 2 disparara 409. |
| 2 | Resto de rutas que escriben en `appointments` | Mapa exhaustivo: 1 INSERT (create, OK), 2 UPDATEs de `scheduled_at` (reschedule paciente + reschedule clínica, **ambos validan** vía `getAvailableSlotsForClinicDate(excludeToken)`), **2 UPDATEs de `status` sin check de slot** = agujeros #4 y #5. Ninguna RPC SECURITY DEFINER toca `appointments`. |
| 3 | `getAvailableSlotsForClinicDate` (fuente de verdad de slots libres) | **OK.** Filtro `status !== 'cancelled'` cuenta `pending`/`change_requested`/`completed`/`no_show`/`NULL` como ocupados (comportamiento conservador correcto). `excludeToken` funciona por token exacto. Esta función NO se llama desde confirm/update-status — por eso los agujeros existen. |
| 4 | Render de agenda panel (síntoma visual) | **2 bugs simétricos.** `DayView.tsx` usa `Map<string, AppointmentRow>` singular: `map.set()` sobreescribe la segunda cita del slot. `WeekView.tsx` usa `.find()`: descarta la segunda silenciosamente. Ambos componentes reciben N citas correctamente desde `useCalendarData` — el bug es estrictamente de render. |
| 5 | Constraints / índices Postgres | **No existe UNIQUE constraint sobre `(clinic_id, scheduled_at)` ni equivalente.** Solo PK implícita en `id` + índice no-único `idx_appointments_whatsapp_reminder`. La DB no tiene red de seguridad contra doble booking. Análisis del índice parcial propuesto: viable con predicado `WHERE status IS DISTINCT FROM 'cancelled'` (cubre el caso `NULL`), pero bloqueado hasta limpiar el duplicado Isabelle/Rosa (un `CREATE UNIQUE INDEX` con duplicados existentes falla en seco). |

---

## 4. Fix aplicado — 3 commits atómicos

### 4.1 `22af5c4` — `fix(appointments): revalidate slot before confirming to prevent double booking`

Cierre agujero #4. Archivos:

- `app/api/appointments/confirm/route.ts` — antes de `updateAppointmentStatus(token, "confirmed")`, query directa de colisión:
  ```ts
  supabaseAdmin
    .from("appointments")
    .select("id")
    .eq("scheduled_at", current.scheduled_at)
    .eq("clinic_id", current.clinic_id)
    .neq("status", "cancelled")
    .neq("token", current.token)
    .limit(1)
    .maybeSingle()
  ```
  Solo se ejecuta si `current.status !== "confirmed"` (idempotencia sobre confirmaciones repetidas) y si `scheduled_at`+`clinic_id` no son `NULL` (skip con `console.warn` para trazabilidad). En colisión: HTTP 409 `{ error: "slot_taken", message: "Este horario ya no está disponible." }`.
- `app/a/[token]/confirm/page.tsx` — detecta 409 con `error === "slot_taken"`, muestra bloque informativo dedicado ("Horario no disponible — Por favor, contacta con la clínica para reagendar tu cita.") en lugar del fallback genérico "Cita no encontrada".

Diff: 2 archivos, +64/-1.

### 4.2 `562b29c` — `fix(appointments): revalidate slot before clinic rescues cancelled appointment to confirmed`

Cierre agujero #5. Archivos:

- `app/api/appointments/update-status/route.ts` — mismo patrón de check que en confirm, **solo cuando** `body.status === "confirmed" && current.status !== "confirmed"`. Las transiciones a `cancelled` y `completed` NO revalidan (liberar/completar siempre permitido — crítico). Orden preservado: `assertCurrentClinicAccessForApi` corre antes del check de colisión, así una cita de otra clínica recibe 403 sin filtrar info de slots ajenos. Mensaje 409 orientado a la clínica: `"Ese horario ya está ocupado por otra cita. Cancela o reagenda la otra antes de confirmar esta."`
- `components/clinic/ClinicDashboardPage.tsx` y `components/clinic/ClinicPatientsPage.tsx` — el handler `handleAppointmentStatusUpdate` ahora prefiere `data.message` sobre `data.error` en el throw, para que el código técnico `"slot_taken"` no llegue al usuario. Cambio mínimo (1 línea por archivo + tipo del response extendido con `message?: string`).

Diff: 3 archivos, +39/-2.

### 4.3 `c70b7c9` — `fix(calendar): render all appointments per slot to surface double bookings`

Síntoma visual del PASO 4 audit. Archivos:

- `components/clinic/calendar/DayView.tsx` — tipo del Map cambiado a `Map<string, AppointmentRow[]>`, push acumulativo en lugar de `set`. Render con wrapper `<div className="space-y-2">` que mapea N tarjetas. Caso N=1 indistinguible visualmente del estado pre-fix (el wrapper sin segundo hijo no aplica `space-y-*`).
- `components/clinic/calendar/WeekView.tsx` — `.find()` → `.filter()`, wrapper `<div className="space-y-1.5">` + `.map()` con variant `compact`. CSS Grid garantiza alineación de columnas automáticamente: la fila con doble booking crece, las celdas vecinas del mismo timeLabel se estiran al mismo alto, las demás filas no se ven afectadas.

Sin estilos nuevos, sin tocar `AppointmentCard`, sin tocar `useCalendarData` ni backend. Scope mínimo intencionado: **opción A** (sin adorno visual de conflicto). Dos tarjetas con dos nombres distintos apiladas ya hacen el doble booking evidente sin tinta extra. Decisión sobre adornos (borde ámbar, etiqueta "Slot duplicado · N citas") queda diferida — la parte 2 con el índice DB elimina la posibilidad de nuevos doble bookings, por lo que el adorno tendría poco uso recurrente.

Diff: 2 archivos, +39/-24.

---

## 5. Validación

### 5.1 Build

`npx tsc --noEmit` limpio tras cada commit. `npx next build` compila sin errores. Los warnings que aparecen en los archivos tocados (`<img>` element en `ClinicDashboardPage.tsx:399`, `EditableAppointment` import no usado en `ClinicPatientsPage.tsx:3`, clases Tailwind canonicalizables en `DayView.tsx`) son **preexistentes**, fuera de las líneas modificadas en este sprint.

### 5.2 Validación visual P15 (PASO 3)

Impersonación Doctora Miriam, casos validados por Octavio:

- **Vista Día**, jueves 28/05/2026 09:00: muestra Isabelle Garbisu **y** Rosa Hernández apiladas en la celda derecha (sello de hora 112px a la izquierda centrado vertical respecto al stack).
- **Vista Semana**, semana 25-29/05: celda jueves 09:00 muestra ambas tarjetas `compact` apiladas; la fila 09:00 entera crece a esa altura; lunes/martes/miércoles/viernes 09:00 mantienen las columnas alineadas (CSS Grid).
- Cualquier otro slot con 1 cita: idéntico al estado pre-fix.
- Slots libres: siguen mostrando el link "Libre" sin cambio.

### 5.3 Lo que NO se validó (fuera de scope sprint)

- Test E2E de los endpoints (`confirm` con cita ya confirmada vía otra ruta — disparar 409 desde curl).
- Validación del flujo paciente con 409 (abrir link cuando el slot ya está ocupado por otra confirmed — comportamiento UI verificado en código, no en runtime).
- Carga de errores 5xx hipotéticos en la query del check.

---

## 6. PENDIENTE — parte 2 del sprint

**No ejecutado en este sprint, queda como parte 2:**

1. **Limpieza histórica del duplicado Isabelle/Rosa.** Decisión producto pendiente de Miriam: cuál de las dos citas mantiene `confirmed` y cuál pasa a `cancelled`. Acción manual desde panel clínica una vez decidido (los fixes de PASOS 1-2 ya impedirán que el rescate vuelva a generar el conflicto).
2. **Detección de otros duplicados preexistentes** vía la query Q4 del PASO 5 (`GROUP BY clinic_id, scheduled_at HAVING COUNT(*) > 1 AND status IS DISTINCT FROM 'cancelled'`). Si aparecen más casos en otras clínicas, limpieza coordinada antes del índice.
3. **Crear índice unique parcial** sobre `appointments`:
   ```sql
   CREATE UNIQUE INDEX idx_appointments_unique_active_slot
     ON public.appointments (clinic_id, scheduled_at)
     WHERE status IS DISTINCT FROM 'cancelled';
   ```
   Predicado refinado a `IS DISTINCT FROM` (cubre `NULL` como activo, defensa en profundidad). Bloqueado hasta cumplir (1) y (2): un `CREATE UNIQUE INDEX` con duplicados existentes falla en seco.
4. **Cerrar race condition residual.** Hoy los checks de colisión en `confirm`/`update-status` siguen siendo SELECT-then-UPDATE (no atómico). El índice de (3) es la única garantía DB contra dos requests confirm/update-status simultáneos sobre el mismo slot. Hasta entonces, riesgo teórico bajo (no es el patrón del incidente real, que es secuencial con 11 días de separación).

---

## 7. Hallazgos a backlog Tier 2

- **T2-APPT-STATUS-AUDIT-LOG** — No existe tabla de auditoría de transiciones de status. No hay forma de reconstruir "quién pasó Isabelle a cancelled y luego a confirmed" más allá del `updated_at` + `updated_by_clinic_user_id` (que solo guarda el último). Sin historial completo, los post-mortems de incidentes como este se basan en deducción de timestamps. Propuesta: tabla `appointment_status_log (id, appointment_token, old_status, new_status, changed_by, changed_at, source)` poblada vía trigger o vía endpoints.
- **T2-APPT-MULTI-STAFF-INDEX** — El índice unique de la parte 2 sobre `(clinic_id, scheduled_at)` es correcto **hoy** porque el modelo es 1:1 clinic↔user. Cuando llegue multi-staff (backlog Pro/Business), dos citas a la misma hora con profesionales distintos serán legítimas; el índice debe migrarse a `(clinic_id, staff_id, scheduled_at)`. Dependencia: cuando se introduzca columna `staff_id`/`professional_id` en `appointments`, migrar el índice en el mismo sprint.
- **T2-APPT-STATUS-NO-SHOW-CHECK-MISMATCH** — `lib/types.ts:AppointmentStatus` enumera `pending`/`confirmed`/`change_requested`/`cancelled`/`completed` (5 estados). `EditAppointmentModal.tsx:48` referencia `"no_show"` en `RESCHEDULE_BLOCKED_STATUSES`. El CHECK de la DB también limita a los 5 sin `no_show`. Discrepancia: o el código asume un estado que la DB nunca aceptará, o falta extender el enum + CHECK. Decidir cuál es la fuente de verdad y alinear.
- **T2-AVAILABILITY-TIMEZONE-LOCAL-DAY** — `isSameLocalDate` ([lib/availability.ts:174-180](lib/availability.ts#L174-L180)) y `startOfLocalDay`/`endOfNextLocalDay` ([lib/clinicAvailability.ts:51-61](lib/clinicAvailability.ts#L51-L61)) usan hora local del proceso Node (UTC en Vercel), no `clinic.timezone`. Para Canarias en horario de verano (UTC+1), una cita real a 00:30 local del día X (= 23:30Z del día X−1) se descartaría del día X en la query de slots libres. No aplica al incidente actual (08:00 está lejos del cambio de día) ni a las clínicas actuales (todas Canarias, citas en horario comercial). Riesgo latente si entra clínica peninsular o se permiten reservas nocturnas. Misma familia que **T2-CAL-ENDPOINT-TIMEZONE** del sprint vista Mes.
- **T2-APPT-CONFIRM-RACE** — El patrón SELECT-then-UPDATE en `confirm` y `update-status` deja una ventana teórica para race conditions concurrentes. El índice unique de la parte 2 lo cierra a nivel DB. Hasta entonces, anotado.
- **T2-APPT-CONFIRM-UI-CLINIC-CONTACT** — En el 409 `slot_taken` del flujo paciente (`app/a/[token]/confirm/page.tsx`), el mensaje genérico "contacta con la clínica" no incluye teléfono ni nombre. Decisión consciente del sprint para mantener scope mínimo. Mejora futura: devolver `clinic` en el 409 y mostrar contacto inline.
- **T2-CONFLICT-VISUAL-INDICATOR** — Opción B descartada en PASO 3b: borde ámbar / etiqueta "Slot duplicado · N citas" sobre el stack de tarjetas. Tras la parte 2 (índice unique), los doble bookings serán imposibles a nivel DB, así que la opción B tendría escaso uso recurrente. Reabrir solo si llega feedback de Miriam pidiendo señal visual explícita.

---

## 8. Reglas de oro validadas

- **P10 (1 sprint = 1 chat):** Sprint cerrado en una sola conversación, desde auditoría hasta los 3 commits atómicos.
- **P11 (audit-first):** 5 pasos de auditoría con "OK paso N" entre cada uno **antes** de tocar código. Cada paso reportaba hallazgos sin proponer fix prematuro; la causa raíz se confirmó por timestamps en DB tras el PASO 2, no por suposición.
- **P12 (sin scope creep):** Datos no tocados, índice DB diferido a parte 2, adorno visual de conflicto diferido a T2-CONFLICT-VISUAL-INDICATOR, audit log diferido a T2-APPT-STATUS-AUDIT-LOG. 4 ampliaciones identificadas, ninguna aplicada.
- **P13 (`tsc + next build` verdes):** Sí en los 3 commits. Warnings preexistentes verificados como tales (líneas fuera del diff).
- **P14 (pilots intocables):** Sin cambio en lógica de plan, `is_pilot` ni gating. Los fixes aplican a todas las clínicas por igual.
- **P15 (validación visual humana obligatoria en cambios de layout Next.js):** Aplicada **dos veces**: tras escribir `DayView.tsx`+`WeekView.tsx` (PASO 3) y solo tras OK explícito de Octavio sobre Día Y Semana se commiteó.

---

## 9. Métricas

| Métrica | Valor |
|---|---|
| Commits | 3 atómicos (`22af5c4`, `562b29c`, `c70b7c9`) |
| Archivos modificados | 7 (2 endpoints + 4 componentes panel/paciente + 0 lib) |
| Líneas tocadas | +142 / -27 |
| Endpoints corregidos | 2 (confirm, update-status) |
| Vistas de agenda corregidas | 2 (Día, Semana) |
| Pasos del sprint | 5 audit + 3 fix (con PASO 3 sub-dividido en 3a audit + 3b approach + 3c escritura) |
| Validaciones visuales gated | 1 (post-PASO 3, 2 vistas en la misma sesión) |
| Datos modificados en DB | 0 (decisión producto diferida a parte 2) |

---

## 10. Próximos pasos

### Inmediato

- **Push de los 3 commits** cuando se reautentique GitHub HTTPS en local (PAT expirado o helper roto — bloquea el push, no afecta los commits ya creados).
- Commit doc Sprint Fix Doble Booking incluido en este mismo push.

### Parte 2 del sprint (entrada al stack en cuanto haya decisión producto)

1. Miriam decide cuál cita mantener (Isabelle vs Rosa) — pendiente.
2. Ejecución Q4 + posibles limpiezas adicionales.
3. `CREATE UNIQUE INDEX` con predicado `IS DISTINCT FROM 'cancelled'`.

### Tier 2 priorizable

7 hallazgos abiertos en §7. **T2-APPT-STATUS-NO-SHOW-CHECK-MISMATCH** es el más barato (decidir + 1 migration). **T2-APPT-STATUS-AUDIT-LOG** es el más valioso defensivamente (sin él los próximos incidentes serán igual de difíciles de reconstruir). **T2-APPT-MULTI-STAFF-INDEX** se activa solo cuando llegue el sprint multi-staff.

---

**Sprint Fix Doble Booking (parte 1 de 2 — código) cerrado el 28 mayo 2026.**
