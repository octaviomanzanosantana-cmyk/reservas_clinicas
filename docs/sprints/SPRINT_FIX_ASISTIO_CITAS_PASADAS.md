# Sprint Fix Botón "Asistió" en Citas Pasadas — 3 superficies coordinadas (Próximas + Historial + Pacientes)

**Fecha cierre:** 16 mayo 2026 (tarde)
**Branch:** main
**Tiempo real:** ~2h (reporte pilot + auditoría + 3 cambios + validación visual end-to-end)
**Bloqueante para cutover S8 (lunes 19/5):** No — resuelto por valor operativo

---

## 1. Problema resuelto

Miriam Lorenzo (clínica pilot Symbios) reportó 16/5/26 tarde, en respuesta al email de Octavio sobre captación de reseñas, que el botón "Asistió" desaparecía de su dashboard antes de poder marcar las citas. Síntoma descrito por la pilot: "después de la hora de fin de la cita el botón no responde". La auditoría empírica afinó la causa: el bloqueo se dispara desde la hora de **inicio** (`scheduled_at`), no de fin. Para citas con duración 60min, a las 16:01 ya no se puede marcar la de las 16:00.

**Impacto operativo observado en BD de Miriam:**
- 1 sola cita con `status="completed"` en 2 meses (prueba que marcó antes de empezar a operar).
- 63 citas restantes nunca marcadas como asistidas → 0 emails de reseña enviados a pacientes reales.

3 superficies afectadas:
1. **Próximas citas (dashboard):** cita actual cae prematuramente a Historial al iniciar su hora.
2. **Historial reciente (dashboard):** sin botones de acción para `status="confirmed"` (solo "Revertir" para completed/cancelled).
3. **Pacientes (`/clinic/[slug]/patients`):** la página real de gestión histórica — destino del enlace "Ver historial completo" del dashboard — sin acciones disponibles para citas pasadas.

---

## 2. Causa raíz

Bug 100% frontend. Backend `app/api/appointments/update-status/route.ts` **no tiene guard temporal**: acepta `status=completed` en cualquier momento. Verificado por inspección directa del endpoint.

La causa exacta vive en `components/clinic/ClinicDashboardPage.tsx:100-107`, función `isFutureAppointment`:

```ts
return scheduledAt.getTime() > Date.now();
```

Esta función decide si una cita aparece en la tabla "Próximas citas" (única superficie con botón "Asistió") o cae a "Historial reciente". Al pasar `scheduled_at` (hora de inicio), la cita desaparece de la tabla y queda sin acción posible en ninguna superficie.

La segunda superficie (Historial reciente) nunca tuvo botón "Asistió" por diseño: solo "Revertir" para completed/cancelled. La tercera superficie (Pacientes) nunca tuvo columna de acciones — funcionaba como histórico de solo lectura.

---

## 3. Decisión

**Camino 1 descartado:** fix mínimo solo en Historial reciente. La auditoría reveló que "Ver historial completo" del dashboard lleva a `/clinic/[slug]/patients` (componente `ClinicPatientsPage`), no a una página dedicada de historial. Miriam pulsaría el enlace y se encontraría con la misma frustración en Pacientes — incoherencia operativa.

**Camino 2 elegido:** ampliar a las 3 superficies en mismo commit atómico.

**Descartado en este sprint (P12 sin scope creep):**
- Cambio de copy del email de reseña (variante CON/SIN `review_url`). Diseño cerrado en backlog `T2-REVIEW-EMAIL-COPY-CLIENT-CENTRIC`.
- Dedup retroactivo de reseñas por `patient_email` con ventana 90d. Backlog `T2-REVIEW-EMAIL-DEDUP`.
- Filtros precargados en Pacientes ("Citas pendientes de marcar").
- Renombre de la columna "Estado" en Historial.

---

## 4. Implementación

Commit único `e0edb08` con 2 archivos tocados (+104 / −2 líneas). Backend intacto.

### 4.1 `components/clinic/ClinicDashboardPage.tsx` — Cambio 1 (línea 106)

`isFutureAppointment` ampliado para considerar también las citas del día actual:

```ts
return scheduledAt.getTime() > Date.now() || isTodayLocal(appointment.scheduled_at);
```

`isTodayLocal` reutilizada (ya existía en línea 68-80 del mismo archivo, no duplicada). Efecto: una cita de hoy 16:00 permanece en "Próximas citas" hasta las 23:59:59 del mismo día, dando margen al usuario para marcarla cuando termina la consulta.

### 4.2 `components/clinic/ClinicDashboardPage.tsx` — Cambio 2 (líneas ~830-880)

En la celda de acciones de "Historial reciente": añadidos botones **Asistió + Cancelar** cuando `appointment.status === "confirmed"`. Preservado botón **Revertir** existente para `completed`/`cancelled`. Cubre el caso de cita olvidada del día anterior y permite remarcar/anular sin salir del dashboard.

### 4.3 `components/clinic/ClinicPatientsPage.tsx` — Cambio 3

Cambios coordinados sobre el componente único usado por las dos rutas Pacientes (by-slug y default):
- Nuevos states `updatingAppointmentToken` + `errorMessage`.
- Handler `handleAppointmentStatusUpdate` (réplica del patrón del dashboard).
- Banner inline `text-red-600` para errores de update.
- Columna **"Acciones"** (6ª) en la tabla: botones Asistió + Cancelar **solo para `confirmed`**. Sin "Revertir" en Pacientes — decisión deliberada para no saturar la tabla más voluminosa; "Revertir" queda exclusivo en Historial reciente.

