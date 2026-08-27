-- ============================================================================
-- TREP_MENSAJE: hilo de preguntas/respuestas sobre un reporte en HOLD.
-- El runner ZentoryERP-Reportes-AutoFix escribe ROL='RUNNER' al pedir una
-- decision humana (ESTADO=HOLD); el autor del reporte (o un admin) responde
-- con ROL='USUARIO', lo que reabre el reporte a ABIERTO para que la proxima
-- corrida del runner lo retome con el contexto de la respuesta.
-- Owner: ABREGONZA
--
-- Correr manualmente:
--   docker compose exec backend python apps/reportes/sql/_run_004.py
-- ============================================================================

CREATE TABLE ABREGONZA.TREP_MENSAJE (
    MENSAJE_ID      VARCHAR2(36)  NOT NULL,
    REPORTE_ID      VARCHAR2(36)  NOT NULL,
    ROL             VARCHAR2(10)  NOT NULL,
    CONTENIDO       CLOB          NOT NULL,
    USUARIO         VARCHAR2(30),
    FECHA_CREACION  DATE DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_TREP_MENSAJE PRIMARY KEY (MENSAJE_ID),
    CONSTRAINT FK_TREP_MSG_REPORTE
        FOREIGN KEY (REPORTE_ID) REFERENCES ABREGONZA.TREP_PROBLEMA(REPORTE_ID)
        ON DELETE CASCADE,
    CONSTRAINT CK_TREP_MSG_ROL CHECK (ROL IN ('RUNNER','USUARIO'))
)
/

CREATE INDEX IX_TREP_MSG_REPORTE ON ABREGONZA.TREP_MENSAJE (REPORTE_ID, FECHA_CREACION)
/

GRANT SELECT, INSERT, UPDATE, DELETE ON ABREGONZA.TREP_MENSAJE TO JCABREU
/

CREATE OR REPLACE SYNONYM JCABREU.TREP_MENSAJE FOR ABREGONZA.TREP_MENSAJE
/

COMMIT;
EXIT;
