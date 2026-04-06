alter table public.clinics
  add column if not exists timezone text not null default 'Atlantic/Canary';
