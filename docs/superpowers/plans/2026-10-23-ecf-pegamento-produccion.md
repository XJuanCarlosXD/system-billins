# Pegamento e-CF: Emisión automática en producción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada factura, nota de débito, nota de crédito, documento de compra, gasto menor y devolución generado en ZentoryERP se envíe automáticamente a la DGII como e-CF cuando la empresa tiene la emisión electrónica activa — sin que el operador haga nada diferente. Cumplimiento total con Ley 32-23 y normas DGII.

**Architecture:** Un módulo orquestador (`apps/fe/emision.py`) centraliza el flujo completo: verificar config activa → construir XML → firmar → enviar → registrar en TFE_DOCUMENTO. Cada punto de integración (FAT, CxP, CxC, ACC, INV) llama a `emitir_ecf_si_activo()` DESPUÉS del commit de la transacción de negocio (nunca dentro — un fallo del e-CF no debe revertir el documento original). Los tutoriales in-app son dialogs que se muestran UNA vez al primer uso de cada vista con e-CF activo (localStorage flag). El chatbot recibe tools nuevas para consultar/reenviar e-CF.

**Tech Stack:** Python 3.12 / Django / Oracle (FAT.TFE_*) / React + shadcn/ui + TanStack Query

---

## Análisis de los 12 módulos — dónde aplica e-CF

| Módulo | ¿Usa NCF? | Tipos e-CF | Integración requerida | Notas |
|--------|-----------|------------|----------------------|-------|
| **FAT** (Facturación) | ✅ Sí | 31, 32, 44, 45, 46 | Hook en `create_factura()` | Módulo principal; `posiciones_fijas_ncf` determina tipo: B01→31, B02→32, B14→44, B15→45, B16→46 |
| **CxP** (Cuentas por Pagar) | ✅ Sí | 41, 43, 47 | Hook en `entrada_documento()` | FP→41 (Compras), gastos sin NCF proveedor→43 (Gastos Menores), proveedor exterior→47 |
| **CxC** (Cuentas por Cobrar) | ✅ Sí | 33, 34 | Hook en entrada ND/NC | ND→33, NC→34; **DEBEN referenciar e-NCF original** |
| **ACC** (Contabilidad Caja Chica) | ✅ Sí | 43 | Hook en egreso/reposición | Egresos con NCF aparecen en 606 vía `_rows_acc_606()`; gastos menores→tipo 43 |
| **INV** (Inventario) | ✅ Sí | 34 (vía CxC) | Automático vía CxC | Devoluciones (DV/DC) emiten NCF tipo NC usando `_emitir_ncf_inv()` que lee de `CXC.TCXC_TDOCU`; el e-CF tipo 34 fluye por CxC |
| **CNT** (Contabilidad General) | ⚡ Solo maestro | — | Ninguna | Mantiene `TCNT_NCF` (rangos NCF papel); no genera e-CF propio |
| **ODC** (Órdenes de Compra) | ❌ No | — | Ninguna | Sin NCF ni comprobantes fiscales |
| **ACF** (Activos Fijos) | ❌ No | — | Ninguna | Depreciación/compra/retiro sin NCF |
| **SDN** (Nómina) | ❌ No | — | Ninguna | Salarios/deducciones sin NCF |
| **MAN** (Mantenimiento) | ❌ No | — | Ninguna | Órdenes de trabajo sin NCF |
| **CHC** (Cheques) | ❌ No | — | Ninguna | Solo tiene campo `estado_encf` residual, sin NCF real |
| **LIC** (Licitaciones) | ❌ No | — | Ninguna | Scraper externo, sin documentos fiscales |

**Resumen:** 5 módulos requieren integración e-CF (FAT, CxP, CxC, ACC, INV). Los otros 7 no generan comprobantes fiscales.

---

## Reglas DGII que debe cumplir el flujo (Ley 32-23)

### 1. RFCE — Facturas de Consumo < RD$250,000
Las Facturas de Consumo (tipo 32) con monto menor a RD$250,000 **NO** se envían al endpoint normal `ecf.dgii.gov.do/recepcion`. Se envían como **RFCE** (Resumen Factura de Consumo Electrónica) al endpoint especial `fc.dgii.gov.do`. El builder `construir_rfce()` y el client `enviar_rfce()` ya existen en el código.

**Implementación:** `emision.py` debe verificar: si tipo_ecf==32 y monto < 250000 → usar `enviar_rfce()` en lugar de `enviar_ecf()`.

### 2. ND/NC deben referenciar e-NCF original
Toda Nota de Débito (33) o Nota de Crédito (34) electrónica **DEBE** incluir en su XML el campo `<eNCFReferencia>` con el e-NCF de la factura que modifica. Sin esta referencia, la DGII rechaza el documento.

**Implementación:** El builder de CxC debe buscar el e-NCF de la factura original en `TFE_DOCUMENTO` antes de construir el XML.

### 3. e-NCF quemado no se reutiliza
Cada e-NCF consumido de `TFE_SECUENCIA` queda registrado en la DGII. Si un envío es rechazado, el e-NCF ya está "quemado" — se debe usar uno NUEVO para el reenvío. Nunca reutilizar un e-NCF rechazado.

**Implementación:** `consumir_siguiente_encf()` ya usa FOR UPDATE atómico. El reenvío en `dgii_client.reenviar_ecf()` usa el XML ya firmado (mismo e-NCF), pero si se corrige y re-genera, se consume uno nuevo.

### 4. Coexistencia NCF papel y e-NCF
Durante la transición, una empresa puede tener facturas con NCF papel (B01...) y con e-NCF (E31...). El sistema debe:
- Si e-CF activo → consumir de `TFE_SECUENCIA` (e-NCF)
- Si e-CF NO activo → consumir de `CNT.TCNT_NCF` (NCF papel, flujo existente)
- Nunca ambos para el mismo documento

**Implementación:** `emitir_ecf_si_activo()` se ejecuta post-commit. Si e-CF está activo, el e-NCF reemplaza al NCF papel. El builder debe **no** usar el NCF papel del documento sino generar el e-NCF propio.

### 5. Anulación de rangos e-NCF
Si una secuencia e-NCF ya no se va a usar (ej. por cambio de tipo), los rangos no consumidos deben anularse ante la DGII via `POST /anulacionrangos`. El endpoint existe en `dgii_client.py`.

**Implementación:** Incluir botón en UI de Secuencias e-NCF para anular rango. No es parte del flujo automático.

### 6. Timing — envío inmediato
La DGII espera recibir el e-CF "al momento de la emisión". No hay un plazo explícito de gracia, pero acumular días sin enviar genera alertas. El envío debe ser síncrono con la creación del documento (post-commit inmediato).

