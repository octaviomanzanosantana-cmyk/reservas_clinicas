-- Rate limiting para login (protección fuerza bruta)
CREATE TABLE IF NOT EXISTS login_attempts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text
);

ALTER TABLE login_attempts DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts(attempted_at);
