# Auditoría ND aplicadas vs saldo real (CxP) — 2026-10-11

## Origen

Ticket MPILAR 2026-10-09 "ND 1195 EN RC": la ND-1195 (RC Hernández, cía 02)
aparecía en "Débitos Aplicados" pero no rebajaba la FT-933 que debía afectar.
También citó ND-2189/2190 (ABREGONZA, cía 01) aplicadas a proveedor 297 sin
que el monto de $16,000 saliera de FP-8616 pendiente.

## Causa confirmada en ambos casos

`CXP.TCXP_REFEDOCU` tiene la fila que prueba la aplicación (la ND referencia
el documento de crédito con el monto correcto), pero `CXP.TCXP_DOCUMENTO.SALDO`
del documento referenciado nunca se redujo por ese monto. El registro
contable (REFEDOCU) y el saldo visible quedaron desincronizados.

## Corregido (los 2 casos reportados)

| Documento | Cía | Antes | Después |
|---|---|---|---|
| FT-0000933 (RC Hernández, proveedor 000113) | 02 | saldo 154,909.26, status C | saldo 119,903.83, status A |
| FP-0008616 (ABREGONZA, proveedor 000297) | 01 | saldo 16,000.00, status A | saldo 0.00, status C |

Corregido vía UPDATE directo a `TCXP_DOCUMENTO.SALDO`/`STATUS` + registro en
`historial_repo` (acción EDITAR), sin tocar `TCXP_REFEDOCU` (que ya era
correcto).

## Hallazgo mayor — NO corregido automáticamente

Al pedir "verificar las ND realizadas en todas las compañías", se corrió una
auditoría completa: para cada documento de crédito (FP/FT, tipo_movi='C') con
alguna aplicación de tipo ND en `TCXP_REFEDOCU`, se comparó
`valor_original - saldo` (lo que el saldo actual dice que se redujo) contra
la suma de los montos ND aplicados contra él.

**166 documentos adicionales** muestran el mismo patrón (ND aplicada en el
ledger, saldo sin reducir), por un total de **RD$1,731,182.69** sin repartir
entre 2 compañías (01 y 02). Ver `seguros.csv`.

**No se corrigieron** porque:
1. La escala (166 docs, $1.7M) es muy superior a los 2 casos puntuales que
   Pilar verificó y reportó — corregir esto a ciegas puede estar bien, pero
   también puede estar escondiendo una causa distinta (ej. un backfill
   histórico de 2026-08-11 que restauró 35 ND + 134 REFEDOCU sin re-ajustar
   los documentos referenciados, ver memoria `project_cxp_fork_docs_faltantes_20260811`).
2. Casi todos muestran el mismo patrón extremo: saldo actual = 100% del
   valor_original (como si nunca se hubiera aplicado nada), aunque el
   REFEDOCU dice 100% aplicado. Eso es coherente con un backfill que no
   tocó saldo, pero también podría ser síntoma de algo más grave si alguno
   de esos documentos SÍ fue pagado por otra vía no capturada en REFEDOCU
   (en cuyo caso bajar el saldo sería CORRECTO, pero no puedo verificarlo
   documento por documento sin una revisión contable real).
3. Esto es una posible restitución contable de ~$1.7M en cuentas por pagar
   — del tipo de decisión que amerita que un contador (no un script) la
   revise antes de tocar el libro mayor.

`omitidos.csv` tiene otros 161 documentos con señales contradictorias
(mayoría: saldo ya en 0 pero con un ND aplicado por un monto distinto al que
falta — probablemente documentos ya liquidados por otra vía antes del
backfill; no se tocaron).

## Recomendación

Antes de aplicar `seguros.csv` en bloque: revisar con un contador una
muestra (ej. los 10 de mayor monto) contra el estado de cuenta real del
proveedor en SIGAF Plus / papel, para confirmar que efectivamente no se
pagaron por otra vía. Si se confirma el patrón, el fix es mecánico: por cada
fila, `UPDATE TCXP_DOCUMENTO SET saldo = saldo - faltante, status = (nuevo
saldo = 0 ? 'C' : 'A') WHERE no_cia=... AND tipo_docu=... AND no_docu=...`.