### 4.4 No tocado

- `app/api/appointments/update-status/route.ts` — sin guard temporal, sigue válido.
- Tabla "Próximas citas" del dashboard — ya funcionaba.
- `ClinicCalendarPage.tsx` — superficie distinta, fuera de alcance.
- Migration `supabase/migrations/20260515_rls_hardening_admin_tables.sql` dirty en working tree — su sprint dedicado vive aparte.

---

## 5. Validación

### 5.1 Validaciones automatizadas

| Validación | Resultado |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx next build` | exit 0, 0 errores, 0 warnings nuevos |

### 5.2 Validación visual producción (P15)

Ejecutadas sobre SHA `e0edb08` desplegado en Vercel:

| Test | Acción | Resultado |
|---|---|---|
| 1 | Historial reciente — 5 citas confirmadas (Olga, Ciara, Frede, María Jesús, Elena) | botones Asistió + Cancelar visibles |
| 2 | Pacientes — 64 citas en tabla | columna "Acciones" presente, botones solo en confirmed |
| 3 | Marcar cita Octavio Manzano 14/4/26 → "Asistió" | `Confirmada → Asistió` confirmado en UI |
| 4 | Email reseña en bandeja Gmail tras Test 3 | recibido <1min, copy actual correcto |

### 5.3 Anomalía aislada detectada

La cita Octavio tenía `review_sent_at` relleno desde 9/4/26 (residuo de lógica antigua del flujo de reseñas). `UPDATE` manual a `NULL` para permitir el test end-to-end. Anomalía en una sola cita, sin patrón sistemático, no afecta a otras.

---

## 6. Deuda técnica y backlog post-cutover

### T2-REVIEW-EMAIL-COPY-CLIENT-CENTRIC
Variante CON `review_url`: copy a "si todavía no lo has dejado…". Variante SIN `review_url`: cambiar CTA `/a/[token]` "Ver mi cita" a `/b/[slug]` "Ir a [clínica]". Diseñado pero **NO aplicado pre-cutover** por riesgo de regresión. Sprint dedicado tras soft launch.

### T2-REVIEW-EMAIL-DEDUP
Filtrar emails de reseña por `patient_email` con ventana 90d para evitar spam en pacientes recurrentes. Datos Miriam: 9 pacientes recurrentes con intervalos 5-189d. Sprint dedicado post-cutover.

### Decisión operativa Miriam
**NO marcar masivo** las 64 citas pendientes. Decidir caso por caso para no enviar emails retroactivos a pacientes antiguos. Comunicado por email programado lunes 18/5/26.

---

## 7. Lecciones aprendidas

### P11 — Audit-first
La auditoría reveló que el bloqueo vivía en `isFutureAppointment` (filtro de visibilidad), no en el `disabled` del botón. Sin auditoría, el cambio podría haberse hecho en el render del botón (añadiendo lógica de habilitar/deshabilitar por tiempo) sin solucionar la causa raíz: la cita ya no estaba en la tabla.

### P12 — Sin scope creep
4 tentaciones rechazadas en sprint y anotadas en backlog: copy del email, dedup retroactivo, filtros precargados en Pacientes, renombre columna "Estado". Cada una con su ticket virtual, ninguna aplicada en este commit.

### P15 — Validación visual end-to-end
"tsc + build verdes" no era suficiente. Octavio confirmó con cita real: cambio de estado en UI + recepción del email de reseña en Gmail con copy correcto. La validación cubrió el flujo completo, no solo el render.

### Feedback de pilot como diagnóstico aproximado
Miriam reportó "después de hora de fin" pero la lógica bloqueaba desde "hora de inicio". Los reportes de usuario aproximan el síntoma, no la causa exacta. La auditoría empírica afina el diagnóstico antes de tocar código.

---

## 8. Commits del sprint

```
e0edb08  fix(dashboard): permitir marcar Asistió en citas pasadas en Historial y Pacientes
```

Push directo a `main` (mismo flujo que Plan B Impersonación del mismo día — sin PR intermedio porque sprint es fix coordinado de 3 superficies con diff revisado pre-commit y validación visual previa).

---

## 9. Estado post-fix S8

| Campo | Valor |
|---|---|
| HEAD `origin/main` | `e0edb08` |
| Commits sprint en producción | 1 (`e0edb08`) |
| Migration aplicada en BD | N/A — bug 100% frontend |
| Working tree | dirty (1 archivo intencional: `20260515_rls_hardening_admin_tables.sql`) |
| Vercel deploy | Production auto-trigger tras push |
| Bloqueante S8 técnico | 0 |
| Bloqueantes S8 no técnicos | 0 (legal Davinia, hola@ operativo, DPAs firmados Miriam+Symbios) |

Sprint Fix Botón Asistió cerrado con 1 commit atómico, 2 archivos tocados (+104/−2), 0 migrations, tsc + build verdes, validación visual end-to-end + recepción real de email de reseña. P11/P12/P15 mantenidos. Cutover S8 lunes 19/5/26 sigue desbloqueado 100%.

---

**Próxima revisión:** cutover S8 lunes 19/5/26 tras flip `STRIPE_MODE=test → live` en Vercel UI.
