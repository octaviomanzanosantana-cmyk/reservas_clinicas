# Propuesta DPA v1.5 — Resumen ejecutivo

**Para:** Octavio (revisión y aprobación)
**De:** Claude Code
**Fecha:** 2026-05-11
**Versión actual:** v1.4 Abril 2026
**Versión propuesta:** v1.5 Mayo 2026
**Origen:** Sprint DPA Audit + v1.5 — Fase 1 (audit-first, sin tocar código del DPA)

---

## TL;DR

Cambian **4 secciones** del DPA (2, 4, 6, 7). El cambio sustantivo es **un nuevo subencargado** (Google LLC para Google Calendar, opt-in por clínica) y la documentación de **medidas de seguridad ya implementadas** que el v1.4 no listaba (firma webhooks, idempotencia, auditoría impersonación, rate limit genérico, log eliminación pacientes). El resto son aclaraciones (videollamada, token de gestión, WhatsApp manual). **No se introducen tratamientos nuevos**: todo lo que el v1.5 menciona ya está en producción desde Sprints 1–7.6.

Recomendación operativa: pilots (Miriam+Symbios) firman v1.5 física presencial el 19/5; clínicas que ya firmaron v1.4 vía signup mantienen su `dpa_accepted_at` válido (no se invalida); futuras clínicas heredan v1.5 automáticamente.

---

## Cambios propuestos

### 1. Sección 2 — Datos tratados

**¿QUÉ AÑADIR?**

Aclarar que cuando la cita es online se trata además un **enlace de videollamada** que la clínica introduce, y que el sistema asigna un **token único** a cada cita para que el paciente pueda gestionarla (cancelar/reagendar). También aclarar que existe un **tipo de cita** (primera visita / revisión) distinto del tipo de consulta (servicio).

**¿POR QUÉ?**

El v1.4 dice "modalidad presencial/online" pero no menciona el `video_link` que se almacena en `appointments.video_link` (Sprint que añadió `add_video_link.sql`). El campo `token` también se entrega al paciente por email y le sirve para gestionar la cita desde `/a/[token]/...`. Y `appointment_type` (primera_visita / revisión) se introdujo en `add_modality_and_appointment_type.sql`. Ninguno de estos datos es nuevo en el sistema, sólo no estaban descritos en el DPA. No son datos especialmente protegidos; sólo metadatos de la cita.

**¿CÓMO QUEDA EL TEXTO LEGAL?**

```
2. Datos tratados

- Categorías de interesados: pacientes de la clínica
- Tipos de datos: nombre, email, teléfono, fecha y hora de la cita,
  servicio contratado, tipo de cita (primera visita o revisión),
  modalidad (presencial u online), enlace de videollamada cuando la
  modalidad es online, e identificador único asignado por el sistema
  para la gestión de la cita por parte del paciente (cancelación o
  reprogramación desde su email de confirmación).
- No se tratan: historiales médicos, diagnósticos, datos clínicos ni
  contenido sanitario. AppoClick no dispone de campos de texto libre
  para que el paciente o la clínica introduzcan información clínica.
```

---

### 2. Sección 4 — Subencargados

**¿QUÉ AÑADIR?**

Añadir **Google LLC** como subencargado para sincronización con Google Calendar. La integración es **opt-in por clínica**: sólo se activa cuando la clínica conecta su propia cuenta de Google desde el panel. Si la clínica no conecta Google Calendar, no hay transferencia.

**¿POR QUÉ?**

El módulo `lib/googleCalendar.ts` envía a Google Calendar el nombre del paciente, fecha/hora de la cita, servicio y token de la cita cuando la clínica tiene `google_connected = true`. Esto cumple la definición de subencargado bajo art. 28 RGPD y debe constar en el DPA. Las migraciones `add_google_fields_to_clinics.sql` y `add_google_token_metadata_to_clinics.sql` confirman la integración. **Holded** (campo `holded_contact_id`) NO se añade como subencargado de datos de pacientes porque sólo procesa datos fiscales del Responsable (la clínica), no de pacientes — queda fuera del scope DPA.

**¿CÓMO QUEDA EL TEXTO LEGAL?**

