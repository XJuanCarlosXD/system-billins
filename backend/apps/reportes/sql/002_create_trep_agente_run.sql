-- ============================================================================
-- TREP_AGENTE_RUN : corridas del boton "Resolver todo con Agente"
-- Owner: ABREGONZA
-- Spec : backend/docs/superpowers/specs/2026-07-30-agente-reportes-boton-design.md
-- NO se ejecuta automaticamente. Correr manualmente:
--   sqlplus JCABREU/508192003@AB @backend/apps/reportes/sql/002_create_trep_agente_run.sql
-- ============================================================================

CREATE TABLE ABREGONZA.TREP_AGENTE_RUN (
    RUN_ID           VARCHAR2(36)  NOT NULL,
    ESTADO           VARCHAR2(20)  DEFAULT 'PENDIENTE' NOT NULL,
    SOLICITADO_POR   VARCHAR2(50)  NOT NULL,
    FECHA_SOLICITUD  DATE DEFAULT SYSDATE NOT NULL,
    FECHA_FIN        DATE,
    RESUMEN          CLOB,
    COMMIT_SHA       VARCHAR2(40),
    CONSTRAINT PK_TREP_AGENTE_RUN PRIMARY KEY (RUN_ID),
    CONSTRAINT CK_TREP_AGENTE_RUN_ESTADO CHECK (
        ESTADO IN ('PENDIENTE','EN_PROCESO','COMPLETADO','ERROR')
    )
);

CREATE INDEX IX_TREP_AGENTE_RUN_ESTADO
    ON ABREGONZA.TREP_AGENTE_RUN (ESTADO, FECHA_SOLICITUD DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON ABREGONZA.TREP_AGENTE_RUN TO JCABREU;

CREATE OR REPLACE SYNONYM JCABREU.TREP_AGENTE_RUN FOR ABREGONZA.TREP_AGENTE_RUN;

COMMIT;
EXIT;
