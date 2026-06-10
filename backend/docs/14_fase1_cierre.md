# Cierre Fase 1 — Descubrimiento e inventario el sistema legado

## Estado de tareas

| # | Tarea | Estado |
|---|---|---|
| 1.A | Auth del legado | ✅ Completado |
| 1.B | Matriz de 7 niveles de permisos | ✅ Completado |
| 1.C | Dump PL/SQL servidor | ✅ Completado (28 objetos en BD) |
| 1.D | Inventario Sdn | ✅ Completado |
| 1.E | Inventario Fat + golden files DGII | 🟡 Parcial — inventario hecho, **golden files pendientes (acción cliente)** |
| 1.F | Integraciones externas | 🟡 Parcial — mapeo hecho, **samples pendientes (acción cliente)** |
| 1.G | Impresión y formatos | 🔴 Pendiente cliente (capturas manuales) |
| 1.H | Resto + Producción/Importaciones | ✅ Completado (SMT, ACF, MPR descartados por inactivos) |

## Entregables generados

### Documentos
- `10_inventario_modulos_activos.md` — resumen 9 módulos activos
- `11_inventario_fat_ncf.md` — Fat + NCF/e-CF detallado
- `12_integraciones_externas.md` — TSS, AFP, ARS, retenciones, ACH
- `13_impresion_pendiente.md` — checklist captura impresión

### Dumps
- `legacy_dumps/active/tables.csv` — 431 tablas
- `legacy_dumps/active/columns.csv` — 5241 columnas
- `legacy_dumps/active/fkeys.csv` — 163 foreign keys
- `legacy_dumps/active/document_types.csv` — 48 columnas tipos doc
- `legacy_dumps/active/fat_detail_out.txt` — detalle Fat
- `legacy_dumps/active/ncf_columns_out.txt` — todas las columnas NCF/e-CF/asientos
- `legacy_dumps/active/integraciones_out.txt` — tablas/columnas integraciones
- `legacy_dumps/sql/permisos_columnas.csv` — matriz completa permisos
- `legacy_dumps/plsql/all_sources.sql` — fuentes PL/SQL servidor (4941 líneas)
- `legacy_dumps/sdn/tables.csv`, `columns.csv` — Sdn detalle
- `legacy_dumps/sql/*.sql` — todos los scripts ejecutados (reusables)

## Decisiones cerradas en Fase 1

1. **Auth = `oracledb.connect()` con usuario Oracle nativo**. ~50 usuarios humanos activos. JIT provisioning a Django User.
2. **Permisos = capa local en SQLite que cachea las TXXX_USUARIO/TXXX_USUARIOD del legado**. Sync periódico.
3. **Multi-empresa = 5 empresas reales (NO_CIA 01-05)**. Multi-punto/sucursal por NO_CIA + PUNTO.
4. **PL/SQL servidor** se reescribe en Python (solo 28 objetos, mayormente triggers de validación de usuario). La lógica real vive en los Forms.
5. **Módulos a clonar (9)**: FAT, ODC, CXP, INV, CXC, CHC, SDN, CNT, ACC.
6. **Módulos descartados (3)**: SMT, ACF, MPR (0 usuarios).
7. **Schema ABREGONZA** (5 tablas custom) debe replicarse — son modificaciones específicas del cliente.
8. **NCF/e-CF**: TIPO_NCF_FISCAL en CNT.TCNT_NCF guarda el código DGII (B01, B02, E31-E47). El sistema soporta e-CF con `FASE_ENCF` y modo `ENCF_EN_CONTINGENCIA`.
9. **Asientos contables**: cada movimiento se asienta en CNT vía `TXXX_DCDOCU` con ANO/MES/NO_ASIENTO + CUENTA. Es criterio de aceptación duro replicar idéntico.

## Pendientes bloqueantes para Fase 2

### Acción del cliente

1. **Confirmar fuentes FMB y RDF**. Si no existen → plan B: decompile parcial de FMX + observación + SQL trace mientras los usuarios trabajan.
2. **Generar golden files DGII** ejecutando reportes en el sistema legado:
   - 606, 607, 608 para un mes
   - Cualquier e-CF que se haya emitido (E31, E32, E33, E34, E41, E43, E44, E45, E46, E47)
3. **Generar samples integraciones** de un mes real:
   - TSS, AFP por administradora, ARS por administradora, archivo banco nómina, ACH CxP, certificados retención, IR-13, DGT4, Autodeterminación.
4. **Capturar formatos de impresión** (PDFs/fotos):
   - Factura, conduce, cheque, recibo cobro, recibo pago, volante nómina, certificado retención, estado de cuenta.
5. **Decidir Fase 0 pendiente:**
   - ¿Migrar Oracle 11g → 19c al cierre o quedarse en 11g?
   - ¿Cuántas semanas de corrida paralela en cutover?
   - ¿Modernizar impresión a PDF + red, o preservar matricial 1:1?

### Acción técnica para arrancar Fase 2

Una vez los pendientes anteriores estén resueltos:

1. Crear esqueleto `apps/legacy/repositories/` con un repo por módulo activo (9 repos).
2. Implementar `LegacyOracleAuthBackend` para Django.
3. Crear modelo SQLite de cache de permisos + sync command.
4. Implementar primer flujo end-to-end como prueba: login + ver lista de NCF disponibles del usuario en Fat.

## Estimación actualizada

- **Con FMB/RDF disponibles:** 4–6 meses para los 9 módulos activos (el original 6–9 ya bajó por menos módulos).
- **Sin FMB/RDF (clon comportamental):** 5–7 meses.
- Diferencia: 1–2 meses por la fase extra de decompile + observación.

## QA de cierre

Se ejecutó:
- `find legacy_dumps/ -type f -empty` — sin archivos vacíos en los entregables generados.
- Lectura cruzada de los `.md` para coherencia interna.

Pendiente firma del cliente antes de Fase 2.
