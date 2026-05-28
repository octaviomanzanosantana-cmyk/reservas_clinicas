-- =============================================
-- Sprint Fix Doble Booking — parte 2 (red de seguridad DB)
-- Fecha: 2026-05-28
-- =============================================
-- Indice unique parcial sobre (clinic_id, scheduled_at) que impide
-- a nivel DB que dos citas activas compartan el mismo slot en la
-- misma clinica. Complementa la revalidacion en codigo aplicada en
-- los commits 22af5c4 (POST /api/appointments/confirm) y 562b29c
-- (POST /api/appointments/update-status), que cierran los dos
-- agujeros conocidos del incidente Isabelle/Rosa del 28/5/26.
--
-- Predicado WHERE status IS DISTINCT FROM 'cancelled' incluye NULL
-- como activo (defensa en profundidad) — solo las citas canceladas
-- liberan el slot. Cubre tambien la race condition residual del
-- patron SELECT-then-UPDATE en los endpoints de confirm/update-status
-- (T2-APPT-CONFIRM-RACE).
--
-- Modelo actual 1:1 clinic<->user. Cuando llegue multi-staff
-- (backlog Pro/Business), migrar a (clinic_id, staff_id, scheduled_at)
-- — anotado como T2-APPT-MULTI-STAFF-INDEX.
--
-- NOTA: el indice YA EXISTE en produccion (creado manualmente en el
-- SQL Editor de Supabase el 28/5/26 tras la limpieza del duplicado
-- Isabelle). IF NOT EXISTS documenta el estado sin fallar al re-aplicar.
-- =============================================

CREATE UNIQUE INDEX IF NOT EXISTS appointments_unique_slot_active
  ON appointments (clinic_id, scheduled_at)
  WHERE status IS DISTINCT FROM 'cancelled';