### 7. Certificado digital vigente
El `.p12` debe estar vigente. Si vence, **TODOS** los envíos fallan. El sistema ya tiene campo `cert_vence` en TFE_CONFIG — incluir alerta visual cuando falten < 30 días.

### 8. RNC/Razón Social deben coincidir con DGII
Los datos del emisor (RNC, razón social, dirección) en el e-CF deben coincidir exactamente con los registrados en la DGII. Discrepancias causan rechazo.

### 9. Tipo 43 (Gastos Menores) — sin NCF proveedor
El tipo 43 se usa cuando se paga un gasto y el proveedor NO emite comprobante fiscal. Aplica a: compras informales, gastos menores de caja chica, pagos a personas físicas sin RNC. El monto máximo por transacción es RD$50,000.

### 10. Tipo 47 (Pagos al Exterior) — proveedor sin RNC
Aplica cuando se paga a un proveedor extranjero que no tiene RNC dominicano. Requiere datos del beneficiario (nombre, país, tipo documento).

---

## Secuencias e-NCF aprobadas por la DGII

Las secuencias en `FAT.TFE_SECUENCIA` (NO_CIA='01') son las que la DGII aprobó durante la certificación. **NO son rangos "de prueba"** — son los rangos reales de producción. Los `PROX_SECUENCIA` ya consumidos corresponden a los comprobantes enviados durante las 15 fases.

| Tipo | Descripción | Próxima | Hasta | Módulo que lo genera |
|------|-------------|---------|-------|---------------------|
| 31 | Factura Crédito Fiscal | 141 | 10M | FAT (B01: venta a empresa con RNC) |
| 32 | Factura de Consumo | 1066 | 50M | FAT (B02: venta a consumidor final) |
| 33 | Nota de Débito | 24 | 10M | CxC (ND a cliente) |
| 34 | Nota de Crédito | 62 | 10M | CxC (NC a cliente / devolución INV) |
| 41 | Compras | 118 | 10M | CxP (FP factura proveedor) |
| 43 | Gastos Menores | 118 | 10M | CxP/ACC (gasto sin comprobante, ≤ RD$50K) |
| 44 | Reg. Especial | 23 | 10M | FAT (B14: cliente régimen especial) |
| 45 | Gubernamental | 116 | 10M | FAT (B15: cliente gubernamental) |
| 46 | Exp. Comprobante | 107 | 10M | FAT (B16: exportación) |
| 47 | Pago al Exterior | 112 | 10M | CxP (pago a proveedor exterior) |

**CRÍTICO:** La TFE_CONFIG tiene `NO_CIA='01'`, pero la empresa Abregonza es `NO_CIA='03'` en los módulos FAT/CxP/CxC. El `fe_repo.get_config('03')` devuelve NULL. Hay que resolver esta discrepancia en Task 1.

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `backend/apps/fe/emision.py` | **CREAR** | Orquestador central: `emitir_ecf_si_activo()` con RFCE |
| `backend/apps/fe/ecf_builder.py` | Modificar | Agregar builders para tipos 41/43/47 (CxP) y 33/34 (CxC) |
| `backend/apps/legacy/repositories/fe_repo.py` | Modificar | Fallback config multi-empresa |
| `backend/apps/legacy/repositories/fat_repo.py` | Modificar | Hook post-commit en `create_factura()` |
| `backend/apps/legacy/repositories/cxp_repo.py` | Modificar | Hook post-commit en `entrada_documento()` |
| `backend/apps/legacy/repositories/cxc_repo.py` | Modificar | Hook post-commit en entrada ND/NC |
| `backend/apps/legacy/repositories/acc_repo.py` | Modificar | Hook post-commit en egreso caja chica |
| `backend/apps/fe/tests/test_emision.py` | **CREAR** | Tests del orquestador |
| `backend/apps/fe/tests/test_ecf_builder_cxp.py` | **CREAR** | Tests builders CxP |
| `backend/apps/fe/tests/test_ecf_builder_cxc.py` | **CREAR** | Tests builders CxC |
| `frontend/src/features/fe/fe-tutorial-dialog.tsx` | **CREAR** | Componente tutorial reutilizable |
| `frontend/src/features/fe/fe-ayuda-contenido.ts` | Modificar | Contenido tutorial por módulo (FAT/CxP/CxC/ACC/INV) |
| `frontend/src/features/fat/facturas.tsx` | Modificar | Tutorial + badge e-CF |
| `frontend/src/features/cxp/cxp-documentos.tsx` | Modificar | Tutorial + badge e-CF |
| `frontend/src/features/cxc/cxc-documentos.tsx` | Modificar | Tutorial + badge e-CF |
| `frontend/src/features/acc/acc-egresos.tsx` | Modificar | Tutorial e-CF tipo 43 |
| `frontend/src/features/inv/inv-devoluciones.tsx` | Modificar | Tutorial (NC automática vía CxC) |
| `backend/apps/asistente/tools/fe.py` | **CREAR** | Tools del chatbot para e-CF |
| `backend/apps/asistente/skills/facturar/SKILL.md` | Modificar | Agregar paso e-CF |
| `backend/apps/asistente/skills/consultar-ecf/SKILL.md` | **CREAR** | Skill para consultar e-CF |

---

### Task 1: Resolver discrepancia NO_CIA en TFE_CONFIG

**Files:**
- Modify: `backend/apps/legacy/repositories/fe_repo.py`

La TFE_CONFIG tiene `NO_CIA='01'` pero las facturas se crean con `NO_CIA='03'`. Hay que investigar si todas las empresas del grupo comparten la misma config e-CF (un solo RNC 130217432).

- [ ] **Step 1: Verificar en la BD qué NOs de CIA existen**

```bash
plink -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 "docker exec facturation_backend python manage.py shell -c \"
from apps.legacy import client
with client.cursor() as cur:
    cur.execute('SELECT DISTINCT no_cia FROM FAT.TFAT_FACTURA WHERE ROWNUM < 100')
    print('Facturas:', [r[0] for r in cur.fetchall()])
    cur.execute('SELECT no_cia, nombre FROM ABREGONZA.TABREGONZA_CIA ORDER BY 1')
    for r in cur.fetchall(): print(r)
\""
```

- [ ] **Step 2: Decidir estrategia**

Si Abregonza (03) factura pero la config e-CF está en 01:
- **Opción A (recomendada):** `fe_repo.get_config()` busca primero en la cia pedida y si no existe, cae a '01' como default del grupo (un RNC, una config e-CF).
- **Opción B:** Clonar la fila de TFE_CONFIG para cia 03 y las secuencias.

- [ ] **Step 3: Implementar el fallback en `fe_repo.get_config()`**

