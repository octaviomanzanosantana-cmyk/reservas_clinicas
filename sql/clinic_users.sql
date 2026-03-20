create table if not exists public.clinic_users (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now()
);

create unique index if not exists clinic_users_user_id_key
  on public.clinic_users(user_id);

create index if not exists clinic_users_clinic_id_idx
  on public.clinic_users(clinic_id);

create unique index if not exists clinic_users_clinic_user_unique
  on public.clinic_users(clinic_id, user_id);
