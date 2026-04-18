-- Clinic blocks: rangos de fechas en los que la clínica no acepta reservas
-- (vacaciones, días no laborables, eventos, etc.)
--
-- Relacionada con lógica de disponibilidad: `lib/clinicAvailability.ts` y
-- endpoint público `/api/clinic-hours/active-days` consultan esta tabla
-- para desactivar fechas bloqueadas en el calendario público.

CREATE TABLE clinic_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT valid_range CHECK (end_date >= start_date)
);

CREATE INDEX idx_clinic_blocks_clinic_range
  ON clinic_blocks (clinic_id, start_date, end_date);

ALTER TABLE clinic_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic owners can view their blocks"
  ON clinic_blocks FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Clinic owners can insert their blocks"
  ON clinic_blocks FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM clinic_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Clinic owners can delete their blocks"
  ON clinic_blocks FOR DELETE
  USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_users WHERE user_id = auth.uid()
    )
  );
