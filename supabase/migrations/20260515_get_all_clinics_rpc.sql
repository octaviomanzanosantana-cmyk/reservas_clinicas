-- =============================================
-- Sprint Bug RLS Admin — Plan B Bug 1
-- Fecha: 2026-05-15
-- =============================================
-- RPC SECURITY DEFINER para listar clinicas desde panel admin.
-- Bypasea cualquier estado de pool/role stale (PgBouncer e4)
-- porque la funcion se ejecuta como su owner (postgres) y no
-- depende del SET LOCAL role del cliente.
--
-- Consumidor unico: app/api/admin/clinic-stats/route.ts
-- (protegido upstream por getAdminUser).
--
-- Shape devuelto: 9 columnas estrictas (no SETOF public.clinics)
-- para evitar arrastrar campos RGPD-sensibles (google_refresh_token,
-- dpa_ip, holded_contact_id, etc.) en una respuesta JSON nueva.
-- =============================================

begin;

create or replace function public.get_all_clinics()
returns table (
  id uuid,
  slug text,
  name text,
  plan text,
  is_demo boolean,
  created_at timestamptz,
  subscription_status text,
  trial_ends_at timestamptz,
  stripe_subscription_id text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    c.id,
    c.slug,
    c.name,
    c.plan,
    c.is_demo,
    c.created_at,
    c.subscription_status,
    c.trial_ends_at,
    c.stripe_subscription_id
  from public.clinics c
  order by c.created_at desc;
$$;

-- Cerrar EXECUTE por defecto a todos los roles.
revoke execute on function public.get_all_clinics() from public;
revoke execute on function public.get_all_clinics() from anon, authenticated;

-- Solo service_role puede invocar (consumido desde supabaseAdmin server-side).
grant execute on function public.get_all_clinics() to service_role;

comment on function public.get_all_clinics() is
  'Bug 1 RLS Admin — SECURITY DEFINER bypass para listado admin de clinicas. '
  'Aplicada 2026-05-15. Consumida solo por /api/admin/clinic-stats.';

commit;
