-- ============================================================================
-- TCHAT_* : tablas del Asistente en pagina (ZentoryERP)
-- Owner: ABREGONZA
-- Spec : backend/docs/superpowers/specs/2026-06-28-asistente-en-pagina-design.md
-- NO se ejecuta automaticamente. Correr manualmente:
--   sqlplus JCABREU/508192003@AB @backend/apps/asistente/sql/001_create_tchat.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) TCHAT_CONVERSACION
-- ----------------------------------------------------------------------------
CREATE TABLE ABREGONZA.TCHAT_CONVERSACION (
    CONV_ID         VARCHAR2(36) NOT NULL,
    USUARIO         VARCHAR2(30) NOT NULL,
    NO_CIA          VARCHAR2(2),
    PUNTO           VARCHAR2(2),
    TITULO          VARCHAR2(200),
    MODEL           VARCHAR2(40) DEFAULT 'claude-haiku-4-5',
    SKILL_ACTIVA    VARCHAR2(60),
    FECHA_CREACION  DATE         DEFAULT SYSDATE NOT NULL,
    FECHA_ULTIMO    DATE         DEFAULT SYSDATE NOT NULL,
    ARCHIVADA       CHAR(1)      DEFAULT 'N' NOT NULL,
    TOKENS_IN_TOT   NUMBER(10)   DEFAULT 0,
    TOKENS_OUT_TOT  NUMBER(10)   DEFAULT 0,
    COSTO_USD       NUMBER(12,6) DEFAULT 0,
    CONSTRAINT PK_TCHAT_CONV PRIMARY KEY (CONV_ID),
    CONSTRAINT CK_TCHAT_CONV_ARCH CHECK (ARCHIVADA IN ('S','N'))
);

CREATE INDEX IX_TCHAT_CONV_USR_FUL
    ON ABREGONZA.TCHAT_CONVERSACION (USUARIO, FECHA_ULTIMO DESC);

-- ----------------------------------------------------------------------------
-- 2) TCHAT_MENSAJE
-- ----------------------------------------------------------------------------
CREATE TABLE ABREGONZA.TCHAT_MENSAJE (
    MENSAJE_ID      VARCHAR2(36) NOT NULL,
    CONV_ID         VARCHAR2(36) NOT NULL,
    SEQ             NUMBER(6)    NOT NULL,
    ROLE            VARCHAR2(15) NOT NULL,
    CONTENIDO       CLOB,
    TOOL_CALLS_JSON CLOB,
    TOOL_CALL_ID    VARCHAR2(40),
    TOKENS_IN       NUMBER(8)    DEFAULT 0,
    TOKENS_OUT      NUMBER(8)    DEFAULT 0,
    CACHE_HIT_IN    NUMBER(8)    DEFAULT 0,
    COSTO_USD       NUMBER(12,6) DEFAULT 0,
    FECHA_CREACION  DATE         DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_TCHAT_MSG PRIMARY KEY (MENSAJE_ID),
    CONSTRAINT FK_TCHAT_MSG_CONV
        FOREIGN KEY (CONV_ID) REFERENCES ABREGONZA.TCHAT_CONVERSACION(CONV_ID)
        ON DELETE CASCADE,
    CONSTRAINT UQ_TCHAT_MSG_SEQ UNIQUE (CONV_ID, SEQ),
    CONSTRAINT CK_TCHAT_MSG_ROLE CHECK (ROLE IN ('user','assistant','tool'))
);

CREATE INDEX IX_TCHAT_MSG_CONV ON ABREGONZA.TCHAT_MENSAJE (CONV_ID, SEQ);

