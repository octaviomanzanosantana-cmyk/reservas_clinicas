# Sprint Vista Mes Calendario

**Fecha cierre:** 20 mayo 2026
**Branch:** main
**Commit:** `df91d08`
**Deploy:** Vercel Production Ready
**Bloqueante para soft launch S8:** No — feature value-add, no cutover-critical

---

## 1. Contexto

Origen: FR2 Miriam Lorenzo (backlog Tier 1 post-cutover S8). En su feedback de uso real pidió "vistas calendario mes/trimestre" sobre el panel `/clinic/[slug]/calendar`, que hasta este sprint solo ofrecía toggle Día/Semana.

Este sprint cubre **solo vista mes**. Trimestre y año esperan validación con caso de uso concreto — incluir las tres en un solo sprint hubiera inflado scope sin señal real de demanda fuera de Miriam.

Decisión producto: vista mes es **feature de plan Starter+**. Plan Free no la ve. Pilots ven todo (regla P14 — bypass `is_pilot=true` en el wrapper de gating).

---

## 2. Objetivo

Añadir vista mensual al panel clínica con toggle Día/Semana/Mes. Reusar la fuente de datos y la lógica de disponibilidad existentes. Cero cambio funcional ni visual en Día y Semana. Arquitectura preparada para añadir vistas futuras (trimestre, año, multi-profesional) sin reescribir.

Características concretas:

- Componente padre `<CalendarLayout>` orquestador con toggle.
- `<MonthView>` con grid 7×6 (42 celdas), celdas compactas, máximo 3 citas visibles + "+N más".
- Navegación mes anterior / Hoy / mes siguiente.
- Click en día → vista Día de ese día.
- Click en cita → modal `EditAppointmentModal` existente (sin tocar).
- "Hoy" resaltado, timezone del navegador (consistente con Día/Semana actuales).
- Días no operativos según `clinic_hours` con fondo gris claro pero **nunca ocultos** — el grid es siempre 7 columnas Lun-Dom para soportar citas excepcionales y futura vista multi-profesional.
- Loading state + estado vacío.

---

## 3. Disciplina aplicada

Sprint ejecutado en **8 pasos gated** (P11, audit-first; P12, sin scope creep; P15, validación visual obligatoria post-refactor). Cada paso esperaba "OK paso N" antes del siguiente.

| Paso | Acción | Resultado |
|---|---|---|
| 1 | Audit-first (estructura calendario, endpoint, timezone, helper plan, schema `clinics.plan`, query producción) | 14 clínicas reales, 0 con `plan=NULL`, 2 pilots con plan starter |
| 1.5 | Audit ampliado: fuente de verdad "Semana Laboral" + decisiones mobile | `WEEK_DAYS` hardcoded Lun-Vie en `ClinicCalendarPage.tsx` (anotado T2-CAL-WEEKVIEW-WEEKEND) |
| 2 | `lib/plan.ts` + `lib/planFeatures.ts` con tests `node:test` | 8/8 pass |
| 3 | Endpoint `/api/appointments/by-date` extendido con `from`+`to` opcionales | Backward-compatible bit-perfect con `?date=` |
| 4 | Hook `useCalendarData` + componente `AppointmentCard` reutilizable | Vista Semana pasa de 5 fetches paralelos a 1 fetch con rango |
| 5 | Split `DayView` + `WeekView` extraídos de `ClinicCalendarPage.tsx` | `ClinicCalendarPage.tsx`: 770 → 309 líneas |
| 6 | `MonthView` + `CalendarLayout` + toggle 3-way con gate `clinicHasFeature` | `ClinicCalendarPage.tsx`: 309 → 224 líneas final |
| 6.5 | Fix dirigido de 4 issues detectados en validación visual paso 6 | Días no operativos visibles, mobile redirect, subtítulo dinámico, píldora redundante eliminada |

Validación visual humana se ejecutó **2 veces** según mandato adenda EditAppointmentModal:

1. Tras paso 5 (split): vista Día y Semana sin regresión. OK.
2. Tras paso 6 (MonthView): identificó 4 bugs visuales/UX adicionales → paso 6.5 fix dirigido → re-validación OK.

---

## 4. Arquitectura

### 4.1 Componentes creados

```
components/clinic/calendar/
├── CalendarLayout.tsx     245 líneas — orquestador del toggle + header
├── DayView.tsx            134 líneas — extraído del page (sin cambio funcional)
├── WeekView.tsx           192 líneas — extraído del page (sin cambio funcional)
├── MonthView.tsx          149 líneas — nuevo
└── AppointmentCard.tsx    152 líneas — 3 variantes (regular, compact, mini)
```

