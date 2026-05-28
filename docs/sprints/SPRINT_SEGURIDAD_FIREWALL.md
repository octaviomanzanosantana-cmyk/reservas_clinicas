# Sprint Seguridad Firewall — incidente bot + configuración WAF

**Fecha apertura:** 27 mayo 2026 (detección del incidente ~20:52 UTC)
**Fecha cierre:** 28 mayo 2026
**Tipo:** Respuesta a incidente + configuración de infraestructura
**Branch:** N/A — sin cambios en código de la aplicación
**Commits de código:** ninguno (trabajo ejecutado vía SQL directo en Supabase + consola Vercel Firewall)
**Bloqueante para soft launch S8:** No — el incidente está contenido (cuenta fraudulenta borrada, 0 citas creadas, 0 pacientes expuestos).

---

## 1. Resumen

Sprint de seguridad reactivo tras detección de un bot/atacante que consiguió crear una clínica fraudulenta en `app.appoclick.com` usando una combinación de Tor + bulletproof hosting offshore. La respuesta tuvo dos fases:

- **Fase A — Borrado forense.** Limpieza transaccional de la clínica falsa y su `auth.user` asociado vía SQL directo en Supabase, preservando `login_attempts` como evidencia.
- **Fase B — Configuración de 3 capas de defensa en Vercel Firewall.** Bloqueo de Tor exit nodes (7 ASNs), bloqueo de Datashield bulletproof hosting (2 ASNs) y rate limit con Challenge en `/register`. Bot Protection activado en modo Log para observación antes de Deny.

Sin cambios en código de la app. Todo el trabajo es infra + datos.

---

## 2. Incidente detectado

| Indicador | Valor |
|---|---|
| Fecha del ataque | 27/05/2026, ~20:52 UTC |
| Clínica fraudulenta — nombre | `mNDROAScouDeQJUqXeL` (string aleatorio sin editar) |
| Clínica fraudulenta — slug | `mndroascoudeqjuqxel` |
| `clinic_id` | `1321d7d6-113d-4297-a92e-720c957d23c2` |
| Email atacante | `kschindl@odu.edu` (dominio Old Dominion University, Virginia — probablemente comprometido) |
| Confirmación de email | 26 segundos tras signup |
| Actividad total en panel | 66 segundos |
| Citas creadas | 0 |
| Pacientes expuestos | 0 |
| Segundo email implicado | `jlandis001@columbus.rr.com` — **no llegó a crear cuenta** (2 intentos fallidos 50 min antes) |

**Lectura:** patrón claro de automatización (nombre random no editado, confirmación instantánea, sesión de 66 s sin acción de usuario humano). Ningún dato real de clínica o paciente fue tocado por el atacante; el objetivo aparente era reservar slots de signup, probar la plataforma o sembrar cuentas para uso posterior.

---

## 3. Análisis forense de IPs (tabla `login_attempts`)

3 IPs implicadas, todas anonimizadas o offshore:

| IP | ASN | Operador | País | Tipo |
|---|---|---|---|---|
| `185.220.100.251` | AS205100 | F3 Netze e.V. | Alemania | Tor exit node |
| `185.220.100.252` | AS205100 | F3 Netze e.V. | Alemania | Tor exit node |
| `185.231.33.38` | AS211720 | Datashield Inc. | Seychelles | Bulletproof hosting |

**Patrón observado:** el atacante alternó IPs entre intentos para evadir rate limits, usando Tor en los intentos iniciales (incluido el del email `jlandis001`) y rotando a bulletproof hosting offshore en el intento final exitoso con `kschindl@odu.edu`. La combinación Tor + bulletproof + email universitario probablemente robado describe un actor con metodología deliberada, no un script genérico.

---

## 4. Respuesta inmediata — borrado forense

Ejecutado vía Supabase SQL Editor, transacción única `BEGIN ... COMMIT`:

```sql
BEGIN;
DELETE FROM clinics WHERE id = '1321d7d6-113d-4297-a92e-720c957d23c2';
DELETE FROM auth.users WHERE email = 'kschindl@odu.edu';
COMMIT;
```

