# CNT — Plan de puesta al día de cierres contables (2021-07 → 2026-07)

> **Estado: PENDIENTE DE AUTORIZACIÓN.** Este plan NO se ejecuta sin OK
> explícito del usuario. Todo lo de abajo es preparación y validación.
> Preparado 2026-07-03 con datos reales de producción (solo lectura).

## Estado actual (verificado 2026-07-03)

### Períodos por empresa (CNT.TCNT_PUNTO)

| Cía | Punto | Período actual | Meses de atraso a jul-2026 |
|-----|-------|----------------|-----------------------------|
| 01 ABREGONZA | 01 | **2021 / 07** | ~60 meses |
| 02 RC HERNANDEZ | 01 | 2020 / 12 | nunca procesó (¿usa CNT?) |
| 03 D CLASE | 01 | 2020 / 12 | nunca procesó |
| 04 RODRIGUEZ ARLEQUIN | 01 | 2020 / 12 | nunca procesó |
| 05 ABRESAN | 01 | 2020 / 12 | nunca procesó |

- Último cierre real cia 01: **jun-2021** (ejecutado 2026-05-15 — aparenta prueba).
- Balance verificado mayo-2021: D=C=RD$ 43,714,543.14 exacto (audit CNT).

### Asientos en TCNT_ASIENTO cia 01 (autorizado / actualizado)

| Año | Asientos | Autorizados | Actualizados |
|-----|----------|-------------|--------------|
| 2021 | 110 | 18 | 18 |
| 2022 | 181 | 0 | 0 |
| 2023 | 173 | 0 | 0 |
| 2024 | 168 | 0 | 0 |
| 2025 | 136 | 0 | 0 |
| 2026 | 61 | 0 | 0 |

≈ **811 asientos sin autorizar/actualizar** desde ago-2021.

### Documentos operativos sin generar a CNT (st_generado_cnt='N', cia 01)

| Módulo | Docs pendientes |
|--------|-----------------|
| FAT (TFAT_FACTURA) | 393 |
| CXP (TCXP_DOCUMENTO) | 2,242 |
| CXC (TCXC_DOCUMENTO) | 0 |
| CHC (TCHC_CHEQUE) | 426 |

Es decir: los asientos que ya están en TCNT_ASIENTO **no** cubren todo —
hay ~3,000 documentos operativos que primero deben pasar por el
"generar asiento" de su módulo.

## Cadena mensual (por cada mes desde 2021-08 hasta 2026-07)

Para cada mes M del período en proceso:

1. **Generar asiento por módulo** — en cada módulo alimentador con
   movimientos del mes (FAT, CXC, CXP, INV, CHC, ACC, SDN, ACF):
   `/​<mod>/generar-asiento` (marca docs `st_generado_cnt='S'` e inserta en
   TCNT_ASIENTO como auxiliar).
2. **Autorizar asientos** — `/cnt/autorizar` (o autorizar-anterior para
   meses previos): `autorizado='S'`.
3. **Actualizar al mayor** — `/cnt/actualizar`: mueve a TCNT_MAYOR
   (`actualizado='S'`).
4. **Verificación del mes** — balance de comprobación del mes debe cuadrar
   D=C (query abajo). Si no cuadra: DETENER, no cerrar.
5. **Cierre mensual** — `/cnt/cierre`: inserta TCNT_CIERRE y avanza
   TCNT_PUNTO.mes_proceso. **IRREVERSIBLE.**
6. En diciembre: verificar `mes_cierre=12` → el cierre de dic ejecuta
   además el cierre fiscal (utilidad del ejercicio → utilidad retenida).

### Query de verificación por mes (solo lectura)

```sql
SELECT SUM(debitos) d, SUM(creditos) c
  FROM CNT.TCNT_ASIENTO
 WHERE no_cia='01' AND punto='01' AND ano=:ano AND mes=:mes
   AND NVL(st_anulado,'N')='N';
-- d debe ser igual a c antes de autorizar/cerrar el mes
```

## Prerrequisitos antes de ejecutar

- [x] **Backup completo**: superbackup 2026-07-02 (2.5M filas + DDL) en VM
  `~/superbackup_zentory_20260702.tar.gz` y `C:\Users\JCABREU\Backups`.
  Si la ejecución se hace después de julio-2026, generar uno nuevo.
- [ ] **Decisión de negocio (usuario)**: ¿se ponen al día las 5 empresas o
  solo la 01? Las 02–05 están en 2020/12 y probablemente no llevan
  contabilidad en el sistema.
- [ ] **Decisión de negocio (usuario)**: fechas de asiento retroactivas —
  los asientos generados hoy para 2022 llevan fecha del documento; el
  cierre fiscal de cada diciembre queda con utilidades por año. Confirmar
  con el contador que este es el resultado deseado.
- [ ] **Validar en frío el generar-asiento** de cada módulo con UN mes
  (ago-2021) y revisar el asiento resultante ANTES de autorizar.
- [ ] Congelar la operación (no digitar docs nuevos) durante la corrida, o
  correr fuera de horario.

## Modo de ejecución recomendado

Script supervisado (manage.py shell) que procesa **un mes por corrida**:

1. Corre la cadena para el mes siguiente de TCNT_PUNTO.
2. Después de cada paso imprime los totales (docs generados, asientos
   autorizados, D vs C).
3. Se detiene ante cualquier descuadre (no auto-continúa).
4. Registra bitácora en `backend/docs/audit/cnt-catchup-log.md`.

Primero ago-2021 completo con revisión manual del resultado; si el
contador lo aprueba, se corre por lotes (p.ej. 6 meses por sesión,
verificando balance tras cada año antes del cierre de diciembre).

Estimación: 60 meses × (generar 8 módulos + autorizar + actualizar +
cierre) ≈ 2–4 h de corrida total si no aparecen descuadres.

## Riesgos

- **Cierre es irreversible** vía la app; revertir implica restaurar backup.
- Los 2,242 docs CXP pendientes incluyen 2021–2026; el generar-asiento del
  módulo debe filtrar por mes (verificar que la vista/endpoint respeta el
  período — validado solo-render en audit 2026-07-02, falta probar en frío).
- Asientos manuales ya digitados en TCNT_ASIENTO 2022–2026 (819) podrían
  duplicarse con los generados desde módulos si el legado ya los incluía.
  El paso 1 del "modo recomendado" (mes de prueba) existe para detectar
  exactamente esto.
