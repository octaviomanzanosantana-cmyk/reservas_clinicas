-- Add UTM attribution columns to clinics for acquisition-channel tracking.
-- Captured at signup (user_metadata) and persisted on /auth/confirm.
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_content text;
