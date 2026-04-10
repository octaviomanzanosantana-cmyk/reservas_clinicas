-- Permitir múltiples tramos horarios por día (ej: mañana 09-14, tarde 16-20)
ALTER TABLE clinic_hours DROP CONSTRAINT IF EXISTS clinic_hours_clinic_slug_day_of_week_key;