`CASCADE` sobre `clinics` limpió en una sola operación: `clinic_users`, `clinic_blocks`, `invoices`, `tax_data`, `subscription_cancellations`. El `auth.user` requirió delete explícito por estar fuera del schema `public`.

### Decisión clave

**`login_attempts` NO se borró** — preservada íntegra como evidencia forense. Sin ella el análisis de IPs/ASNs de §3 habría sido imposible. Regla operativa derivada: tras un incidente, identificar primero qué tablas son evidencia antes de cualquier CASCADE.

### Lección operativa — transacciones en Supabase SQL Editor

Primer intento de borrado falló: ejecutar `BEGIN` y `COMMIT` en runs separados del SQL Editor **no funciona**. Cada "Run" abre una sesión nueva y cierra la anterior, por lo que el `BEGIN` se descarta antes de que llegue el `COMMIT`. Las transacciones multi-paso deben ejecutarse en **un solo Run** con todo el bloque `BEGIN ... COMMIT` seleccionado a la vez. Anotado para futuros incidentes que requieran operaciones transaccionales urgentes.

---

## 5. Defensas configuradas — Vercel Firewall

Proyecto: `app-appoclick` (plan Pro). Aplicadas en consola, versionadas automáticamente por Vercel.

### 5.1 Custom Rule — "Block Tor exit nodes"

| Parámetro | Valor |
|---|---|
| Action | **Deny** |
| Condición | `AS Number` `Equals` (OR de 7 ASNs) |
| ASNs bloqueados | `205100`, `208323`, `4224`, `396507`, `60729`, `197540`, `210558` |

Operadores cubiertos (los 7 ASNs corresponden a los principales proveedores de exit nodes de Tor con presencia estable):

- AS205100 — F3 Netze e.V.
- AS208323 — Foundation for Applied Privacy
- AS4224 — Calyx Institute
- AS396507 — Emerald Onion
- AS60729 — Zwiebelfreunde
- AS197540 — Netcup
- AS210558 — 1337 Services

### 5.2 Custom Rule — "Block Datashield bulletproof hosting"

| Parámetro | Valor |
|---|---|
| Action | **Deny + Persistent Action 1h** |
| Condición | `AS Number` `Equals` (OR de 2 ASNs) |
| ASNs bloqueados | `211720`, `200699` |

Ambos ASNs operados por Datashield Inc. (Seychelles). La acción persistente de 1h asegura que un IP que ya disparó el bloqueo siga bloqueado durante una hora aunque cambie el match (defensa contra rotación rápida).

### 5.3 Rate Limit — "Rate limit registro"

| Parámetro | Valor |
|---|---|
| Action | **Challenge** (no Deny — minimiza riesgo de falsos positivos) |
| Condición | `Request Path` `Equals` `/register` |
| Algoritmo | Fixed Window |
| Límite | 5 requests / 60 segundos |
| Key | IP Address |
| Coste | $0.50 por 1M requests permitidas; requests bloqueadas gratis |

**Coste real a volumen actual:** despreciable. El soft launch S8 genera tráfico humano de signup en cifras de decenas/día, muy por debajo del millón.

### 5.4 Bot Protection — modo Log

| Parámetro | Valor |
|---|---|
| Modo | **Log** (observación, no bloqueo) |

**Razón explícita para no activar Deny/Challenge todavía:** auditar el impacto real antes de habilitar bloqueo. Los pilots actuales (Miriam Lorenzo, Symbios) tienen pacientes cuyo patrón de navegación se desconoce; un bloqueo prematuro de Bot Protection podría generar falsos positivos sobre tráfico legítimo. La decisión es observar 1-2 semanas y revisar logs antes de decidir upgrade.

---

## 6. Verificación post-implementación

Dashboard de Traffic Vercel (28/05/2026, 24h post-config):