### 4.2 Lógica compartida

```
lib/calendar/
├── useCalendarData.ts     209 líneas — hook que centraliza fetch clinic + hours + appointments
├── dateHelpers.ts         102 líneas — funciones puras (getMonthGrid, isOperatingDay, ...)
└── dateHelpers.test.ts    125 líneas — 11 tests node:test

lib/hooks/
└── useMediaQuery.ts        16 líneas — detección viewport mobile/desktop

lib/
├── planFeatures.ts         15 líneas — wrapper clinicHasFeature con bypass is_pilot
└── planFeatures.test.ts    67 líneas — 8 tests node:test
```

### 4.3 Diagrama de dependencias

```
ClinicCalendarPage (224 líneas)
  │
  ├── useCalendarData       → /api/clinics, /api/clinic-hours, /api/appointments/by-date
  ├── clinicHasFeature      → wraps canUseFeature + bypass is_pilot
  └── CalendarLayout
        │
        ├── useMediaQuery   → fuerza viewMode="week" si mobile + viewMode==="month"
        ├── DayView         → AppointmentCard variant="regular"
        ├── WeekView        → AppointmentCard variant="compact"
        └── MonthView       → AppointmentCard variant="mini"
                             + getMonthGrid, isOperatingDay (dateHelpers)
```

`EditAppointmentModal` se renderiza condicional en `ClinicCalendarPage` (no en `CalendarLayout`) y recibe `handleAppointmentClick` como callback común a las tres vistas. El estado del modal (`editingAppointment`) vive en el padre, las vistas hijas solo emiten clicks.

---

## 5. Refactor sin cambio funcional

`ClinicCalendarPage.tsx`: **770 → 224 líneas (-71%)**.

| Bloque eliminado del page | Destino |
|---|---|
| 3 declaraciones de tipos (`ClinicData`, `ClinicHourRow`, `AppointmentRow`) | `lib/calendar/useCalendarData.ts` |
| Const `STATUS_META` + función `getStatusMeta` | `components/clinic/calendar/AppointmentCard.tsx` |
| 6 useState para data-loading + 2 useEffect de fetch | `useCalendarData` hook |
| Helpers `parseDateInput`, `formatDateInput`, `getSlotKey`, `getSchedulesForDate` | `lib/calendar/dateHelpers.ts` |
| `WEEK_DAYS` const + `getWeekDates` | `components/clinic/calendar/WeekView.tsx` (literalmente, según brief paso 5) |
| 4 useMemo para agendaSlots / appointmentsBySlot / weekAgendaData / weekDates | Cada vista hija calcula los suyos |
| 2 bloques de render inline (vista Día + vista Semana) | `<DayView />` y `<WeekView />` |
| Toolbar header + section header con título dinámico | `<CalendarLayout />` |

Endpoint `/api/appointments/by-date` extendido (+71 / -12 líneas):

- Mantiene path `?date=YYYY-MM-DD` con comportamiento bit-perfect idéntico.
- Añade path `?from=YYYY-MM-DD&to=YYYY-MM-DD` con mismas validaciones de formato, mismo filtro `clinic_id` explícito (`requireCurrentClinicForApi`), mismo cómputo de boundaries (server-local-tz, replica el fudge actual por consistencia).
- Validación adicional: rango > 92 días → 400 (defensa contra abuso, deja margen para futura vista trimestre).

---

## 6. Decisiones tomadas durante el sprint

### D1 — Opción A en endpoint range: replicar fudge TZ del proceso Node

El path `?date=` existente NO usa `clinic.timezone`: calcula boundaries con `new Date(year, month-1, day).setHours(0,0,0,0)` que se interpreta en TZ del proceso Node (UTC en Vercel). Para clínicas en `Atlantic/Canary` invierno coincide; en verano DST hay desfase invisible durante horario comercial.

Tres opciones evaluadas en paso 3:
- **A** Replicar el fudge en `?from=&to=` (consistencia, sin DB extra). **Elegida.**
- B Implementar correctamente con `clinic.timezone` solo en `?from=&to=` (asimetría dentro del endpoint).
- C Implementar correctamente y arreglar también `?date=` (cambia comportamiento Día/Semana — viola regla 7 del brief).

Razón D1: la regla 7 prohíbe cambiar Día/Semana. La asimetría B es peor que el fudge consistente A. El fix correcto merece sprint dedicado con tests y validación — anotado como **T2-CAL-ENDPOINT-TIMEZONE**.

