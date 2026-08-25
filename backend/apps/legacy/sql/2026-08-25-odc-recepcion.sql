-- Recepcion de Ordenes de Compra -> Entrada de Compra -> CxP.
-- Spec: backend/docs/superpowers/specs/2026-08-25-odc-recepcion-entrada-compra-design.md
--
-- TINV_MOVIMIENTO.no_orden YA EXISTE (confirmado, ver docstring inv_repo.py).
-- Solo falta esta columna nueva en TINV_RME para el selector Stock/Reventa.

ALTER TABLE INV.TINV_RME ADD (destino CHAR(1));

COMMIT;
