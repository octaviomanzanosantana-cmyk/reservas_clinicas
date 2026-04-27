-- Alinear invoices.tax_regime con tax_data.tax_regime + lib/taxData.ts
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_tax_regime_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_tax_regime_check
  CHECK (tax_regime IN ('igic_7', 'iva_21', 'isp', 'isp_intra_ue', 'none'));