```python
def get_config(no_cia: str) -> dict | None:
    row = client.fetch_dicts(
        f"SELECT {CONFIG_COLS} FROM FAT.TFE_CONFIG WHERE no_cia = :1",
        [no_cia],
    )
    if not row:
        row = client.fetch_dicts(
            f"SELECT {CONFIG_COLS} FROM FAT.TFE_CONFIG WHERE no_cia = '01'",
        )
    return row[0] if row else None
```

Aplicar el mismo patrón a `list_secuencias()` y `consumir_siguiente_encf()`.

- [ ] **Step 4: Test**

```python
def test_get_config_fallback_a_cia_01(mock_cursor):
    """Si no_cia='03' no tiene config, devuelve la de '01'."""
    ...
```

- [ ] **Step 5: Commit**

```bash
git commit -m "fix(fe): fallback TFE_CONFIG a cia 01 para grupo multi-empresa"
```

---

### Task 2: Crear orquestador central `emision.py`

**Files:**
- Create: `backend/apps/fe/emision.py`
- Create: `backend/apps/fe/tests/test_emision.py`

Este módulo es el "pegamento" que se llama desde cualquier punto de integración. Incluye lógica de RFCE para tipo 32 < 250K.

- [ ] **Step 1: Escribir el test**

```python
# backend/apps/fe/tests/test_emision.py
from unittest.mock import patch, MagicMock

def test_emitir_ecf_no_activo_no_hace_nada():
    """Si la config no tiene activo='S', no se genera ni envía nada."""
    with patch('apps.fe.emision.fe_repo') as mock_repo:
        mock_repo.get_config.return_value = {'activo': 'N'}
        from apps.fe.emision import emitir_ecf_si_activo
        resultado = emitir_ecf_si_activo(
            no_cia='03', punto='01', modulo='FAT',
            tipo_docu='FT', no_docu='123',
        )
        assert resultado is None

def test_emitir_ecf_activo_construye_firma_envia():
    """Flujo completo: config activa → build → firma → envía → registra."""
    with patch('apps.fe.emision.fe_repo') as mock_repo, \
         patch('apps.fe.emision.ecf_builder') as mock_builder, \
         patch('apps.fe.emision.dgii_client') as mock_dgii:
        mock_repo.get_config.return_value = {
            'activo': 'S', 'ambiente': 'ecf', 'rnc_emisor': '130217432',
        }
        mock_builder.construir_ecf_31.return_value = '<ECF><eNCF>E310000000141</eNCF></ECF>'
        mock_dgii.enviar_ecf.return_value = {
            'trackId': 'TRK-1', 'xml_firmado': '<signed/>',
        }
        from apps.fe.emision import emitir_ecf_si_activo
        resultado = emitir_ecf_si_activo(
            no_cia='03', punto='01', modulo='FAT',
            tipo_docu='FT', no_docu='123',
        )
        assert resultado['track_id'] == 'TRK-1'
        mock_repo.save_documento_enviado.assert_called_once()

def test_rfce_tipo_32_menor_250k():
    """Tipo 32 con monto < 250,000 → enviar_rfce(), no enviar_ecf()."""
    with patch('apps.fe.emision.fe_repo') as mock_repo, \
         patch('apps.fe.emision.ecf_builder') as mock_builder, \
         patch('apps.fe.emision.dgii_client') as mock_dgii:
        mock_repo.get_config.return_value = {
            'activo': 'S', 'ambiente': 'ecf',
        }
        mock_builder.construir_rfce.return_value = '<RFCE><eNCF>E320000001066</eNCF></RFCE>'
        mock_dgii.enviar_rfce.return_value = {
            'trackId': 'TRK-RFCE', 'xml_firmado': '<signed/>',
        }
        from apps.fe.emision import emitir_ecf_si_activo
        resultado = emitir_ecf_si_activo(
            no_cia='03', punto='01', modulo='FAT',
            tipo_docu='FT', no_docu='456',
            monto_total=15000.0,
        )
        mock_dgii.enviar_rfce.assert_called_once()
        mock_dgii.enviar_ecf.assert_not_called()
```

- [ ] **Step 2: Correr test, verificar que falla**

```bash
pytest backend/apps/fe/tests/test_emision.py -v
```

- [ ] **Step 3: Implementar `emision.py`**

