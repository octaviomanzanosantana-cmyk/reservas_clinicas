alter table public.clinics
add column if not exists google_connected boolean not null default false,
add column if not exists google_email text,
add column if not exists google_refresh_token text,
add column if not exists google_calendar_id text;