-- ----------------------------------------------------------------------------
-- 3) TCHAT_TOOL_PENDING
-- ----------------------------------------------------------------------------
CREATE TABLE ABREGONZA.TCHAT_TOOL_PENDING (
    SIG             VARCHAR2(32) NOT NULL,
    CONV_ID         VARCHAR2(36) NOT NULL,
    MENSAJE_ID      VARCHAR2(36),
    TOOL_NAME       VARCHAR2(60) NOT NULL,
    ARGS_JSON       CLOB,
    PREVIEW         VARCHAR2(500),
    STATUS          CHAR(1)      DEFAULT 'P' NOT NULL,
    USUARIO         VARCHAR2(30) NOT NULL,
    FECHA_CREACION  DATE         DEFAULT SYSDATE NOT NULL,
    FECHA_EXPIRA    DATE         NOT NULL,
    FECHA_RESUELTA  DATE,
    CONSTRAINT PK_TCHAT_PEND PRIMARY KEY (SIG),
    CONSTRAINT CK_TCHAT_PEND_ST CHECK (STATUS IN ('P','A','R','X'))
);

CREATE INDEX IX_TCHAT_PEND_USR ON ABREGONZA.TCHAT_TOOL_PENDING (USUARIO, STATUS);
CREATE INDEX IX_TCHAT_PEND_EXP ON ABREGONZA.TCHAT_TOOL_PENDING (STATUS, FECHA_EXPIRA);

-- ----------------------------------------------------------------------------
-- 4) TCHAT_TOOL_LOG  (auditoria)
-- ----------------------------------------------------------------------------
CREATE TABLE ABREGONZA.TCHAT_TOOL_LOG (
    LOG_ID          VARCHAR2(36) NOT NULL,
    CONV_ID         VARCHAR2(36),
    MENSAJE_ID      VARCHAR2(36),
    USUARIO         VARCHAR2(30) NOT NULL,
    NO_CIA          VARCHAR2(2),
    PUNTO           VARCHAR2(2),
    TOOL_NAME       VARCHAR2(60) NOT NULL,
    ARGS_HASH       VARCHAR2(64),
    ARGS_PREVIEW    VARCHAR2(500),
    OK              CHAR(1)      NOT NULL,
    ERROR_CODE      VARCHAR2(40),
    DURATION_MS     NUMBER(8),
    WAS_WRITE       CHAR(1)      DEFAULT 'N',
    CONFIRMED_BY    VARCHAR2(30),
    FECHA           DATE         DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_TCHAT_LOG PRIMARY KEY (LOG_ID),
    CONSTRAINT CK_TCHAT_LOG_OK CHECK (OK IN ('S','N')),
    CONSTRAINT CK_TCHAT_LOG_WR CHECK (WAS_WRITE IN ('S','N'))
);

CREATE INDEX IX_TCHAT_LOG_USR ON ABREGONZA.TCHAT_TOOL_LOG (USUARIO, FECHA DESC);
CREATE INDEX IX_TCHAT_LOG_CONV ON ABREGONZA.TCHAT_TOOL_LOG (CONV_ID, FECHA);

-- ----------------------------------------------------------------------------
-- Grants para JCABREU (esquema de app)
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON ABREGONZA.TCHAT_CONVERSACION TO JCABREU;
GRANT SELECT, INSERT, UPDATE, DELETE ON ABREGONZA.TCHAT_MENSAJE      TO JCABREU;
GRANT SELECT, INSERT, UPDATE, DELETE ON ABREGONZA.TCHAT_TOOL_PENDING TO JCABREU;
GRANT SELECT, INSERT, UPDATE, DELETE ON ABREGONZA.TCHAT_TOOL_LOG     TO JCABREU;

CREATE OR REPLACE SYNONYM JCABREU.TCHAT_CONVERSACION FOR ABREGONZA.TCHAT_CONVERSACION;
CREATE OR REPLACE SYNONYM JCABREU.TCHAT_MENSAJE      FOR ABREGONZA.TCHAT_MENSAJE;
CREATE OR REPLACE SYNONYM JCABREU.TCHAT_TOOL_PENDING FOR ABREGONZA.TCHAT_TOOL_PENDING;
CREATE OR REPLACE SYNONYM JCABREU.TCHAT_TOOL_LOG     FOR ABREGONZA.TCHAT_TOOL_LOG;

COMMIT;
EXIT;
