-- Facturación Electrónica (e-CF) — Fase 2, Task 3: bandera de Set de
-- Pruebas en la bitácora TFE_DOCUMENTO.
-- Ejecutar igual que 2026-07-07-fe-tablas.sql y
-- 2026-08-31-fe-recepcion-tabla.sql (conexión backend, usuario JCABREU con
-- privilegios ANY TABLE; no requiere grants adicionales).
--
-- Columna aditiva: NO rompe filas existentes (DEFAULT 'N') ni código ya
-- desplegado (Fase 1/1.5 no la referencian). Permite marcar 'S' los envíos
-- hechos contra el Set de Pruebas de certificación DGII para poder
-- excluirlos de reportes/consultas de producción real.

ALTER TABLE FAT.TFE_DOCUMENTO ADD ES_PRUEBA VARCHAR2(1) DEFAULT 'N';
