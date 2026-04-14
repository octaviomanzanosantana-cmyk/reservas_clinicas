-- DPA (Contrato Encargo Tratamiento) — aceptación en registro
ALTER TABLE clinics
ADD COLUMN IF NOT EXISTS dpa_accepted_at timestamptz,
ADD COLUMN IF NOT EXISTS dpa_version text,
ADD COLUMN IF NOT EXISTS dpa_ip text;
