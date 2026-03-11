create extension if not exists pgcrypto;

create table if not exists public.clinic_hours (
  id uuid primary key default gen_random_uuid(),
  clinic_slug text not null,
  day_of_week integer not null,
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_hours_day_of_week_check check (day_of_week between 1 and 7),
  constraint clinic_hours_time_range_check check (end_time > start_time),
  constraint clinic_hours_clinic_slug_day_of_week_key unique (clinic_slug, day_of_week)
);

create index if not exists clinic_hours_clinic_slug_idx
on public.clinic_hours (clinic_slug);

create index if not exists clinic_hours_clinic_slug_day_of_week_idx
on public.clinic_hours (clinic_slug, day_of_week);

create index if not exists clinic_hours_clinic_slug_active_idx
on public.clinic_hours (clinic_slug, active);

insert into public.clinic_hours (clinic_slug, day_of_week, start_time, end_time, active)
values
  ('pilarcastillo', 1, '09:00', '18:00', true),
  ('pilarcastillo', 2, '09:00', '18:00', true),
  ('pilarcastillo', 3, '09:00', '18:00', true),
  ('pilarcastillo', 4, '09:00', '18:00', true),
  ('pilarcastillo', 5, '09:00', '18:00', true)
on conflict (clinic_slug, day_of_week) do nothing;
