-- Rate limit events: tabla genérica para limitar intentos por IP o email
-- en endpoints públicos (signup, booking). Reemplaza la necesidad de un
-- store externo tipo Redis.
--
-- Cada inserción = 1 intento. El chequeo cuenta filas dentro de una ventana
-- temporal para (kind, key).

CREATE TABLE rate_limit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limit_events_lookup
  ON rate_limit_events (kind, key, created_at DESC);

-- RLS activado SIN políticas explícitas: deny-by-default para anon y
-- authenticated keys. Los endpoints del servidor usan el service_role
-- client (lib/supabaseAdmin.ts), que bypasa RLS — por eso el rate limit
-- sigue funcionando aunque RLS esté ON.
--
-- Sin RLS, cualquiera con la anon key podría leer IPs (datos personales,
-- violación RGPD) o insertar eventos falsos para saturar/bypass del limit.
ALTER TABLE rate_limit_events ENABLE ROW LEVEL SECURITY;
