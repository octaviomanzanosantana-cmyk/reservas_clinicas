-- WhatsApp reminders: sistema de recordatorios asistidos sin WhatsApp Business API.
-- Dos piezas complementarias (email matinal + panel dedicado) usan estas columnas.
--
-- Nota sobre el índice: se usa `scheduled_at` (nombre real de la columna en
-- appointments) — el spec inicial mencionaba `start_time` por error.

-- 1) Flag por clínica para activar el email matinal automático
ALTER TABLE clinics
ADD COLUMN whatsapp_daily_reminders_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN clinics.whatsapp_daily_reminders_enabled IS
  'Si está activado, cada mañana a las 9:00 hora local se envía un email con los recordatorios de WhatsApp de las citas del día siguiente.';

-- 2) Marca por cita de "recordatorio enviado"
ALTER TABLE appointments
ADD COLUMN whatsapp_reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN appointments.whatsapp_reminder_sent_at IS
  'Fecha y hora en que la clínica marcó esta cita como "recordatorio enviado". Se resetea cada noche para permitir re-envío si fuera necesario.';

CREATE INDEX idx_appointments_whatsapp_reminder
  ON appointments (clinic_id, scheduled_at, whatsapp_reminder_sent_at);
