-- =============================================
-- Sprint Fix RLS Performance
-- Fecha: 2026-05-12
-- =============================================
-- Reescritura de 17 policies para evaluar auth.uid() una vez por
-- query (initplan) en lugar de por fila.
--
-- Causa raiz (H6 del Sprint Bug Investigation):
--   En compute NANO con carga concurrente (cron + admin + visitas
--   publicas), auth.uid() re-evaluado por fila degrada queries hasta
--   statement_timeout o error generico. Sintoma: "clinic_users query
--   failed" intermitente en /admin/clinics, /b/<slug>, signup confirm.
--   Patron va-y-viene sin accion humana.
--
-- Fix unico aplicado: envolver auth.uid() en subquery escalar
--   (SELECT auth.uid()) para forzar evaluacion una sola vez.
--
-- Reglas preservadas literalmente (P12):
--   - Role original de cada policy (3 public + 14 authenticated)
--   - CAST (cu.clinic_id)::text en appointments (TEXT vs UUID)
--   - Patron D usa IN (subquery), NO se convierte a EXISTS
--   - Alias originales (clinic_blocks sin alias; resto con cu)
--   - Nombres de policies identicos (incluso los entrecomillados)
--
-- Indices verificados pre-fix (FASE 1.2):
--   - clinic_users_user_id_key UNIQUE on (user_id) presente
--   - clinics_slug_key UNIQUE on (slug) presente
--   - Todos los clinic_id/clinic_slug en tablas hijas cubiertos
-- =============================================

begin;

-- =============================================
-- 1. clinic_users (Patron A: auth.uid() directo)
-- =============================================
drop policy if exists "clinic_users_select_own" on public.clinic_users;
create policy "clinic_users_select_own"
  on public.clinic_users for select
  to authenticated
  using (user_id = (select auth.uid()));

-- =============================================
-- 2. clinics (Patron B: EXISTS via clinic_users)
-- =============================================
drop policy if exists "clinics_select_own" on public.clinics;
create policy "clinics_select_own"
  on public.clinics for select
  to authenticated
  using (
    exists (
      select 1 from public.clinic_users cu
      where cu.clinic_id = clinics.id
        and cu.user_id = (select auth.uid())
    )
  );

drop policy if exists "clinics_update_own" on public.clinics;
create policy "clinics_update_own"
  on public.clinics for update
  to authenticated
  using (
    exists (
      select 1 from public.clinic_users cu
      where cu.clinic_id = clinics.id
        and cu.user_id = (select auth.uid())
    )
  );

-- =============================================
-- 3. appointments (Patron B con CAST ::text)
-- =============================================
-- appointments.clinic_id es TEXT, clinic_users.clinic_id es UUID.
-- El CAST cu.clinic_id::text se preserva literal.
drop policy if exists "appointments_select_own_clinic" on public.appointments;
create policy "appointments_select_own_clinic"
  on public.appointments for select
  to authenticated
  using (
    exists (
      select 1 from public.clinic_users cu
      where cu.clinic_id::text = appointments.clinic_id
        and cu.user_id = (select auth.uid())
    )
  );

drop policy if exists "appointments_update_own_clinic" on public.appointments;
create policy "appointments_update_own_clinic"
  on public.appointments for update
  to authenticated
  using (
    exists (
      select 1 from public.clinic_users cu
      where cu.clinic_id::text = appointments.clinic_id
        and cu.user_id = (select auth.uid())
    )
  );

-- =============================================
-- 4. clinic_hours (Patron C: EXISTS con JOIN clinics+clinic_users via slug)
-- =============================================
drop policy if exists "clinic_hours_select_own_clinic" on public.clinic_hours;
create policy "clinic_hours_select_own_clinic"
  on public.clinic_hours for select
  to authenticated
  using (
    exists (
      select 1 from public.clinics c
      join public.clinic_users cu on cu.clinic_id = c.id
      where c.slug = clinic_hours.clinic_slug
        and cu.user_id = (select auth.uid())
    )
  );

drop policy if exists "clinic_hours_insert_own_clinic" on public.clinic_hours;
create policy "clinic_hours_insert_own_clinic"
  on public.clinic_hours for insert
  to authenticated
  with check (
    exists (
      select 1 from public.clinics c
      join public.clinic_users cu on cu.clinic_id = c.id
      where c.slug = clinic_hours.clinic_slug
        and cu.user_id = (select auth.uid())
    )
  );