### D2 — Bucketing por local-cliente en vista Semana (no UTC-server)

Hoy con 5 fetches `?date=`, el cliente bucketea cada appointment por la fecha del request (UTC-server day). Con el refactor a 1 fetch con rango, hay que bucketear cliente-side por `formatDateInput(new Date(scheduled_at))` = local-cliente day.

Edge case teórico: appointment a 01:30 Madrid local del lunes (= 23:30 UTC del domingo) bucketea diferente en cada lógica. **Impacto en producción cero**:
- Las 14 clínicas reales están en TZ Canarias.
- Citas en horario comercial (09-21 local) nunca caen cerca de UTC midnight.
- En ambas lógicas la cita es invisible en el render (slot 01:30 no existe en `clinic_hours`).

Anotado como **T2-CAL-BUCKETING-NEAR-UTC-MIDNIGHT**. La nueva lógica converge con la dirección correcta del fix T2-CAL-ENDPOINT-TIMEZONE.

### D3 — Toggle 3-way (Día / Semana / Mes), no 2-way

Brief original mencionaba "Toggle Semana ↔ Mes". Audit detectó que hoy el toggle es Día ↔ Semana — eliminar Día rompería el drill-down "click en celda mes → vista Día". Decisión: 3-way con vista Día mantenida.

### D4 — Mobile <768px redirige `viewMode="month" → "week"` automáticamente

El botón Mes se oculta vía Tailwind `hidden md:inline-flex`, pero el state `viewMode` no se sincronizaba con el viewport. En `CalendarLayout.tsx` se añadió `useEffect` que llama `onViewModeChange("week")` cuando `!isDesktop && viewMode === "month"`.

Funciona en los 3 escenarios:
- Desktop → mobile estando en Mes: redirect automático a Semana.
- Mobile → desktop: permanece en vista actual.
- Reload directo en mobile con `viewMode="month"` persistido: arranca en Semana sin parpadeo (default actual es "day", no se persiste).

### D5 — Grid siempre 7 columnas Lun-Dom

Días no operativos (`!isOperatingDay(dayOfWeek, clinicHours)`) y días fuera del mes (padding) se renderizan con `bg-slate-100` y número en `text-slate-400`. **Nunca se ocultan** — estructura predecible, soporte para citas excepcionales en sábados/domingos, compatibilidad futura multi-profesional (Pro/Business).

### D6 — Wrapper `clinicHasFeature`, no extender `canUseFeature`

`canUseFeature(plan, feature)` existente NO respeta `is_pilot`. Dos opciones:
- Extender `canUseFeature` con `is_pilot` (cambio en 6 call-sites externos).
- Crear wrapper `clinicHasFeature(clinic, feature)` con bypass.

Elegido el wrapper (opción b del brief): cero cambio en `canUseFeature`, scope contenido, bug pre-existente queda anotado como **T2-PILOT-FEATURE-GATING** para sprint dedicado.

---

## 7. Paso 6.5 — Fix dirigido de 4 issues post-validación visual

Validación visual humana del paso 6 detectó 4 problemas que requirieron paso quirúrgico adicional:

### Fix 1 — Días no operativos sin diferencia visual

`bg-[#FAFAFA]` (`rgb(250,250,250)`) era casi indistinguible de blanco puro. El número del día solo consideraba `isCurrentMonth`, no `operating`. Cambios en [`components/clinic/calendar/MonthView.tsx`](components/clinic/calendar/MonthView.tsx):

- Fondo: `bg-[#FAFAFA]` → **`bg-slate-100`** (contraste visible, mismo tono usado en headers inactivos de WeekView).
- Número del día: usa `dimmed` (`!isCurrentMonth || !operating`) en lugar de solo `!isCurrentMonth`.

### Fix 2 — Vista Mes en mobile aunque botón oculto

Nuevo hook [`lib/hooks/useMediaQuery.ts`](lib/hooks/useMediaQuery.ts) + `useEffect` en `CalendarLayout` que fuerza `viewMode="week"` cuando `!isDesktop && viewMode === "month"`.

### Fix 3 — Subtítulo dinámico vista Mes

Helper `formatMonthYearLabel(dateString)` en `CalendarLayout.tsx` con `toLocaleDateString("es-ES", { month: "long" })`. Subtítulo h2: `"Vista del mes"` → `"Vista de mayo 2026"`. Día y Semana mantienen sus textos literales.

### Fix 4 — Eliminar píldora redundante con nombre clínica

