-- Modalidad de la cita (presencial u online)
alter table public.appointments
  add column if not exists modality text not null default 'presencial';

-- Tipo de cita (primera visita o revisión)
alter table public.appointments
  add column if not exists appointment_type text not null default 'primera_visita';

-- Configuración por clínica: qué modalidades ofrece
alter table public.clinics
  add column if not exists offers_presencial boolean not null default true;

alter table public.clinics
  add column if not exists offers_online boolean not null default false;
