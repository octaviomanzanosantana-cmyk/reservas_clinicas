-- =============================================================================
-- Sprint Comercial · Fase 2A · Chat 2
-- Fecha: 2026-04-23
-- Autor: Octavio Manzano
--
-- Actualiza tax_data para el flujo de captura de datos fiscales:
-- - Migra CHECK de tax_id_type: (dni, cif, nie, vat_eu)
--   → (cif, dni_autonomo, nie_empresarial, vat_eu)
-- - Añade columna tax_regime (igic_7, isp, isp_intra_ue, iva_21)
-- - Añade trigger updated_at automático
-- - Añade policy INSERT para service_role (faltaba)
--
-- Decisiones arquitectónicas:
-- - tax_regime almacenado (no calculado): simplifica reporting y
--   copia a invoices.tax_regime sin reimplementar lógica.
-- - Particulares bloqueados: el enum no incluye 'dni' ni 'nie'
--   particular. Solo se permite dni_autonomo / nie_empresarial
--   (con actividad económica).
-- - Trigger updated_at: consistencia garantizada sin depender
--   de código cliente.
-- - INSERT solo para service_role: formulario pasa por API route.
--
-- Este archivo documenta el SQL ya aplicado manualmente en producción
-- el 23/04/2026. NO ejecutar con supabase db push si la BD remota
-- ya lo tiene aplicado.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Safety check: abortar si tax_data tuviera datos inesperados
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM tax_data;
  IF row_count > 0 THEN
    RAISE EXCEPTION 'tax_data no está vacía (% filas). Abortando migración de enum para evitar pérdida de datos. Revisa manualmente.', row_count;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Migrar CHECK constraint de tax_id_type
-- -----------------------------------------------------------------------------
ALTER TABLE tax_data
  DROP CONSTRAINT IF EXISTS tax_data_tax_id_type_check;

ALTER TABLE tax_data
  ADD CONSTRAINT tax_data_tax_id_type_check
  CHECK (tax_id_type IN ('cif', 'dni_autonomo', 'nie_empresarial', 'vat_eu'));

-- -----------------------------------------------------------------------------
-- 3. Añadir columna tax_regime
-- -----------------------------------------------------------------------------
ALTER TABLE tax_data
  ADD COLUMN IF NOT EXISTS tax_regime TEXT
    CHECK (tax_regime IN ('igic_7', 'isp', 'isp_intra_ue', 'iva_21'));

COMMENT ON COLUMN tax_data.tax_regime IS
  'Régimen fiscal calculado al guardar. igic_7 = Canarias, isp = empresa/autónomo peninsular (inversión sujeto pasivo), isp_intra_ue = empresa UE con VAT, iva_21 = particular peninsular (BLOQUEADO en v1).';

-- -----------------------------------------------------------------------------
-- 4. Policy INSERT para service_role (faltaba en Fase 1)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can insert tax_data" ON tax_data;

CREATE POLICY "Service role can insert tax_data"
  ON tax_data FOR INSERT
  TO service_role
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 5. Trigger para updated_at automático
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION tax_data_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tax_data_updated_at_trigger ON tax_data;

CREATE TRIGGER tax_data_updated_at_trigger
  BEFORE UPDATE ON tax_data
  FOR EACH ROW
  EXECUTE FUNCTION tax_data_set_updated_at();

COMMIT;