```python
# backend/apps/fe/emision.py
"""Orquestador de emisión automática de e-CF.

Punto central que conecta el flujo de negocio (FAT/CxP/CxC/ACC) con la
infraestructura de e-CF (builder/firma/envío). Se llama DESPUÉS del
commit de la transacción de negocio — un fallo aquí NO revierte el
documento original.
"""
from __future__ import annotations

import logging
from apps.fe import dgii_client, ecf_builder
from apps.legacy.repositories import fe_repo

log = logging.getLogger('fe.emision')

RFCE_THRESHOLD = 250_000  # RD$ — tipo 32 bajo este monto va por RFCE

# Mapeo posiciones_fijas_ncf FAT → tipo e-CF
_FAT_POSICIONES_A_ECF = {
    'B01': 31,  # Crédito Fiscal
    'B02': 32,  # Consumo
    'B14': 44,  # Régimen Especial
    'B15': 45,  # Gubernamental
    'B16': 46,  # Exportación
}

# Mapeo tipo_docu CxP → tipo e-CF
_CXP_TIPO_ECF = {
    'FP': 41,   # Compras
    'ND': 33,   # Nota de Débito
}

# Mapeo tipo_docu CxC → tipo e-CF
_CXC_TIPO_ECF = {
    'ND': 33,   # Nota de Débito
    'NC': 34,   # Nota de Crédito
}


def emitir_ecf_si_activo(
    *,
    no_cia: str,
    punto: str,
    modulo: str,        # 'FAT', 'CXP', 'CXC', 'ACC'
    tipo_docu: str,
    no_docu: str,
    no_cliente: str = '',
    no_proveedor: str = '',
    monto_total: float = 0,
) -> dict | None:
    """Intenta emitir un e-CF si la empresa tiene la emisión activa.

    Retorna None si no aplica, o dict con {e_ncf, track_id, estado}.
    Nunca lanza excepción — los errores se loguean y se reportan como ticket.
    """
    try:
        cfg = fe_repo.get_config(no_cia)
        if not cfg or cfg.get('activo') != 'S':
            return None

        ambiente = cfg.get('ambiente', 'ecf')
        tipo_ecf = _resolver_tipo_ecf(modulo, tipo_docu, no_cia, punto, no_docu)
        if not tipo_ecf:
            return None

        # Construir XML sin firmar
        xml = _construir_xml(modulo, tipo_ecf, no_cia, punto, tipo_docu, no_docu)

        # RFCE: tipo 32 < 250K va por endpoint especial fc.dgii.gov.do
        e_ncf = _extraer_encf(xml)
        if tipo_ecf == 32 and monto_total < RFCE_THRESHOLD:
            xml_rfce = ecf_builder.construir_rfce(no_cia, punto, tipo_docu, no_docu)
            resultado = dgii_client.enviar_rfce(no_cia, ambiente, e_ncf, xml_rfce)
        else:
            resultado = dgii_client.enviar_ecf(no_cia, ambiente, e_ncf, xml)

        # Registrar en bitácora
        fe_repo.save_documento_enviado(
            no_cia=no_cia, e_ncf=e_ncf, tipo_ecf=str(tipo_ecf),
            track_id=resultado['trackId'],
            xml_firmado=resultado['xml_firmado'],
            respuesta=str(resultado.get('respuesta_cruda', '')),
        )

        log.info("e-CF emitido: %s %s/%s → %s (track %s)",
                 modulo, tipo_docu, no_docu, e_ncf, resultado['trackId'])

        return {
            'e_ncf': e_ncf,
            'track_id': resultado['trackId'],
            'estado': 'ENVIADO',
        }

    except Exception:
        log.exception("Error emitiendo e-CF para %s %s/%s cia %s",
                      modulo, tipo_docu, no_docu, no_cia)
        try:
            from apps.reportes.auto_ticket import log_error_ticket
            log_error_ticket(
                f"e-CF falló: {modulo} {tipo_docu}/{no_docu} cia {no_cia}",
                modulo='FE',
            )
        except Exception:
            pass
        return None


def _resolver_tipo_ecf(modulo, tipo_docu, no_cia, punto, no_docu) -> int | None:
    """Determina el tipo de e-CF según el módulo y tipo de documento."""
    td = tipo_docu.strip().upper()
    if modulo == 'FAT':
        from apps.legacy.repositories import fat_repo
        fac = fat_repo.get_factura(no_cia, punto, td, no_docu)
        if not fac:
            return None
        posiciones = (fac.get('posiciones_fijas_ncf') or '').strip().upper()
        return _FAT_POSICIONES_A_ECF.get(posiciones, 32)
    elif modulo == 'CXP':
        # CxP: FP→41, pero si proveedor exterior→47, si gasto menor→43
        from apps.legacy.repositories import cxp_repo
        doc = cxp_repo.get_documento(no_cia, punto, td, no_docu)
        if not doc:
            return None
        posiciones = (doc.get('posiciones_fijas_ncf') or '').strip().upper()
        if posiciones == 'B11':
            return 41  # Compras normales
        elif posiciones == 'B13':
            return 43  # Gastos menores
        elif posiciones == 'B17':
            return 47  # Pagos al exterior
        return _CXP_TIPO_ECF.get(td)
    elif modulo == 'CXC':
        return _CXC_TIPO_ECF.get(td)
    elif modulo == 'ACC':
        return 43  # Caja chica = gastos menores
    return None


def _construir_xml(modulo, tipo_ecf, no_cia, punto, tipo_docu, no_docu) -> str:
    """Delega al builder apropiado según módulo y tipo."""
    if modulo == 'FAT':
        if tipo_ecf == 31:
            return ecf_builder.construir_ecf_31(no_cia, punto, tipo_docu, no_docu)
        elif tipo_ecf == 32:
            return ecf_builder.construir_ecf_32(no_cia, punto, tipo_docu, no_docu)
        else:
            return ecf_builder.construir_ecf_generico(no_cia, punto, tipo_docu, no_docu, tipo_ecf)
    elif modulo == 'CXP':
        return ecf_builder.construir_ecf_cxp(tipo_ecf, no_cia, punto, tipo_docu, no_docu)
    elif modulo == 'CXC':
        return ecf_builder.construir_ecf_cxc(tipo_ecf, no_cia, punto, tipo_docu, no_docu)
    elif modulo == 'ACC':
        return ecf_builder.construir_ecf_acc(no_cia, punto, tipo_docu, no_docu)
    raise ValueError(f"Módulo {modulo} no soportado para e-CF")


def _extraer_encf(xml: str) -> str:
    """Extrae el e-NCF del XML generado."""
    import re
    m = re.search(r'<eNCF>([^<]+)</eNCF>', xml)
    if not m:
        raise ValueError("XML no contiene <eNCF>")
    return m.group(1)
```

- [ ] **Step 4: Correr test, verificar que pasa**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(fe): orquestador emision.py con soporte RFCE y multi-módulo"
```

---

### Task 3: Conectar FAT — e-CF automático al facturar

**Files:**
- Modify: `backend/apps/fat/views.py` (endpoint que llama a `create_factura`)

El hook va DESPUÉS del `cur.connection.commit()` de `create_factura`, en la capa de views. No dentro de `create_factura` — así el e-CF no se mete dentro de la transacción.

- [ ] **Step 1: Identificar dónde se llama `create_factura` en views**

```bash
grep -rn 'create_factura' backend/apps/fat/
```

- [ ] **Step 2: Agregar hook post-creación en la view**

```python
# Después de result = fat_repo.create_factura(...)
from apps.fe.emision import emitir_ecf_si_activo
ecf_result = emitir_ecf_si_activo(
    no_cia=no_cia, punto=punto, modulo='FAT',
    tipo_docu=result['tipo_factura'], no_docu=result['no_factura'],
    monto_total=float(result.get('total', 0)),
)
if ecf_result:
    result['ecf'] = ecf_result
```

- [ ] **Step 3: Test E2E con empresa de prueba**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(fat): emitir e-CF automáticamente al crear factura"
```

---

### Task 4: Builders para CxP (tipos 41, 43, 47)

**Files:**
- Modify: `backend/apps/fe/ecf_builder.py`
- Create: `backend/apps/fe/tests/test_ecf_builder_cxp.py`

Los builders de CxP leen de `TCXP_DOCUMENTO`+`TCXP_DCDOCU`. Cada tipo tiene campos específicos:
- **41 (Compras):** RNC proveedor, monto, NCF proveedor, detalles de la compra
- **43 (Gastos Menores):** Sin RNC proveedor, monto ≤ RD$50,000, descripción del gasto
- **47 (Pagos al Exterior):** Datos del beneficiario extranjero (nombre, país, tipo doc)

- [ ] **Step 1: Escribir test**

```python
def test_construir_ecf_41_desde_cxp():
    """FP en CxP genera XML tipo 41 con datos del proveedor y NCF."""
    ...

def test_construir_ecf_43_gastos_menores():
    """Gasto menor genera XML tipo 43 sin RNC proveedor, monto <= 50K."""
    ...

def test_construir_ecf_47_pago_exterior():
    """Pago al exterior genera XML tipo 47 con datos beneficiario."""
    ...
```

- [ ] **Step 2: Implementar `construir_ecf_cxp()`**

