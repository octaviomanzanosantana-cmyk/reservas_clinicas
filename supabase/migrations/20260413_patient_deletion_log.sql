-- Log de eliminación de datos de pacientes (ARCO)
CREATE TABLE IF NOT EXISTS patient_deletion_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id text NOT NULL,
  patient_email text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by text NOT NULL
);
