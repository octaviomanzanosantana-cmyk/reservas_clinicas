alter table public.clinics
add column if not exists google_token_scope text,
add column if not exists google_token_type text,
add column if not exists google_token_expires_at timestamptz;
