-- 2FA: códigos de verificación de doble factor
CREATE TABLE IF NOT EXISTS two_factor_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_two_factor_codes_user_id ON two_factor_codes (user_id);

-- Disable RLS — only accessed via service role from server-side API routes
ALTER TABLE two_factor_codes DISABLE ROW LEVEL SECURITY;
