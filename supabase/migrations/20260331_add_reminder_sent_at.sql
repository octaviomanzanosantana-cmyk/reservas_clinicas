-- Columna para trackear si ya se envió el recordatorio.
-- El cron la marca al enviar, evitando duplicados en re-ejecuciones.
alter table public.appointments
  add column if not exists reminder_sent_at timestamptz;
