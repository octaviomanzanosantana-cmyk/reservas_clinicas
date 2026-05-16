-- =============================================
-- Sprint Bug PostgREST authenticator — Plan B endpoint impersonate
-- Fecha: 2026-05-16
-- =============================================
-- RPC SECURITY DEFINER para lookup de clinic por slug desde
-- POST /api/admin/impersonate-clinic. Bypasea el bug PostgREST
-- ejecutando queries como rol 'authenticator' (sql_state 42501)
-- en vez de 'service_role' tras la migracion interna Supabase
-- Legacy JWT Secret -> JWT Signing Keys. Reproducido 15/5/26:
-- miriamlorenzo y symbios-psicologia devolvian 404 falso.
--
-- Mismo patron que get_all_clinics aplicado el 15/5/26
-- (commit b98c21c) a /api/admin/clinic-stats.
--
-- Consumidor unico: app/api/admin/impersonate-clinic/route.ts
-- (protegido upstream por getAdminUser).
--
-- Shape devuelto: solo id uuid (que es la unica columna que
-- el endpoint lee para guard de existencia). RETURNS TABLE
-- por consistencia con [get_all_clinics] y para futura
-- ampliacion sin migration extra.
-- =============================================

begin;

create or replace function public.get_clinic_by_slug(p_slug text)
returns table (
  id uuid
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select c.id
  from public.clinics c
  where c.slug = p_slug
  limit 1;
$$;

-- Cerrar EXECUTE por defecto a todos los roles.
revoke execute on function public.get_clinic_by_slug(text) from public;
revoke execute on function public.get_clinic_by_slug(text) from anon, authenticated;

-- Solo service_role puede invocar (consumido desde supabaseAdmin server-side).
grant execute on function public.get_clinic_by_slug(text) to service_role;

comment on function public.get_clinic_by_slug(text) is
  'Bug PostgREST authenticator role — SECURITY DEFINER lookup por slug. '
  'Aplicada 2026-05-16. Consumida solo por /api/admin/impersonate-clinic.';

commit;