| Métrica | Valor |
|---|---|
| Requests Denied | 0 |
| Requests Challenged | 0 |
| Falsos positivos detectados en pilots | 0 |
| Ataque nocturno repetido | No |

Tráfico observado en el dashboard durante la ventana de verificación: 100% legítimo. Fuentes confirmadas:

- Cron interno (`vercel-cron`).
- Página pública `/b/miriamlorenzo` (pilot activo).
- Health-checks de AWS / Azure (probes de infraestructura).

El silencio de las reglas Deny es esperado y deseado: sin ataque repetido, no debe haber bloqueos. Lo crítico es la ausencia de falsos positivos en el tráfico de pilots.

---

## 7. Pendientes — backlog seguridad

| ID | Tarea | Cuándo |
|---|---|---|
| SEC-1 | Revisar logs de Bot Protection (modo Log) y decidir upgrade a Deny/Challenge | ~10/06/2026 |
| SEC-2 | Replicar las 3 reglas en el proyecto Vercel de la landing (`appoclick.com`) — hoy solo `app.appoclick.com` está protegido | Antes de cierre de cutover |
| SEC-3 | Implementar **BotID** (invisible CAPTCHA de Vercel, `npm i botid` + código) en `/register` y `/login` | Post-cutover |
| SEC-4 | Sprint RLS Hardening: habilitar RLS en 5 tablas con `rls_enabled=false` (`google_calendar_tokens`, `two_factor_codes`, `login_attempts`, `patient_deletion_log`, `impersonation_tokens`) + ocultar columnas sensibles en 2 tablas | Pre-S8, ya planificado |

---

## 8. Notas de seguridad operativa

- **Versionado de config WAF.** Vercel Firewall guarda cada cambio en Audit Log; el botón "Restore" permite revertir cualquier regla al estado anterior al instante. No hace falta backup manual de la config.
- **Facturación de requests bloqueadas.** Las requests bloqueadas por reglas WAF (Deny / Challenge fallidos) **no cuentan** para la factura de Vercel. Bloquear es gratis; permitir requests sujetas a reglas de rate limit cuesta los $0.50/M citados.
- **Danger Zone — "Pause/Disable System Mitigations".** NUNCA tocar. Desactiva la protección DDoS de Vercel a nivel de plataforma. No existe escenario operativo legítimo en el que un cambio aquí sea correcto.

---

## 9. Reglas de oro validadas

- **P10 (1 sprint = 1 chat):** Incidente detectado, analizado, borrado y defensas configuradas en una sola conversación 27→28/05.
- **P11 (audit-first):** Análisis forense de IPs/ASNs **antes** de configurar bloqueos. Las 3 IPs del incidente real determinaron los 9 ASNs bloqueados, no una lista genérica copiada de internet.
- **P12 (sin scope creep):** No se tocó código de la app. No se implementó BotID (diferido a SEC-3). No se replicó en landing (diferido a SEC-2). El sprint se limitó a contener el incidente y levantar las 3 reglas mínimas justificadas por la evidencia.
- **P14 (pilots intocables):** Bot Protection deliberadamente en modo Log para no romper tráfico de pacientes de Miriam/Symbios mientras no se conozca su patrón real.

---

## 10. Métricas

| Métrica | Valor |
|---|---|
| Duración del sprint | ~24 h calendarias (detección 27/05 noche → cierre 28/05) |
| Commits de código | 0 |
| Reglas WAF creadas | 3 (2 Deny + 1 Challenge) + 1 Bot Protection en Log |
| ASNs bloqueados | 9 (7 Tor + 2 Datashield) |
| Clínicas fraudulentas eliminadas | 1 |
| `auth.users` eliminados | 1 |
| Tablas con CASCADE limpiadas | 5 (`clinic_users`, `clinic_blocks`, `invoices`, `tax_data`, `subscription_cancellations`) |
| Filas de evidencia preservadas | `login_attempts` íntegra |
| Pacientes expuestos | 0 |
| Falsos positivos post-config (24h) | 0 |

---

**Sprint Seguridad Firewall cerrado el 28 mayo 2026.**
