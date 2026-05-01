-- Sprint 2.5 — Editar fecha/hora de cita desde panel clínica.
-- Auditoría: registra qué usuario de la clínica hizo el último cambio sobre la cita.
-- updated_at ya se gestiona en la app (lib/appointments.ts → updateAppointment).
-- El nuevo endpoint /api/clinic/appointments/reschedule rellena este campo
-- a partir de la sesión autenticada (lib/clinicAuth.ts → requireCurrentClinicForApi).

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS updated_by_clinic_user_id UUID
  REFERENCES public.clinic_users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.appointments.updated_by_clinic_user_id IS
  'Último usuario de la clínica que editó la cita (reschedule, update-patient futuro). NULL si la última edición no vino del panel clínica (ej. paciente reagendando desde /a/[token]).';