```
4. Subencargados

AppoClick utiliza los siguientes subencargados del tratamiento, con los
que mantiene contratos equivalentes al presente DPA:

| Proveedor       | Función                                    | Ubicación      |
|-----------------|--------------------------------------------|----------------|
| Supabase Inc.   | Base de datos y autenticación              | UE (Frankfurt) |
| Vercel Inc.     | Infraestructura y hosting                  | UE / EE.UU. (DPF) |
| Resend Inc.     | Envío de emails transaccionales            | EE.UU. (DPF)   |
| Stripe Inc.     | Procesamiento de pagos (datos de la clínica, no de pacientes) | UE / EE.UU. (DPF) |
| Google LLC      | Sincronización opcional de citas con Google Calendar (sólo si la clínica conecta su cuenta) | EE.UU. (DPF) |

La integración con Google Calendar es opcional y se activa únicamente
cuando la clínica conecta su cuenta de Google desde el panel. En ese
caso, AppoClick transmite a Google Calendar el nombre del paciente, la
fecha y hora de la cita, el servicio contratado y el identificador
único de la cita. Si la clínica no conecta Google Calendar, no se
realiza transferencia alguna a Google.

El Responsable autoriza al Encargado a contratar nuevos subencargados,
previa notificación. El Responsable puede oponerse en un plazo de 15
días.
```

---

### 3. Sección 6 — Medidas de seguridad

**¿QUÉ AÑADIR?**

Documentar las medidas técnicas y organizativas implementadas en Sprints 1–7.6 que el v1.4 no recogía: verificación de firma de webhooks, idempotencia de eventos, auditoría de soporte (impersonación con TTL), rate limiting genérico (no sólo login), registro de eliminaciones de pacientes, aislamiento de secretos en servidor y cifrado en reposo. **Ninguna medida es nueva**: todas existen en producción.

**¿POR QUÉ?**

- **Firma webhooks**: `app/api/stripe/webhook/route.ts` valida firma HMAC de Stripe (Sprint 1).
- **Idempotencia**: tabla `stripe_events_processed` previene reprocesar eventos (Sprint Comercial Fase 1).
- **Auditoría impersonación**: tabla `impersonation_tokens` con TTL 60 min y cookies HttpOnly (Sprint 2.6).
- **Rate limiting genérico**: tabla `rate_limit_events` cubre signup/booking además de login (Sprint).
- **Log eliminación pacientes**: tabla `patient_deletion_log` mantiene trazabilidad de borrados ARCO (Sprint).
- **Aislamiento secretos**: Sprint 2.7 eliminó `NEXT_PUBLIC_ADMIN_API_SECRET` del bundle cliente.
- **Cifrado en reposo**: Supabase encriptación at-rest por defecto.
- **2FA obligatorio**: ya estaba en v1.4, se mantiene.

**¿CÓMO QUEDA EL TEXTO LEGAL?**

```
6. Medidas de seguridad

- Cifrado HTTPS/TLS en todas las comunicaciones
- Cifrado en reposo de la base de datos (proporcionado por el subencargado
  de hosting de base de datos)
- Separación de datos por clínica mediante Row-Level Security en la base
  de datos
- Autenticación segura con segundo factor (2FA) obligatorio para los
  usuarios del panel de la clínica
- Identificadores únicos por cita con caducidad para la gestión por parte
  del paciente
- Rate limiting en endpoints públicos de autenticación, registro y reserva
  de citas para protección frente a abuso y fuerza bruta
- Verificación criptográfica (HMAC) de la firma de los webhooks recibidos
  de subencargados
- Mecanismo de idempotencia que impide procesar dos veces el mismo evento
  externo
- Auditoría del acceso de soporte: las sesiones de impersonación por parte
  del personal de AppoClick requieren un token de un solo uso con caducidad
  máxima de 60 minutos y se registran para trazabilidad
- Registro de las eliminaciones de datos de pacientes solicitadas por la
  clínica, conservando únicamente el email afectado, fecha y autor del
  borrado, para acreditar el cumplimiento de las solicitudes ARCO
- Aislamiento de credenciales y secretos en el servidor: ningún secreto
  ni clave de API se expone en el código que se entrega al navegador del
  cliente
- Backups automáticos cifrados gestionados por el subencargado de base de
  datos
- Notificación de brechas de seguridad a la AEPD en menos de 72 horas
  desde su conocimiento, conforme al art. 33 RGPD
```

---

### 4. Sección 7 — Obligaciones de la clínica

