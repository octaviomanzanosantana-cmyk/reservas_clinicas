create extension if not exists pgcrypto;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  clinic_slug text not null,
  name text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_clinic_slug_name_key unique (clinic_slug, name)
);

create index if not exists services_clinic_slug_idx
  on public.services (clinic_slug);

create index if not exists services_clinic_slug_active_idx
  on public.services (clinic_slug, active);

insert into public.services (clinic_slug, name, duration_minutes, active)
values
  ('pilarcastillo', 'Diagnóstico capilar', 30, true),
  ('pilarcastillo', 'Mesoterapia capilar', 30, true),
  ('pilarcastillo', 'Revisión', 20, true),
  ('fisio-demo', 'Fisioterapia deportiva', 45, true),
  ('fisio-demo', 'Masaje terapéutico', 45, true),
  ('fisio-demo', 'Readaptación', 60, true),
  ('dental-demo', 'Revisión dental', 30, true),
  ('dental-demo', 'Higiene', 45, true),
  ('dental-demo', 'Ortodoncia', 45, true)
on conflict (clinic_slug, name) do nothing;
