-- Fase: productos/servicios extraidos de la licitacion + resumen de documentos faltantes.
-- Ejecutar manualmente, mismo patron que los archivos SQL anteriores de apps/lic.

CREATE TABLE FAT.TLIC_PRODUCTO (
    ID             NUMBER PRIMARY KEY,
    OPORTUNIDAD_ID NUMBER NOT NULL,
    DESCRIPCION    VARCHAR2(500) NOT NULL,
    CANTIDAD       VARCHAR2(50),
    ACTUALIZADO_EN TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT FK_TLIC_PRODUCTO_OPP FOREIGN KEY (OPORTUNIDAD_ID)
        REFERENCES FAT.TLIC_OPORTUNIDAD(ID) ON DELETE CASCADE
);
/

CREATE INDEX FAT.IX_TLIC_PRODUCTO_OPP ON FAT.TLIC_PRODUCTO (OPORTUNIDAD_ID);
/

CREATE SEQUENCE FAT.SEQ_TLIC_PRODUCTO;
/

CREATE OR REPLACE TRIGGER FAT.TRG_TLIC_PRODUCTO_ID
BEFORE INSERT ON FAT.TLIC_PRODUCTO
FOR EACH ROW
WHEN (NEW.ID IS NULL)
BEGIN
    :NEW.ID := FAT.SEQ_TLIC_PRODUCTO.NEXTVAL;
END;
/

-- JSON serializado de [{"tipo_documento": "...", "motivo": "no subido"|"vencido"}] --
-- derivado (se recalcula en cada analisis), no se justifica tabla hija para esto.
ALTER TABLE FAT.TLIC_OPORTUNIDAD ADD DOCUMENTOS_FALTANTES VARCHAR2(2000);
/

-- Modalidad de entrega de la oferta/documentacion segun el propio proceso: 'fisica',
-- 'virtual', 'ambas', o NULL si el portal no lo especifico para ese proceso.
ALTER TABLE FAT.TLIC_OPORTUNIDAD ADD MODALIDAD_ENTREGA VARCHAR2(10);
/
ALTER TABLE FAT.TLIC_OPORTUNIDAD ADD CONSTRAINT CK_TLIC_OPORTUNIDAD_MODALIDAD
    CHECK (MODALIDAD_ENTREGA IN ('fisica', 'virtual', 'ambas'));
/