```python
def construir_ecf_cxp(tipo_ecf: int, no_cia: str, punto: str,
                       tipo_docu: str, no_docu: str) -> str:
    from apps.legacy.repositories import cxp_repo, fe_repo
    doc = cxp_repo.get_documento(no_cia, punto, tipo_docu, no_docu)
    cfg = fe_repo.get_config(no_cia)
    e_ncf = fe_repo.consumir_siguiente_encf(no_cia, str(tipo_ecf))

    encabezado = _encabezado_base(cfg, tipo_ecf, e_ncf)
    if tipo_ecf == 41:
        encabezado += _datos_proveedor(doc)
    elif tipo_ecf == 43:
        encabezado += _datos_gasto_menor(doc)
    elif tipo_ecf == 47:
        encabezado += _datos_pago_exterior(doc)

    detalles = cxp_repo.get_detalle_documento(no_cia, punto, tipo_docu, no_docu)
    items_xml = _items_cxp(detalles)
    totales = _totales_cxp(doc)

    return _envolver_ecf(tipo_ecf, encabezado, items_xml, totales)
```

- [ ] **Step 3: Correr tests**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(fe): builders e-CF para CxP (tipos 41/43/47)"
```

---

### Task 5: Builders para CxC (tipos 33, 34) con referencia e-NCF original

**Files:**
- Modify: `backend/apps/fe/ecf_builder.py`
- Create: `backend/apps/fe/tests/test_ecf_builder_cxc.py`

**DGII REGLA CRÍTICA:** ND (33) y NC (34) DEBEN incluir `<eNCFReferencia>` con el e-NCF de la factura que modifican. Sin esta referencia → rechazo.

- [ ] **Step 1: Escribir test**

```python
def test_construir_ecf_33_nd_con_referencia():
    """ND genera XML tipo 33 con eNCFReferencia de la factura original."""
    ...

def test_construir_ecf_34_nc_con_referencia():
    """NC genera XML tipo 34 con eNCFReferencia de la factura original."""
    ...

def test_nd_sin_factura_original_lanza_error():
    """Si no se encuentra el e-NCF original, no se puede generar el e-CF."""
    ...
```

- [ ] **Step 2: Implementar `construir_ecf_cxc()`**

```python
def construir_ecf_cxc(tipo_ecf: int, no_cia: str, punto: str,
                       tipo_docu: str, no_docu: str) -> str:
    from apps.legacy.repositories import cxc_repo, fe_repo
    doc = cxc_repo.get_documento(no_cia, punto, tipo_docu, no_docu)
    cfg = fe_repo.get_config(no_cia)
    e_ncf = fe_repo.consumir_siguiente_encf(no_cia, str(tipo_ecf))

    # DGII REGLA: ND/NC deben referenciar factura original
    no_factura_ref = doc.get('no_factura_ref') or doc.get('no_factura')
    ecf_ref = fe_repo.get_documento_por_factura(no_cia, no_factura_ref)
    if not ecf_ref:
        raise ValueError(
            f"No se encontró e-NCF de la factura original {no_factura_ref} "
            f"para la {tipo_docu} {no_docu}. "
            f"La DGII exige que toda ND/NC electrónica referencie el e-NCF original."
        )
    encf_referencia = ecf_ref['e_ncf']

    encabezado = _encabezado_base(cfg, tipo_ecf, e_ncf)
    encabezado += f'<eNCFReferencia>{encf_referencia}</eNCFReferencia>'
    # ... resto del XML
    return _envolver_ecf(tipo_ecf, encabezado, items_xml, totales)
```

- [ ] **Step 3: Correr tests**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(fe): builders e-CF para CxC (tipos 33/34) con eNCFReferencia"
```

---

### Task 6: Builder para ACC (tipo 43 — Gastos Menores Caja Chica)

**Files:**
- Modify: `backend/apps/fe/ecf_builder.py`

ACC genera egresos de caja chica que incluyen NCF y aparecen en el 606 vía `_rows_acc_606()`. Los gastos menores de caja chica son tipo 43 ante la DGII.

- [ ] **Step 1: Escribir test**

```python
def test_construir_ecf_acc_egreso_gastos_menores():
    """Egreso ACC con NCF genera XML tipo 43 (Gastos Menores)."""
    ...
```

- [ ] **Step 2: Implementar `construir_ecf_acc()`**

```python
def construir_ecf_acc(no_cia: str, punto: str, tipo_docu: str, no_docu: str) -> str:
    from apps.legacy.repositories import acc_repo, fe_repo
    doc = acc_repo.get_egreso(no_cia, punto, no_docu)
    cfg = fe_repo.get_config(no_cia)
    e_ncf = fe_repo.consumir_siguiente_encf(no_cia, '43')
    # Tipo 43: sin RNC proveedor, monto <= 50K
    encabezado = _encabezado_base(cfg, 43, e_ncf)
    encabezado += _datos_gasto_menor_acc(doc)
    return _envolver_ecf(43, encabezado, _items_acc(doc), _totales_acc(doc))
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(fe): builder e-CF tipo 43 para egresos ACC (caja chica)"
```

---

### Task 7: Conectar CxP — e-CF automático al entrar documento

**Files:**
- Modify: `backend/apps/cxp/views.py`

Mismo patrón que FAT: después del resultado exitoso de `cxp_repo.entrada_documento()`:

```python
ecf_result = emitir_ecf_si_activo(
    no_cia=no_cia, punto=punto, modulo='CXP',
    tipo_docu=result['tipo_docu'], no_docu=result['no_docu'],
    no_proveedor=result.get('no_proveedor', ''),
    monto_total=float(result.get('total', 0)),
)
if ecf_result:
    result['ecf'] = ecf_result
```

- [ ] **Step 1: Identificar endpoint en views**
- [ ] **Step 2: Agregar hook**
- [ ] **Step 3: Test**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(cxp): emitir e-CF automáticamente al entrar documento"
```

---

### Task 8: Conectar CxC — e-CF automático en ND/NC

**Files:**
- Modify: `backend/apps/cxc/views.py`

- [ ] **Step 1: Identificar endpoint de entrada ND/NC en CxC**
- [ ] **Step 2: Agregar hook con validación de referencia e-NCF**

```python
ecf_result = emitir_ecf_si_activo(
    no_cia=no_cia, punto=punto, modulo='CXC',
    tipo_docu=result['tipo_docu'], no_docu=result['no_docu'],
    no_cliente=result.get('no_cliente', ''),
)
if ecf_result:
    result['ecf'] = ecf_result
```

- [ ] **Step 3: Test**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(cxc): emitir e-CF automáticamente en ND/NC"
```

---

### Task 9: Conectar ACC — e-CF automático en egresos caja chica