**¿QUÉ AÑADIR?**

Aclarar que la funcionalidad de "recordatorios WhatsApp" no implica que AppoClick envíe mensajes vía WhatsApp Business API: AppoClick prepara un texto y la clínica decide enviarlo manualmente desde su propia cuenta de WhatsApp.

**¿POR QUÉ?**

La migración `whatsapp_reminders.sql` documenta explícitamente "sistema de recordatorios asistidos sin WhatsApp Business API". El sistema genera el texto del recordatorio y lo entrega a la clínica (por email matinal o panel), pero la transmisión efectiva al paciente vía WhatsApp ocurre desde la cuenta personal del usuario de la clínica, fuera de AppoClick. Esta zona gris debe explicitarse para que la clínica sepa que es responsable de esa transmisión.

**¿CÓMO QUEDA EL TEXTO LEGAL?** (sección 7 íntegra, con párrafo nuevo al final)

```
7. Obligaciones de la clínica

- Garantizar la base legal para el tratamiento de datos de pacientes
- Informar a los pacientes sobre el tratamiento de sus datos
- Atender los derechos ARCO de los pacientes (acceso, rectificación,
  supresión, portabilidad)
- No introducir datos especialmente protegidos (origen étnico, salud
  detallada, orientación sexual) en los campos de texto libre de
  AppoClick

Gestión de solicitudes de supresión (derecho al olvido): el sistema
identifica a los pacientes por dirección de email. Si un mismo paciente
ha realizado reservas utilizando emails distintos, la clínica deberá
eliminar sus datos de forma separada para cada email utilizado, desde
el panel Pacientes. La identificación de todos los emails asociados a
un paciente es responsabilidad de la clínica como Responsable del
Tratamiento.

Recordatorios por WhatsApp: la funcionalidad de recordatorios por
WhatsApp que ofrece AppoClick consiste en preparar el texto del
recordatorio y ponerlo a disposición de la clínica (por email matinal
o desde el panel). AppoClick no envía mensajes a través de WhatsApp
Business API ni de ningún otro canal de mensajería instantánea. La
transmisión efectiva del recordatorio al paciente vía WhatsApp se
realiza por iniciativa y bajo la responsabilidad de la clínica desde
su propia cuenta personal de WhatsApp, quedando fuera del ámbito de
tratamiento del Encargado.
```

---

## Secciones SIN cambios

- **Sección 1 — Objeto**: la naturaleza del encargo no ha cambiado. AppoClick sigue siendo Encargado del Tratamiento de datos de pacientes en nombre de la clínica conforme art. 28 RGPD + LOPDGDD.
- **Sección 3 — Obligaciones de AppoClick**: las obligaciones genéricas son las del art. 28 y siguen vigentes.
- **Sección 5 — Transferencias internacionales**: el régimen (CCE / DPF) no ha cambiado. Google LLC añadido en sec. 4 ya queda cubierto por la mención DPF.
- **Sección 8 — Duración y resolución**: el plazo de 30 días post-resolución sigue vigente; nada en Sprints 1–7.6 lo ha modificado.
- **Sección 9 — Responsabilidad**: redacción genérica, sin cambios.
- **Sección 10 — Legislación aplicable**: AEPD, juzgados de Las Palmas, sin cambios.

Datos del Encargado (ANALÓGICAMENTE DIGITALES, S.L. · NIF B76357201 · Calle Fresno 2 · 35200 Telde · Las Palmas · hola@appoclick.com): sin cambios.

---

## Recomendación sobre clínicas que ya firmaron v1.4

### Pilots (Miriam Lorenzo + Symbios Psicología)

Como su DPA se firma de forma física presencial el 19/5 (T2-DPA-5), conviene que firmen directamente la **v1.5**. Acción técnica: en BD, dejar `dpa_version = '1.5'` y `dpa_accepted_at` con la fecha de firma física, `dpa_ip = NULL` (firma analógica, no hay IP). El backfill ya documentado en Sprint 5 puede repetirse para v1.5.

### Clínicas reales que se registren vía signup (futuro)

Heredan v1.5 automáticamente cuando el endpoint `/api/auth/accept-dpa` (o equivalente) lea la nueva constante de versión. **Ningún paso operativo adicional** una vez ejecutada la Fase 3.

### Clínicas existentes que firmaron v1.4 vía signup

