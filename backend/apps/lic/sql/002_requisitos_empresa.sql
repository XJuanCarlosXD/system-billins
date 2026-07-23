-- Fase 1.5: documentos de la EMPRESA (no de la licitacion) para validar contra
-- requisitos, y el desglose de requisitos por oportunidad con su estado de
-- cumplimiento. Ejecutar manualmente, mismo patron que 001_create_tlic.sql.

-- Nota: la primera corrida de este archivo (con un bug de escapado de
-- comillas en el intento inline por shell) ya habia creado esta tabla SIN
-- PUNTO/FECHA_VENCIMIENTO -- ese CREATE TABLE quedo obsoleto y las 2
-- columnas se agregaron por separado via ALTER TABLE (ver mas abajo,
-- 2026-07-23). Se deja el CREATE TABLE completo aqui solo como referencia
-- de como se veria un ambiente nuevo desde cero.
CREATE TABLE FAT.TLIC_DOCUMENTO_EMPRESA (
    ID             NUMBER PRIMARY KEY,
    NO_CIA         VARCHAR2(2) NOT NULL,
    PUNTO          VARCHAR2(2),
    NOMBRE_ARCHIVO VARCHAR2(300) NOT NULL,
    RUTA_ARCHIVO   VARCHAR2(500) NOT NULL,
    DESCRIPCION    VARCHAR2(300),
    FECHA_VENCIMIENTO DATE,
    SUBIDO_EN      TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
);
/

CREATE SEQUENCE FAT.SEQ_TLIC_DOC_EMPRESA;
/

CREATE OR REPLACE TRIGGER FAT.TRG_TLIC_DOC_EMPRESA_ID
BEFORE INSERT ON FAT.TLIC_DOCUMENTO_EMPRESA
FOR EACH ROW
WHEN (NEW.ID IS NULL)
BEGIN
    :NEW.ID := FAT.SEQ_TLIC_DOC_EMPRESA.NEXTVAL;
END;
/

CREATE TABLE FAT.TLIC_REQUISITO (
    ID                    NUMBER PRIMARY KEY,
    OPORTUNIDAD_ID        NUMBER NOT NULL,
    DESCRIPCION           VARCHAR2(1000) NOT NULL,
    ESTADO                VARCHAR2(20) DEFAULT 'sin_evaluar' NOT NULL,
    JUSTIFICACION         VARCHAR2(1000),
    DOCUMENTO_EMPRESA_ID  NUMBER,
    ACTUALIZADO_EN        TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT FK_TLIC_REQ_OPP FOREIGN KEY (OPORTUNIDAD_ID) REFERENCES FAT.TLIC_OPORTUNIDAD(ID) ON DELETE CASCADE,
    CONSTRAINT FK_TLIC_REQ_DOCEMP FOREIGN KEY (DOCUMENTO_EMPRESA_ID) REFERENCES FAT.TLIC_DOCUMENTO_EMPRESA(ID),
    CONSTRAINT CK_TLIC_REQ_ESTADO CHECK (ESTADO IN ('cumple', 'parcial', 'no_cumple', 'sin_evaluar'))
);
/

CREATE INDEX FAT.IX_TLIC_REQ_OPP ON FAT.TLIC_REQUISITO (OPORTUNIDAD_ID);
/

CREATE SEQUENCE FAT.SEQ_TLIC_REQUISITO;
/

CREATE OR REPLACE TRIGGER FAT.TRG_TLIC_REQUISITO_ID
BEFORE INSERT ON FAT.TLIC_REQUISITO
FOR EACH ROW
WHEN (NEW.ID IS NULL)
BEGIN
    :NEW.ID := FAT.SEQ_TLIC_REQUISITO.NEXTVAL;
END;
/

ALTER TABLE FAT.TLIC_OPORTUNIDAD ADD RESUMEN_IA VARCHAR2(4000);
/

ALTER TABLE FAT.TLIC_OPORTUNIDAD ADD ESTADO_CUMPLIMIENTO VARCHAR2(10);
/

ALTER TABLE FAT.TLIC_OPORTUNIDAD ADD RECOMENDACION_IA VARCHAR2(2000);
/

-- Ver nota arriba: estas 2 columnas faltaban en la tabla real por el orden
-- de ejecucion accidentado de este archivo.
ALTER TABLE FAT.TLIC_DOCUMENTO_EMPRESA ADD PUNTO VARCHAR2(2);
/

ALTER TABLE FAT.TLIC_DOCUMENTO_EMPRESA ADD FECHA_VENCIMIENTO DATE;
/

-- 2026-07-23: presupuesto estimado leido directamente del Aviso de Contrato
-- (campo "Valor total del presupuesto"), texto libre con moneda incluida
-- (ej. "248.000,00 DOP") para no complicar con parseo de decimales/moneda.
ALTER TABLE FAT.TLIC_OPORTUNIDAD ADD PRESUPUESTO_ESTIMADO VARCHAR2(50);
/