**Files:**
- Modify: `backend/apps/acc/views.py`

Solo egresos que tienen NCF (posiciones_fijas_ncf no vacío) generan e-CF tipo 43.

- [ ] **Step 1: Identificar endpoint de egreso en ACC**
- [ ] **Step 2: Agregar hook**

```python
if result.get('posiciones_fijas_ncf'):
    ecf_result = emitir_ecf_si_activo(
        no_cia=no_cia, punto=punto, modulo='ACC',
        tipo_docu='EG', no_docu=result['no_docu'],
        monto_total=float(result.get('total', 0)),
    )
    if ecf_result:
        result['ecf'] = ecf_result
```

- [ ] **Step 3: Test**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(acc): emitir e-CF tipo 43 automáticamente en egresos caja chica"
```

---

### Task 10: Componente tutorial reutilizable (frontend)

**Files:**
- Create: `frontend/src/features/fe/fe-tutorial-dialog.tsx`
- Modify: `frontend/src/features/fe/fe-ayuda-contenido.ts`

Dialog reutilizable que se muestra UNA vez por módulo cuando el usuario entra a una vista que genera e-CF por primera vez.

- [ ] **Step 1: Crear componente**

```tsx
// frontend/src/features/fe/fe-tutorial-dialog.tsx
import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface TutorialPaso {
  titulo: string
  descripcion: string
  icono: string
}

interface Props {
  moduloKey: string
  titulo: string
  pasos: TutorialPaso[]
  feActivo: boolean
}

