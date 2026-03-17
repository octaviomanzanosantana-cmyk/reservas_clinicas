alter table public.appointments
add column if not exists patient_email text;