drop policy if exists "clinic_hours_update_own_clinic" on public.clinic_hours;
create policy "clinic_hours_update_own_clinic"
  on public.clinic_hours for update
  to authenticated
  using (
    exists (
      select 1 from public.clinics c
      join public.clinic_users cu on cu.clinic_id = c.id
      where c.slug = clinic_hours.clinic_slug
        and cu.user_id = (select auth.uid())
    )
  );

-- =============================================
-- 5. services (Patron C: EXISTS con JOIN clinics+clinic_users via slug)
-- =============================================
drop policy if exists "services_select_own_clinic" on public.services;
create policy "services_select_own_clinic"
  on public.services for select
  to authenticated
  using (
    exists (
      select 1 from public.clinics c
      join public.clinic_users cu on cu.clinic_id = c.id
      where c.slug = services.clinic_slug
        and cu.user_id = (select auth.uid())
    )
  );

drop policy if exists "services_insert_own_clinic" on public.services;
create policy "services_insert_own_clinic"
  on public.services for insert
  to authenticated
  with check (
    exists (
      select 1 from public.clinics c
      join public.clinic_users cu on cu.clinic_id = c.id
      where c.slug = services.clinic_slug
        and cu.user_id = (select auth.uid())
    )
  );

drop policy if exists "services_update_own_clinic" on public.services;
create policy "services_update_own_clinic"
  on public.services for update
  to authenticated
  using (
    exists (
      select 1 from public.clinics c
      join public.clinic_users cu on cu.clinic_id = c.id
      where c.slug = services.clinic_slug
        and cu.user_id = (select auth.uid())
    )
  );

-- =============================================
-- 6. clinic_blocks (Patron D: IN subquery, role public)
-- =============================================
-- Estas 3 policies usan TO public (no authenticated). Role preservado.
-- Subquery sin alias (referencia clinic_users.clinic_id directo).
drop policy if exists "Clinic owners can view their blocks" on public.clinic_blocks;
create policy "Clinic owners can view their blocks"
  on public.clinic_blocks for select
  to public
  using (
    clinic_id in (
      select clinic_users.clinic_id
      from public.clinic_users
      where clinic_users.user_id = (select auth.uid())
    )
  );

drop policy if exists "Clinic owners can insert their blocks" on public.clinic_blocks;
create policy "Clinic owners can insert their blocks"
  on public.clinic_blocks for insert
  to public
  with check (
    clinic_id in (
      select clinic_users.clinic_id
      from public.clinic_users
      where clinic_users.user_id = (select auth.uid())
    )
  );

drop policy if exists "Clinic owners can delete their blocks" on public.clinic_blocks;
create policy "Clinic owners can delete their blocks"
  on public.clinic_blocks for delete
  to public
  using (
    clinic_id in (
      select clinic_users.clinic_id
      from public.clinic_users
      where clinic_users.user_id = (select auth.uid())
    )
  );

-- =============================================
-- 7. invoices (Patron D: IN subquery con alias cu)
-- =============================================
drop policy if exists "Clinic members read own invoices" on public.invoices;
create policy "Clinic members read own invoices"
  on public.invoices for select
  to authenticated
  using (
    clinic_id in (
      select cu.clinic_id
      from public.clinic_users cu
      where cu.user_id = (select auth.uid())
    )
  );

-- =============================================
-- 8. tax_data (Patron D: IN subquery con alias cu)
-- =============================================
-- La policy de UPDATE tiene USING + WITH CHECK; envolvemos en ambos.
drop policy if exists "Clinic members read own tax_data" on public.tax_data;
create policy "Clinic members read own tax_data"
  on public.tax_data for select
  to authenticated
  using (
    clinic_id in (
      select cu.clinic_id
      from public.clinic_users cu
      where cu.user_id = (select auth.uid())
    )
  );

drop policy if exists "Clinic members update own tax_data" on public.tax_data;
create policy "Clinic members update own tax_data"
  on public.tax_data for update
  to authenticated
  using (
    clinic_id in (
      select cu.clinic_id
      from public.clinic_users cu
      where cu.user_id = (select auth.uid())
    )
  )
  with check (
    clinic_id in (
      select cu.clinic_id
      from public.clinic_users cu
      where cu.user_id = (select auth.uid())
    )
  );

commit;

-- =============================================
-- Fin migration. 17 policies reescritas.
-- =============================================
