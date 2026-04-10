-- Enlace de videollamada por cita online
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS video_link text;
