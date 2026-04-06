-- =============================================
-- S1: Activar Row-Level Security en todas las tablas
-- =============================================
-- Todo el acceso a datos del servidor usa supabaseAdmin (service_role)
-- que bypasa RLS automaticamente. Estas politicas protegen contra
-- acceso directo a Supabase con la anon key desde el navegador.
--
-- Estrategia:
--   anon        → sin acceso a datos (deny all)
--   authenticated → solo datos de su propia clinica (defensa en profundidad)
--   service_role  → acceso total (bypasa RLS, es lo que usa el servidor)
--
-- Nota sobre tipos:
--   clinic_users.clinic_id es UUID (FK a clinics.id)
--   appointments.clinic_id es TEXT (almacena UUIDs como texto)
--   services.clinic_slug y clinic_hours.clinic_slug son TEXT
--   Las subqueries resuelven el slug del usuario via JOINs para evitar
--   comparaciones entre tipos incompatibles.
-- =============================================

-- 1. ACTIVAR RLS EN TODAS LAS TABLAS
alter table public.clinics enable row level security;
alter table public.services enable row level security;
alter table public.clinic_hours enable row level security;
alter table public.clinic_users enable row level security;
alter table public.appointments enable row level security;

-- =============================================
-- 2. POLITICAS PARA clinic_users
-- =============================================
-- Un usuario autenticado solo puede ver su propio registro.
-- user_id (uuid) = auth.uid() (uuid) → mismo tipo, sin problema.
create policy "clinic_users_select_own"
  on public.clinic_users for select
  to authenticated
  using (user_id = auth.uid());

-- =============================================
-- 3. POLITICAS PARA clinics
-- =============================================
-- Un usuario autenticado solo puede leer su propia clinica.
-- clinics.id (uuid) vs clinic_users.clinic_id (uuid) → mismo tipo.
create policy "clinics_select_own"
  on public.clinics for select
  to authenticated
  using (
    exists (
      select 1 from public.clinic_users cu
      where cu.clinic_id = clinics.id
        and cu.user_id = auth.uid()
    )
  );

-- Solo owner puede actualizar su clinica
create policy "clinics_update_own"
  on public.clinics for update
  to authenticated
  using (
    exists (
      select 1 from public.clinic_users cu
      where cu.clinic_id = clinics.id
        and cu.user_id = auth.uid()
    )
  );

-- =============================================
-- 4. POLITICAS PARA services
-- =============================================
-- services.clinic_slug (text) se compara con clinics.slug (text)
-- via JOIN con clinic_users para resolver la clinica del usuario.
create policy "services_select_own_clinic"
  on public.services for select
  to authenticated
  using (
    exists (
      select 1 from public.clinics c
      inner join public.clinic_users cu on cu.clinic_id = c.id
      where c.slug = services.clinic_slug
        and cu.user_id = auth.uid()
    )
  );

create policy "services_insert_own_clinic"
  on public.services for insert
  to authenticated
  with check (
    exists (
      select 1 from public.clinics c
      inner join public.clinic_users cu on cu.clinic_id = c.id
      where c.slug = services.clinic_slug
        and cu.user_id = auth.uid()
    )
  );

create policy "services_update_own_clinic"
  on public.services for update
  to authenticated
  using (
    exists (
      select 1 from public.clinics c
      inner join public.clinic_users cu on cu.clinic_id = c.id
      where c.slug = services.clinic_slug
        and cu.user_id = auth.uid()
    )
  );

-- =============================================
-- 5. POLITICAS PARA clinic_hours
-- =============================================
-- clinic_hours.clinic_slug (text) se compara con clinics.slug (text)
-- via JOIN con clinic_users para resolver la clinica del usuario.
create policy "clinic_hours_select_own_clinic"
  on public.clinic_hours for select
  to authenticated
  using (
    exists (
      select 1 from public.clinics c
      inner join public.clinic_users cu on cu.clinic_id = c.id
      where c.slug = clinic_hours.clinic_slug
        and cu.user_id = auth.uid()
    )
  );

create policy "clinic_hours_insert_own_clinic"
  on public.clinic_hours for insert
  to authenticated
  with check (
    exists (
      select 1 from public.clinics c
      inner join public.clinic_users cu on cu.clinic_id = c.id
      where c.slug = clinic_hours.clinic_slug
        and cu.user_id = auth.uid()
    )
  );

create policy "clinic_hours_update_own_clinic"
  on public.clinic_hours for update
  to authenticated
  using (
    exists (
      select 1 from public.clinics c
      inner join public.clinic_users cu on cu.clinic_id = c.id
      where c.slug = clinic_hours.clinic_slug
        and cu.user_id = auth.uid()
    )
  );

-- =============================================
-- 6. POLITICAS PARA appointments
-- =============================================
-- appointments.clinic_id es TEXT (almacena UUIDs como cadena).
-- clinic_users.clinic_id es UUID.
-- Para evitar text = uuid, la subquery devuelve el clinic_id
-- como TEXT para que la comparacion sea text = text.
create policy "appointments_select_own_clinic"
  on public.appointments for select
  to authenticated
  using (
    exists (
      select 1 from public.clinic_users cu
      where cu.clinic_id::text = appointments.clinic_id
        and cu.user_id = auth.uid()
    )
  );

create policy "appointments_update_own_clinic"
  on public.appointments for update
  to authenticated
  using (
    exists (
      select 1 from public.clinic_users cu
      where cu.clinic_id::text = appointments.clinic_id
        and cu.user_id = auth.uid()
    )
  );

-- =============================================
-- NOTA: No hay politicas para el rol "anon".
-- Sin politicas + RLS activado = DENY ALL para anon.
-- Todo el acceso publico (reservas, disponibilidad) pasa por
-- API routes de Next.js que usan service_role (bypasa RLS).
-- =============================================