export function FeTutorialDialog({ moduloKey, titulo, pasos, feActivo }: Props) {
  const storageKey = `fe-tutorial-visto-${moduloKey}`
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!feActivo) return
    try {
      if (!localStorage.getItem(storageKey)) {
        setOpen(true)
      }
    } catch {}
  }, [feActivo, storageKey])

  const cerrar = () => {
    setOpen(false)
    try { localStorage.setItem(storageKey, '1') } catch {}
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <div className='space-y-3 py-2'>
          <p className='text-muted-foreground text-sm'>
            La facturación electrónica está activa. Esto es lo que cambia en este módulo:
          </p>
          {pasos.map((p, i) => (
            <div key={i} className='flex gap-3 rounded-lg border p-3'>
              <span className='text-2xl' aria-hidden>{p.icono}</span>
              <div>
                <p className='text-sm font-medium'>{p.titulo}</p>
                <p className='text-muted-foreground text-xs'>{p.descripcion}</p>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={cerrar}>Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Agregar contenido por módulo en `fe-ayuda-contenido.ts`**

```typescript
// === TUTORIALES POR MÓDULO ===

export const FE_TUTORIAL_FAT = [
  {
    titulo: 'e-NCF automático al facturar',
    descripcion: 'Cada factura que crees se enviará automáticamente a la DGII como e-CF. El e-NCF (ej. E310000000141) se asigna solo — no tienes que hacer nada diferente al proceso normal.',
    icono: '📄',
  },
  {
    titulo: 'Tipos de comprobante',
    descripcion: 'El sistema determina automáticamente el tipo: Crédito Fiscal (31) si el cliente tiene RNC, Consumo (32) si no, Régimen Especial (44), Gubernamental (45) o Exportación (46) según la configuración del cliente.',
    icono: '🏷️',
  },
  {
    titulo: 'Facturas de Consumo < RD$250,000',
    descripcion: 'Las facturas de consumo menores a RD$250,000 se envían como RFCE (resumen) por un canal especial de la DGII. El sistema lo hace automáticamente — no necesitas intervenir.',
    icono: '💰',
  },
  {
    titulo: 'Revisa el estado después de facturar',
    descripcion: 'El sistema te indica si el e-CF fue Aceptado, Rechazado o está En Proceso. Si es rechazado, revisa los datos del cliente (RNC, razón social). Cada e-NCF quemado queda registrado en la DGII.',
    icono: '✅',
  },
]

export const FE_TUTORIAL_CXP = [
  {
    titulo: 'Comprobante de Compras (e-CF 41)',
    descripcion: 'Al registrar una factura de proveedor (FP), el sistema genera el e-CF tipo 41 (Compras) automáticamente. Verifica que el NCF que te dio el proveedor esté correcto — un NCF incorrecto causa rechazo.',
    icono: '🛒',
  },
  {
    titulo: 'Gastos Menores (e-CF 43)',
    descripcion: 'Si el proveedor no emite comprobante fiscal (compras informales, gastos menores), se genera un e-CF tipo 43. Aplica solo para montos hasta RD$50,000 por transacción.',
    icono: '💵',
  },
  {
    titulo: 'Pagos al Exterior (e-CF 47)',
    descripcion: 'Pagos a proveedores extranjeros sin RNC dominicano generan e-CF tipo 47. Necesitan datos del beneficiario: nombre completo, país y tipo de documento.',
    icono: '🌎',
  },
]

export const FE_TUTORIAL_CXC = [
  {
    titulo: 'Notas de Débito electrónicas (e-CF 33)',
    descripcion: 'Las ND ahora generan un e-CF tipo 33. La DGII exige que toda ND indique el e-NCF de la factura original que modifica — el sistema lo asigna automáticamente.',
    icono: '📋',
  },
  {
    titulo: 'Notas de Crédito electrónicas (e-CF 34)',
    descripcion: 'Las NC (descuentos, devoluciones) generan e-CF tipo 34. También requieren referencia al e-NCF original. Si la factura original no tiene e-NCF, no se puede emitir la NC electrónica.',
    icono: '🔗',
  },
  {
    titulo: 'Referencia obligatoria',
    descripcion: 'La DGII rechaza ND/NC sin referencia. Si ves un error de "e-NCF original no encontrado", significa que la factura base se emitió antes de activar e-CF — la ND/NC se generará con NCF papel.',
    icono: '⚠️',
  },
]

export const FE_TUTORIAL_ACC = [
  {
    titulo: 'Gastos Menores de Caja Chica (e-CF 43)',
    descripcion: 'Los egresos de caja chica que tengan comprobante fiscal generan un e-CF tipo 43 (Gastos Menores). Aplica a gastos hasta RD$50,000 donde el proveedor no emite NCF.',
    icono: '🧾',
  },
  {
    titulo: 'Sin cambios en tu flujo',
    descripcion: 'Sigue registrando egresos normalmente. El e-CF se genera al guardar, automáticamente. El e-NCF aparecerá en el comprobante impreso.',
    icono: '✅',
  },
]

export const FE_TUTORIAL_INV = [
  {
    titulo: 'Devoluciones generan NC electrónica',
    descripcion: 'Cuando registras una devolución de venta (DV/DC), el sistema genera automáticamente una Nota de Crédito electrónica (e-CF 34) que referencia la factura original.',
    icono: '↩️',
  },
  {
    titulo: 'El e-CF va por CxC',
    descripcion: 'La devolución en Inventario genera el NCF de la NC desde CxC (misma serie). El envío a la DGII es automático — no necesitas hacer nada en CxC después.',
    icono: '🔄',
  },
]
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(fe): componente tutorial reutilizable + contenido para 5 módulos"
```

---

### Task 11: Integrar tutorial en FAT

**Files:**
- Modify: `frontend/src/features/fat/facturas.tsx`

- [ ] **Step 1: Agregar hook para verificar si e-CF está activo**

```tsx
import { useFeConfig } from '@/features/fe/api'
import { FeTutorialDialog } from '@/features/fe/fe-tutorial-dialog'
import { FE_TUTORIAL_FAT } from '@/features/fe/fe-ayuda-contenido'

// Dentro del componente:
const { data: feData } = useFeConfig(noCia)
const feActivo = feData?.config?.activo === 'S'

// En el JSX, al final:
<FeTutorialDialog
  moduloKey='fat'
  titulo='Facturación Electrónica en Ventas'
  pasos={FE_TUTORIAL_FAT}
  feActivo={feActivo}
/>
```

- [ ] **Step 2: Agregar badge de estado e-CF en la lista de facturas**

Cuando una factura tiene e-NCF asignado, mostrar un badge verde "e-CF" al lado del número.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(fat): tutorial e-CF + badge estado en lista facturas"
```

---

### Task 12: Integrar tutorial en CxP, CxC, ACC e INV

**Files:**
- Modify: `frontend/src/features/cxp/cxp-documentos.tsx`
- Modify: `frontend/src/features/cxc/cxc-documentos.tsx`
- Modify: `frontend/src/features/acc/acc-egresos.tsx` (o equivalente)
- Modify: `frontend/src/features/inv/inv-devoluciones.tsx` (o equivalente)

Mismo patrón que Task 11, usando `FE_TUTORIAL_CXP`, `FE_TUTORIAL_CXC`, `FE_TUTORIAL_ACC` y `FE_TUTORIAL_INV`.

- [ ] **Step 1-3: CxP** — tutorial + badge
- [ ] **Step 4-6: CxC** — tutorial + badge + indicador de referencia e-NCF
- [ ] **Step 7-8: ACC** — tutorial en egresos caja chica
- [ ] **Step 9-10: INV** — tutorial en devoluciones (informativo: el e-CF lo maneja CxC)
- [ ] **Step 11: Commit**

```bash
git commit -m "feat: tutoriales e-CF en CxP, CxC, ACC e INV"
```

---

### Task 13: Tools del chatbot (asistente) para e-CF

**Files:**
- Create: `backend/apps/asistente/tools/fe.py`
- Modify: `backend/apps/asistente/skills/facturar/SKILL.md`
- Create: `backend/apps/asistente/skills/consultar-ecf/SKILL.md`

El chatbot necesita poder: consultar el estado de un e-CF, listar los últimos envíos, reenviar un rechazado, y explicar qué hacer cuando algo falla.

- [ ] **Step 1: Crear `tools/fe.py`**

```python
# backend/apps/asistente/tools/fe.py
"""Tools de Facturación Electrónica para el chatbot asistente."""
from __future__ import annotations
from typing import Any
from apps.asistente.tools.registry import ToolSpec, register_tool


def _fe_listar_documentos(
    no_cia: str, estado: str = '', tipo_ecf: str = '',
    page: int = 1, page_size: int = 10,
) -> dict[str, Any]:
    from apps.legacy.repositories import fe_repo
    return fe_repo.list_documentos(
        no_cia=no_cia, estado=estado, tipo_ecf=tipo_ecf,
        limit=int(page_size), offset=(int(page) - 1) * int(page_size),
    )


def _fe_consultar_estado(no_cia: str, e_ncf: str) -> dict[str, Any]:
    from apps.legacy.repositories import fe_repo
    from apps.fe import dgii_client
    doc = fe_repo.get_documento(no_cia, e_ncf)
    if not doc:
        return {'error': f'e-NCF {e_ncf} no encontrado'}
    cfg = fe_repo.get_config(no_cia)
    ambiente = cfg.get('ambiente', 'ecf') if cfg else 'ecf'
    resultado = dgii_client.consultar_estado(no_cia, ambiente, doc['track_id'])
    return {
        'e_ncf': e_ncf,
        'estado_dgii': resultado.get('estado'),
        'codigo': resultado.get('codigo'),
        'mensajes': resultado.get('mensajes'),
        'fecha_recepcion': resultado.get('fechaRecepcion'),
    }


def _fe_estado_config(no_cia: str) -> dict[str, Any]:
    from apps.legacy.repositories import fe_repo
    cfg = fe_repo.get_config(no_cia)
    if not cfg:
        return {'activo': False, 'mensaje': 'No hay configuración e-CF para esta empresa'}
    secs = fe_repo.list_secuencias(no_cia)
    return {
        'activo': cfg.get('activo') == 'S',
        'ambiente': cfg.get('ambiente'),
        'estado_cert': cfg.get('estado_cert'),
        'certificado_vence': cfg.get('cert_vence'),
        'secuencias': [{
            'tipo': s['tipo_ecf'],
            'proxima': s['prox_secuencia'],
            'hasta': s['secuencia_hasta'],
            'disponibles': s['secuencia_hasta'] - s['prox_secuencia'] + 1,
        } for s in secs],
    }


register_tool(ToolSpec(
    name='fe_listar_documentos',
    description=(
        'Lista los comprobantes electrónicos (e-CF) enviados a la DGII. '
        'Puede filtrar por estado (ENVIADO, ACEPTADO, RECHAZADO) y tipo (31, 32, 33, 34, 41, 43, 47).'
    ),
    input_schema={
        'type': 'object',
        'properties': {
            'no_cia': {'type': 'string', 'description': 'Código de empresa'},
            'estado': {'type': 'string', 'description': 'Filtro: ENVIADO, ACEPTADO, RECHAZADO'},
            'tipo_ecf': {'type': 'string', 'description': 'Filtro: 31, 32, 33, 34, 41, 43, 47'},
            'page': {'type': 'integer', 'default': 1},
            'page_size': {'type': 'integer', 'default': 10},
        },
        'required': ['no_cia'],
    },
    handler=_fe_listar_documentos,
    modules_required=['FAT'],
))

register_tool(ToolSpec(
    name='fe_consultar_estado',
    description=(
        'Consulta en la DGII el estado actual de un e-CF enviado. '
        'Retorna si fue Aceptado, Rechazado o En Proceso, con los mensajes de la DGII.'
    ),
    input_schema={
        'type': 'object',
        'properties': {
            'no_cia': {'type': 'string'},
            'e_ncf': {'type': 'string', 'description': 'El e-NCF completo, ej. E310000000141'},
        },
        'required': ['no_cia', 'e_ncf'],
    },
    handler=_fe_consultar_estado,
    modules_required=['FAT'],
))

register_tool(ToolSpec(
    name='fe_estado_config',
    description=(
        'Muestra el estado de la facturación electrónica: '
        'si está activa, ambiente, certificado, secuencias e-NCF disponibles.'
    ),
    input_schema={
        'type': 'object',
        'properties': {
            'no_cia': {'type': 'string'},
        },
        'required': ['no_cia'],
    },
    handler=_fe_estado_config,
    modules_required=['FAT'],
))
```

- [ ] **Step 2: Actualizar skill de facturar**

Agregar al final de `backend/apps/asistente/skills/facturar/SKILL.md`:

```markdown
## 8. Comprobante electrónico (si aplica)

Después de crear la factura, si la respuesta incluye `ecf`:
- Informa al usuario: "Se generó el e-CF {ecf.e_ncf} y se envió a la DGII."
- Si el usuario pregunta por el estado: usa `fe_consultar_estado`.

Si la respuesta NO incluye `ecf` pero el usuario pregunta por facturación electrónica:
- Usa `fe_estado_config` para verificar si está activa.
- Si no está activa, explica: "La emisión electrónica no está activa. Se puede activar en Configuración → Facturación Electrónica."
```

- [ ] **Step 3: Crear skill `consultar-ecf`**

```markdown
---
name: consultar-ecf
description: Consultar el estado de un comprobante electrónico (e-CF) enviado a la DGII.
when_to_use: ["estado del e-CF", "comprobante electrónico", "factura electrónica", "DGII rechazó", "e-NCF"]
modules_required: [FAT]
tools_used: [fe_listar_documentos, fe_consultar_estado, fe_estado_config]
estimated_steps: 2-4
---

# Skill: Consultar e-CF

## 1. Identificar el comprobante

- Si el usuario da un e-NCF específico: ir al paso 2.
- Si dice "la última factura" o similar: `fe_listar_documentos(no_cia, page_size=5)`.
- Si pregunta por rechazados: `fe_listar_documentos(no_cia, estado='RECHAZADO')`.

## 2. Consultar estado en la DGII

`fe_consultar_estado(no_cia, e_ncf)` → muestra estado, mensajes.

## 3. Interpretar resultado

- **Aceptado:** todo OK, no se necesita acción.
- **Rechazado:** leer `mensajes` de la DGII y explicar en lenguaje simple qué corregir.
- **En Proceso:** la DGII aún no lo ha validado, esperar unos minutos.

## 4. Acciones

- Si rechazado: sugerir corregir el dato y volver a facturar (el e-NCF rechazado ya se quemó, se usará uno nuevo).
- Si necesita reenviar: Configuración → Facturación Electrónica → tab "Comprobante Electrónico".

## Errores comunes y soluciones

| Error DGII | Causa | Solución |
|-------------|-------|----------|
| RNC inválido | RNC del cliente/proveedor no está en DGII | Verificar RNC en dgii.gov.do |
| Razón social no coincide | Nombre difiere del registrado en DGII | Corregir en el maestro de clientes |
| NCF duplicado | e-NCF ya fue enviado antes | No reenviar, crear nuevo documento |
| Monto inválido | Formato o valor fuera de rango | Revisar totales del documento |
| Certificado vencido | .p12 expiró | Renovar con certificadora INDOTEL |
```

- [ ] **Step 4: Registrar import**

```python
# En backend/apps/asistente/tools/__init__.py
from apps.asistente.tools import fe  # noqa: F401
```

- [ ] **Step 5: Test**

```python
def test_fe_tools_registered():
    from apps.asistente.tools.registry import REGISTRY
    assert 'fe_listar_documentos' in REGISTRY
    assert 'fe_consultar_estado' in REGISTRY
    assert 'fe_estado_config' in REGISTRY
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(asistente): tools y skills del chatbot para e-CF"
```

---

### Task 14: Deploy a VM + Netlify y prueba E2E

**Files:**
- Ninguno nuevo — deploy y verificación

- [ ] **Step 1: Deploy backend a VM**

```bash
# Copiar archivos nuevos/modificados
pscp -hostkey "SHA256:..." -pw "Temp1234!" backend/apps/fe/emision.py jcabreu@10.0.0.99:/tmp/
pscp ... backend/apps/asistente/tools/fe.py jcabreu@10.0.0.99:/tmp/
# docker cp + restart
```

- [ ] **Step 2: Push frontend a main (Netlify)**

- [ ] **Step 3: Test E2E completo**

1. Activar el switch en la UI → verificar que el tutorial aparece
2. **FAT:** Crear factura FT → verificar e-CF tipo 31 o 32
3. **FAT (RFCE):** Crear factura consumo < 250K → verificar que va por RFCE
4. **CxP:** Entrar FP → verificar e-CF tipo 41
5. **CxC:** Crear ND → verificar e-CF tipo 33 con referencia
6. **CxC:** Crear NC → verificar e-CF tipo 34 con referencia
7. **ACC:** Crear egreso caja chica con NCF → verificar e-CF tipo 43
8. Ir a Comprobante Electrónico → verificar que aparecen todos los envíos
9. **Chatbot:** "¿cuál es el estado de mi última factura electrónica?"

- [ ] **Step 4: Si todo OK, confirmar ambiente `ecf` (producción DGII)**

---

## Resumen de dependencias

```
Task 1 (config fallback) → Task 2 (orquestador con RFCE)
  → Task 3 (FAT hook)
  → Task 4 (builders CxP) → Task 7 (CxP hook)
  → Task 5 (builders CxC) → Task 8 (CxC hook)
  → Task 6 (builder ACC)  → Task 9 (ACC hook)
Task 10 (componente tutorial) → Task 11 (FAT tutorial) → Task 12 (CxP/CxC/ACC/INV tutorial)
Task 13 (chatbot tools) — independiente
Task 14 (deploy) — después de todos los demás
```

## Módulos sin integración (confirmado)

Los siguientes módulos **NO** requieren integración e-CF:
- **ODC** (Órdenes de Compra) — documento interno, sin valor fiscal
- **ACF** (Activos Fijos) — depreciación/contable, sin comprobante
- **SDN** (Nómina) — salarios/deducciones, sin NCF
- **MAN** (Mantenimiento) — órdenes de trabajo internas
- **CHC** (Cheques) — instrumento de pago, no comprobante fiscal
- **LIC** (Licitaciones) — scraper externo
- **CNT** (Contabilidad General) — solo mantiene tabla maestra TCNT_NCF
