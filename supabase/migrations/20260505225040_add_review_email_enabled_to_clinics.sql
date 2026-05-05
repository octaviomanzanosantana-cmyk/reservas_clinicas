ALTER TABLE public.clinics
ADD COLUMN IF NOT EXISTS review_email_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.clinics.review_email_enabled IS
'Controla si la clínica envía emails de solicitud de reseña tras primera_visita completed. Default true para preservar comportamiento actual.';
