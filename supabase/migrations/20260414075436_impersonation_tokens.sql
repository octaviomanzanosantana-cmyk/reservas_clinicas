-- Tokens temporales de impersonación para superadmin
CREATE TABLE IF NOT EXISTS impersonation_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token text NOT NULL UNIQUE,
  clinic_slug text NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

ALTER TABLE impersonation_tokens DISABLE ROW LEVEL SECURITY;