**Recomendación: NO invalidar `dpa_accepted_at`**, mantener su consentimiento v1.4 válido y notificar el bump v1.5 con periodo de oposición de 15 días (cumple la cláusula de la propia sec. 4 sobre subencargados nuevos).

**Argumentación**:
- Los cambios sustantivos del v1.5 son **expansivos en favor de la clínica** (más medidas de seguridad documentadas) y **clarificadores** (datos ya tratados, WhatsApp). Ninguno introduce un tratamiento nuevo no autorizado.
- El único subencargado nuevo (Google LLC) sólo se activa por **acción positiva de la clínica** (conectar su cuenta). Mientras no la conecte, no hay transferencia. Esto es funcionalmente equivalente a un consentimiento opt-in.
- Invalidar `dpa_accepted_at` forzaría a 100% de clínicas a re-aceptar antes de poder operar (la Fase 3 incluye un middleware/banner que redirige si está vacío). Para un cambio mayoritariamente cosmético/documental, esto es desproporcionado y operativamente disruptivo a las puertas del cutover S8.

**Mecánica de notificación recomendada** (a definir en Fase 3 si se aprueba):
- Banner informativo no bloqueante en el panel: "Hemos actualizado el DPA a v1.5. [Ver cambios]". Plazo 15 días para oponerse al subencargado nuevo (Google).
- Email opcional con link a `/dpa`.
- Si una clínica objeta a Google LLC en 15 días, se documenta la objeción y se le impide conectar Google Calendar (que ya es opt-in, así que es equivalente a "no conectarlo").

### Alternativa (NO recomendada por desproporción)

Invalidar todas las `dpa_accepted_at` en BD y forzar re-aceptación universal. Sólo procede si Octavio considera que algún cambio es contractualmente sustantivo en sentido restrictivo para la clínica — no es el caso aquí.

---

## Aprobación

```
[ ] APROBADO, ejecutar bump v1.5 en Fase 2/3
    (incluye estrategia de NO invalidar consentimientos v1.4)

[ ] APROBADO con cambios:
    Sección/cambio: __________________________________________________
    Texto alternativo: _______________________________________________

[ ] APROBADO con re-aceptación universal (invalidar dpa_accepted_at de
    clínicas existentes y forzar firma v1.5)

[ ] REVISIÓN ADICIONAL NECESARIA (asesoría externa, Davinia, etc.):
    Motivo: __________________________________________________________
```

---

## Anexo técnico (para auditoría futura)

### Archivos analizados

**Sprints docs leídos íntegros (15)**:
- `docs/sprints/SPRINT_1_STRIPE_LIVE_SETUP.md`
- `docs/sprints/SPRINT_2_AUDIT_BUGS.md`
- `docs/sprints/SPRINT_2_5_EDIT_APPOINTMENTS.md`
- `docs/sprints/SPRINT_2_5_1_MODAL_UX_POLISH.md`
- `docs/sprints/SPRINT_2_6_ADMIN_IMPERSONATION.md`
- `docs/sprints/SPRINT_2_7_REMOVE_ADMIN_API_SECRET.md`
- `docs/sprints/SPRINT_3_SUBSCRIPTION_BANNER.md`
- `docs/sprints/SPRINT_4_CUSTOMER_PORTAL.md`
- `docs/sprints/SPRINT_5_LEGAL_PAGES.md`
- `docs/sprints/SPRINT_6_CANCELLATION_FEEDBACK.md`
- `docs/sprints/SPRINT_7_CLEANUP_PRECUTOVER.md`
- `docs/sprints/SPRINT_75_CLEANUP_PRECUTOVER.md`
- `docs/sprints/SPRINT_76_DPA_AUDIT.md`
- `docs/sprints/SPRINT_76_DPA_BANNER.md`

**Migraciones SQL relevantes auditadas (34)**:
Todas en `supabase/migrations/`, en orden cronológico desde `20260310_create_services.sql` hasta `20260505225040_add_review_email_enabled_to_clinics.sql`.

**Código fuente clave revisado**:
- `app/dpa/page.tsx` (DPA v1.4 actual)
- `lib/googleCalendar.ts` (integración Google LLC)
- `lib/sendEmail.ts` (Resend)
- `lib/clinics.ts` (shape ClinicRow + Holded campo de referencia)
- `package.json` (dependencias: stripe, @supabase, googleapis, next, react; sin twilio ni @resend SDK porque se usa fetch directo)