El bloque `<div>{clinic?.name ?? "Cargando clínica..."}</div>` en el header del calendario duplicaba info ya presente en banner impersonación, sidebar header y avatar sidebar. Eliminado del header + limpieza cascada de la prop `clinic` (sin uso en `CalendarLayout` tras eliminar la píldora) + import del type `ClinicData` removido.

---

## 8. Validación

### 8.1 Tests automáticos

```
node --test lib/calendar/dateHelpers.test.ts lib/planFeatures.test.ts

✔ 11 tests dateHelpers (getMonthGrid casos Feb 2026, Feb 2024 bisiesto, May 2026,
                       Jun 2026 sin padding inicial, Dic 2026 → Ene 2027, isToday;
                       isOperatingDay con 0 / 1 / 5 rows y active=false)
✔  8 tests planFeatures (Free/Starter/Pro × month_view; Pilot bypass aplicado;
                         plan=null defensivo; feature inventada → false)

ℹ tests 19 ℹ pass 19 ℹ fail 0
```

### 8.2 Build production

```
npx tsc --noEmit       → exit 0, sin errores
npx next build         → Compiled successfully in 5.1s
                         Generating static pages (86/86) sin warnings
```

Bundle `/clinic/[slug]/calendar`: **7.3 kB / First Load 117 kB**.

### 8.3 Validación visual humana (P15)

Casos validados por Octavio en producción con clínica Miriam Lorenzo (`miriamlorenzo`, pilot, plan=starter, `clinic_hours` solo martes y jueves activos):

- Toggle 3-way visible (Día / Semana / Mes).
- Click "Mes" → grid 7×6, Lun-Dom labels.
- Lun/Mié/Vie/Sáb/Dom en `bg-slate-100` con número gris (no operativos).
- Mar/Jue del mes actual en blanco con número negro (operativos).
- Click en cita mini → `EditAppointmentModal` abre con datos correctos.
- Click en celda vacía o "+N más" → navega a vista Día de ese día.
- Subtítulo: `"Vista de mayo 2026"` cambia a `"Vista de junio 2026"` con navegación.
- DevTools device toolbar < 768px → toggle Mes desaparece + body cambia a Semana automáticamente.
- Click "Anterior"/"Siguiente" en Mes → shift de un mes completo.
- Vista Día y Semana pixel-perfect idénticas a producción pre-sprint.

---

## 9. Métricas

| Métrica | Valor |
|---|---|
| `ClinicCalendarPage.tsx` líneas | 770 → 224 (-71%) |
| Ficheros nuevos | 11 (5 componentes + 3 lib + 2 tests + 1 hook) |
| Ficheros modificados | 5 (page, 2 endpoints, plan.ts, tsconfig.json) |
| Tests automáticos añadidos | 19 (8 planFeatures + 11 dateHelpers) |
| Tráfico red vista Semana | 5 fetches → 1 fetch |
| Bundle ruta calendario | 7.3 kB (First Load 117 kB) |
| Páginas estáticas en build | 86/86 sin warnings |
| Pasos del sprint | 7 + 1 sub-fix (6.5) |
| Validaciones visuales gated | 2 (post-paso 5, post-paso 6) |

---

## 10. Hallazgos cerrados en este sprint

- **T2-CAL-FETCH-RANGE** — Vista Semana hacía 5 fetches paralelos. Refactor a 1 fetch con `?from=&to=` cerrado por `useCalendarData`.
- **T2-TSCONFIG-IMPORTING-TS-EXT** — `tsc --noEmit` lanzaba TS5097 sobre imports `.ts` explícitos (necesarios para `node:test` en Node 24). Solución: `"allowImportingTsExtensions": true` en `tsconfig.json`.

---

## 11. Hallazgos abiertos a backlog Tier 2

Anotados textualmente en el body del commit `df91d08`:

