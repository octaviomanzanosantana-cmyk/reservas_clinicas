-- Desacoplar notification_email de los 2 canales que hoy comparten:
--   1. Copias de confirmación de cita a la clínica
--   2. Email matinal de recordatorios WhatsApp (Sprint 3)
--
-- Reemplaza `whatsapp_daily_reminders_enabled` (booleano acoplado a
-- reminders-only) por dos flags independientes. notification_email se
-- mantiene como destino común de ambos.

ALTER TABLE clinics
  ADD COLUMN notify_on_new_appointment BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN notify_on_whatsapp_reminder BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN clinics.notify_on_new_appointment IS
  'Si está activo, la clínica recibe copia del email transaccional (confirmación, reprogramación, cancelación) cada vez que hay cambio en una cita.';
COMMENT ON COLUMN clinics.notify_on_whatsapp_reminder IS
  'Si está activo, la clínica recibe email matinal con recordatorios para enviar por WhatsApp.';

-- Preservar comportamiento de clínicas existentes:
-- Si venían con notification_email configurado → recibían copias → mantener.
UPDATE clinics
SET notify_on_new_appointment = TRUE
WHERE notification_email IS NOT NULL
  AND TRIM(notification_email) != '';

-- Si tenían el toggle WhatsApp activo → mantener en el nuevo flag.
UPDATE clinics
SET notify_on_whatsapp_reminder = TRUE
WHERE whatsapp_daily_reminders_enabled = TRUE;

-- Columna antigua reemplazada. DROP después del UPDATE de migración
-- para no perder el dato intermedio.
ALTER TABLE clinics DROP COLUMN whatsapp_daily_reminders_enabled;
