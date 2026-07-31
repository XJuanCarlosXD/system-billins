-- ============================================================================
-- TSYS_ERROR_LOG : registro automatico de errores para Reportes/Soporte
-- Owner: ABREGONZA
-- Spec : backend/docs/superpowers/specs/2026-07-31-historial-auditoria-design.md
-- NO se ejecuta automaticamente. Correr manualmente:
--   docker compose exec backend python apps/reportes/sql/_run_002.py
--
-- NOTA (desviación del plan original): el plan pedía ERROR_ID como NUMBER
-- GENERATED ALWAYS AS IDENTITY, pero esta instancia es Oracle 11g y esa
-- sintaxis requiere 12c+ (falla con ORA-02000). Se usa el patrón ya
-- establecido en este mismo repo para PKs numéricos autogenerados en 11g:
-- secuencia + trigger BEFORE INSERT (ver
-- backend/apps/historial/sql/001_create_tsys_bitacora.sql). Los tipos/
-- índices/columnas restantes son exactamente los del plan.
-- ============================================================================

CREATE TABLE ABREGONZA.TSYS_ERROR_LOG (
    ERROR_ID        NUMBER PRIMARY KEY,
    FECHA           DATE          DEFAULT SYSDATE NOT NULL,
    USUARIO         VARCHAR2(30),
    MODULO          VARCHAR2(20),
    URL             VARCHAR2(500),
    STATUS_HTTP     NUMBER(5),
    MENSAJE         VARCHAR2(1000) NOT NULL,
    DETALLE         CLOB,
    REPORTE_ID      VARCHAR2(36)
);
/

CREATE SEQUENCE ABREGONZA.SEQ_TSYS_ERROR_LOG;
/

CREATE OR REPLACE TRIGGER ABREGONZA.TRG_TSYS_ERROR_LOG_ID
BEFORE INSERT ON ABREGONZA.TSYS_ERROR_LOG
FOR EACH ROW
WHEN (NEW.ERROR_ID IS NULL)
BEGIN
    :NEW.ERROR_ID := ABREGONZA.SEQ_TSYS_ERROR_LOG.NEXTVAL;
END;
/

CREATE INDEX IX_TSYS_ERROR_LOG_FECHA ON ABREGONZA.TSYS_ERROR_LOG (FECHA DESC);
/

GRANT SELECT, INSERT, UPDATE, DELETE ON ABREGONZA.TSYS_ERROR_LOG TO JCABREU;
/

GRANT SELECT ON ABREGONZA.SEQ_TSYS_ERROR_LOG TO JCABREU;
/

CREATE OR REPLACE SYNONYM JCABREU.TSYS_ERROR_LOG    FOR ABREGONZA.TSYS_ERROR_LOG;
/

CREATE OR REPLACE SYNONYM JCABREU.SEQ_TSYS_ERROR_LOG FOR ABREGONZA.SEQ_TSYS_ERROR_LOG;
/

COMMIT;
EXIT;
