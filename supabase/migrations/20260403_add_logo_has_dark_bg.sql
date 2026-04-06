-- Si true, la página pública usa el color corporativo como fondo
-- del header para que logos blancos sean visibles.
alter table public.clinics
  add column if not exists logo_has_dark_bg boolean not null default false;