### Mapa columnas BD con datos personales

**`clinics`** (datos del Responsable, fuera scope DPA salvo identidad):
- `name`, `slug`, `email_admin*`, `legal_name*`, `tax_id*`, `address_*`, `phone`, `notification_email`, `holded_contact_id`, `dpa_accepted_at`, `dpa_version`, `dpa_ip`, columnas `google_*` (token + email del usuario admin), columnas `stripe_*` (referencia cliente Stripe)

(*) Algunos campos viven en tabla `tax_data` desde Sprint Comercial Fase 1.

**`appointments`** (datos de pacientes, scope DPA sec. 2):
- `patient_name`, `patient_email`, `patient_phone`, `scheduled_at`, `service`, `modality`, `appointment_type`, `video_link`, `token`, `clinic_id`, `clinic_name`, `duration_label`, `datetime_label`, `status`, `reminder_sent_at`, `whatsapp_reminder_sent_at`, `review_sent_at`, `updated_by_clinic_user_id`

**`patient_deletion_log`** (auditoría ARCO, sec. 6):
- `clinic_id`, `patient_email`, `deleted_at`, `deleted_by`

**Tablas de seguridad (sec. 6)**:
- `two_factor_codes`, `login_attempts`, `rate_limit_events`, `impersonation_tokens`, `stripe_events_processed`

**Tablas comerciales/operativas (fuera scope DPA pacientes)**:
- `services`, `clinic_hours`, `clinic_blocks`, `clinic_users`, `invoices`, `tax_data`, `subscription_cancellations`

### Findings detallados por sección

**Sección 2** — 3 campos no documentados en v1.4 (video_link, token, appointment_type). Ninguno es dato sensible.

**Sección 4** — 1 subencargado faltante (Google LLC). Holded NO entra. WhatsApp Business NO se usa.

**Sección 5** — sin gap. Régimen DPF/CCE cubre Google LLC.

**Sección 6** — 7 medidas implementadas no documentadas:
1. HMAC firma webhooks (Sprint 1)
2. Idempotencia eventos (`stripe_events_processed`, Sprint Comercial Fase 1)
3. Auditoría impersonación TTL 60 min (Sprint 2.6)
4. Rate limit genérico signup/booking (`rate_limit_events`)
5. Log eliminación ARCO (`patient_deletion_log`)
6. Sin secretos en bundle cliente (Sprint 2.7)
7. Cifrado en reposo (Supabase, implícito)

**Sección 7** — clarificación WhatsApp manual (no Business API).

### Notas Tier 2 detectadas (NO actuar en este sprint)

Heredadas del audit + nuevas en esta fase:

- **T2-DPA-1**: banner DPA no aparece en subrutas `/clinic/[slug]/*` (revertido en Sprint 7.6, debug Next.js pendiente).
- **T2-DPA-2 a T2-DPA-6**: heredados de Sprint 7.6 (ver SPRINT_76_DPA_AUDIT.md).
- **T2-DPA-7**: `scripts/create-clinic.mjs` no popula `dpa_accepted_at`; clínicas creadas por script nacen sin DPA aceptado. Hoy son sólo 2 clínicas test, irrelevante.
- **T2-DPA-8 (nuevo, opcional)**: la sec. 4 actual lista Stripe como "procesamiento de pagos (solo datos de clínicas)". El paréntesis es correcto pero podría reforzarse paralelamente para Google ("solo si la clínica conecta su cuenta") — ya incluido en la propuesta v1.5 de arriba.
- **T2-DPA-9 (nuevo, opcional)**: tabla `admin_audit_log` formal para impersonación (deuda Sprint 7.5 mencionada en doc de cierre); hoy se cubre con `impersonation_tokens` + console logs `[admin-impersonation] start/end`. Si se materializa, sec. 6 se podría reforzar en una v1.6 futura.
- **T2-DPA-10 (nuevo)**: Holded actualmente sólo es un campo de referencia (`holded_contact_id`, `holded_invoice_id`). Si en el futuro se integra API Holded para emisión automática de facturas (datos fiscales del cliente), revisar si eso requiere mención explícita en el DPA o queda cubierto por la Política de Privacidad B2B (datos del Responsable como cliente, no datos de pacientes).