- **T2-CAL-WEEK-MOBILE-REDESIGN** — Vista Semana en mobile (<768px) inutilizable. Grid 6 columnas no cabe, headers cortados, citas en letras sueltas. Pre-existente al sprint. Decisión Octavio: sprint dedicado futuro cuando llegue feedback real de uso móvil.
- **T2-CAL-ENDPOINT-TESTS** — Faltan integration tests para `/api/appointments/by-date` (ambos paths).
- **T2-CAL-ENDPOINT-TIMEZONE** — Endpoint usa TZ proceso Node, no `clinic.timezone`. Pre-existente; extendido a path `from`+`to` por consistencia (Opción A en D1). Fix correcto: cargar `clinic.timezone` vía `getClinicBySlug` en el endpoint y usar `dateAtTimezoneHour` de `lib/availability.ts:93-128` para calcular boundaries en TZ de la clínica.
- **T2-CAL-WEEKVIEW-WEEKEND** — Vista Semana hardcoded Lun-Vie ignorando `clinic_hours` que sí soporta días 1-7. Si una clínica configura sábado/domingo, el panel no lo muestra pero booking público sí.
- **T2-CAL-BLOCKED-DATES** — Vista Mes podría resaltar `blockedDates` (vacaciones de `listClinicBlocksInRange`). Fuera de brief original.
- **T2-CAL-BUCKETING-NEAR-UTC-MIDNIGHT** — Refactor cambió bucketing UTC-server → local-cliente. Edge case teórico sin impacto visible en producción Canarias.
- **T2-CAL-DAYVIEW-DEAD-EMPTY-STATE** — Rama `agendaSlots.length === 0` dentro del map nunca se ejecuta dada la guarda externa. Cleanup trivial.
- **T2-CLINICS-IS-PILOT-EXPOSURE** — `/api/clinics` ahora expone `is_pilot` públicamente (endpoint sin auth). Riesgo informativo bajo (pilots no son secret). Posible migración futura a endpoint authed `/api/clinic/feature-flags`.
- **T2-PILOT-FEATURE-GATING** — `canUseFeature` no respeta `is_pilot`. Wrapper `clinicHasFeature` lo resuelve solo para `month_view`. El resto de features siguen requiriendo asignación manual de plan a pilots (mitigado en producción porque los 2 pilots actuales tienen plan=starter).
- **T2-TEST-EXTENSIONLESS-IMPORTS** — `lib/subscriptionBannerState.test.ts` roto desde Sprint 3 por imports sin `.ts`. Mi test nuevo usa `.ts` explícito y funciona; el viejo nunca se ejecutó con éxito en Node 24.
- **T2-SUPABASE-KEY-LOCAL-STALE** — `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` local da `401 Unregistered API key` (fue rotada post-cutover Stripe y no actualizada en local). No bloqueante para el sprint, pero impide scripts locales que usen service role.

---

## 12. Reglas de oro validadas

- **P10 (1 sprint = 1 chat):** Sprint cerrado en una sola conversación, desde audit-first hasta push.
- **P11 (audit-first):** Paso 1 + paso 1.5 + paso 3 pausa pre-implementación + paso 4 pausa por bucketing. 4 momentos en los que el agente paró antes de actuar para alinear con Octavio.
- **P12 (sin scope creep):** Tres ampliaciones identificadas y todas anotadas a backlog en lugar de aplicadas — `T2-PILOT-FEATURE-GATING` (no se extendió a todas las features), `T2-CAL-WEEKVIEW-WEEKEND` (no se desbloqueó el fin de semana), `T2-CAL-ENDPOINT-TIMEZONE` (no se arregló el fudge TZ del endpoint).
- **P13 (`tsc + next build` verdes):** Sí en paso 6 antes del cierre y otra vez tras paso 6.5.
- **P14 (pilots intocables):** Wrapper `clinicHasFeature` con bypass `is_pilot=true` antes de cualquier otro check. Pilots ven Mes sin importar su plan.
- **P15 (validación visual humana obligatoria en cambios de layout Next.js):** Aplicado 2 veces. La segunda detectó 4 issues que no se hubieran cazado solo con `tsc + build` verde.

---

## 13. Próximos pasos

### Inmediato

- Push del commit doc Sprint Vista Mes a `main`.
- Actualizar memoria sesión (cierre sprint + hallazgos abiertos T2).

### Backlog Tier 2 priorizado

Los 11 hallazgos abiertos (§11) entran al stack post-cutover S8. Sin orden estricto — la priorización depende de cuándo lleguen señales reales de cada uno:

- **T2-CAL-WEEK-MOBILE-REDESIGN** se activa con primer feedback de uso móvil real.
- **T2-CAL-ENDPOINT-TIMEZONE** se activa si entra clínica peninsular (TZ Europe/Madrid) — hasta ahora todas Canarias.
- **T2-PILOT-FEATURE-GATING** se activa si entra pilot con plan=free.
- **T2-SUPABASE-KEY-LOCAL-STALE** ya bloqueante para scripts locales — siguiente vez que necesite ejecutarlos, rotar key en `.env.local`.

---

**Sprint Vista Mes Calendario cerrado el 20 mayo 2026.**
