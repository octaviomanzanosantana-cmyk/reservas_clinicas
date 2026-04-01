-- Mejora 1: Email de copia para la clínica al recibir reservas
alter table public.clinics
  add column if not exists notification_email text;

-- Mejora 2: Enlace de reseñas Google
alter table public.clinics
  add column if not exists review_url text;

-- Mejora 3: Horas de antelación para el recordatorio (24, 48, 72)
alter table public.clinics
  add column if not exists reminder_hours integer not null default 48;
