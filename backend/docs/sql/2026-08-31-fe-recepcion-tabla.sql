-- Facturación Electrónica (e-CF) — recepción P2P (endpoints exigidos por
-- el formulario de postulación DGII: recepción + aprobación comercial).
-- Ejecutar igual que 2026-07-07-fe-tablas.sql (conexión backend, usuario
-- con privilegios ANY TABLE; no requiere grants adicionales).

CREATE TABLE FAT.TFE_DOCUMENTO_RECIBIDO (
  ID               NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  NO_CIA           VARCHAR2(2)  NOT NULL,
  RNC_EMISOR       VARCHAR2(20) NOT NULL,
  E_NCF            VARCHAR2(20),
  TIPO             VARCHAR2(10) NOT NULL, -- ECF | ACECF
  TRACK_ID         VARCHAR2(20) NOT NULL,
  XML_RECIBIDO     CLOB,
  ESTADO           VARCHAR2(15) DEFAULT 'RECIBIDO',
  FECHA_RECEPCION  DATE DEFAULT SYSDATE,
  CONSTRAINT UQ_TFE_DOCREC_TRACK UNIQUE (TRACK_ID)
);
