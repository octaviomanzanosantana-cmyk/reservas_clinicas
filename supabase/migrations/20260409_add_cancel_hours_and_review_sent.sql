-- Sprint 1: cancel_hours_limit en clinics + review_sent_at en appointments
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS cancel_hours_limit integer DEFAULT 24;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS review_sent_at timestamptz;
