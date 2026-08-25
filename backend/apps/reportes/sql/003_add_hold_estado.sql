-- ============================================================================
-- Agrega el estado HOLD a TREP_PROBLEMA ("esperando aprobacion externa" --
-- usado por el runner ZentoryERP-Reportes-AutoFix cuando un fix requiere una
-- decision humana y no puede avanzar solo, en vez de dejarlo mudo en
-- EN_PROGRESO).
-- Owner: ABREGONZA
--
-- Correr manualmente:
--   docker compose exec backend python apps/reportes/sql/_run_003.py
-- ============================================================================

ALTER TABLE ABREGONZA.TREP_PROBLEMA DROP CONSTRAINT CK_TREP_PROB_ESTADO;
/

ALTER TABLE ABREGONZA.TREP_PROBLEMA ADD CONSTRAINT CK_TREP_PROB_ESTADO CHECK (
    ESTADO IN ('ABIERTO','EN_PROGRESO','HOLD','COMPLETADO','CANCELADO')
);
/

COMMIT;
EXIT;
