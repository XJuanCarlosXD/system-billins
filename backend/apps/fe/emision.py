"""Orquestador de emisión automática de e-CF.

Punto central que conecta el flujo de negocio (FAT/CxP/CxC/ACC) con la
infraestructura de e-CF (builder/firma/envío). Se llama DESPUÉS del commit
de la transacción de negocio — un fallo aquí NO revierte el documento.

Reglas DGII integradas:
- Tipo 32 (Consumo) < RD$250,000 → RFCE (host fc.dgii.gov.do, síncrono)
- Tipos 33/34 (ND/NC) requieren referencia al e-NCF original (minOccurs=1)
- Tipos 43/47 tienen Totales reducidos (sin MontoGravado/ITBIS)
- Posiciones NCF papel → tipo e-CF: B01→31, B02→32, B14→44, B15→45, B16→46
"""
from __future__ import annotations

import logging
import re
from decimal import Decimal

from apps.legacy.repositories import fe_repo

log = logging.getLogger('fe.emision')

UMBRAL_RFCE = Decimal('250000')

# Mapeo posiciones_fijas_ncf (NCF papel) → tipo e-CF
_POSICIONES_A_TIPO_ECF = {
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
    modulo: str,
    tipo_docu: str,
    no_docu: str,
    no_cliente: str = '',
    no_proveedor: str = '',
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

        from apps.fe import ecf_builder, dgii_client

        xml_sin_firmar = _construir_xml(
            tipo_ecf, modulo, no_cia, punto, tipo_docu, no_docu)

        e_ncf = _extraer_encf(xml_sin_firmar)

        # RFCE: tipo 32 < 250K va por fc.dgii.gov.do (síncrono)
        es_rfce = (tipo_ecf == 32 and _es_rfce(no_cia, punto, tipo_docu, no_docu))

        if es_rfce:
            resultado = dgii_client.enviar_rfce(
                no_cia, ambiente, e_ncf, xml_sin_firmar)
            track_id = resultado.get('trackId', '')
            estado_dgii = resultado.get('estado', 'ENVIADO')
        else:
            resultado = dgii_client.enviar_ecf(
                no_cia, ambiente, e_ncf, xml_sin_firmar)
            track_id = resultado['trackId']
            estado_dgii = 'ENVIADO'

        fe_repo.save_documento_enviado(
            no_cia=no_cia,
            e_ncf=e_ncf,
            tipo_ecf=str(tipo_ecf),
            track_id=track_id,
            xml_firmado=resultado.get('xml_firmado', ''),
            respuesta=str(resultado.get('respuesta_cruda', '')),
            punto=punto,
            tipo_docu=tipo_docu,
            no_docu=no_docu,
        )

        log.info("e-CF emitido: %s %s/%s → %s (track %s)",
                 modulo, tipo_docu, no_docu, e_ncf, track_id)

        return {
            'e_ncf': e_ncf,
            'track_id': track_id,
            'estado': estado_dgii,
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


def _resolver_tipo_ecf(modulo: str, tipo_docu: str, no_cia: str,
                       punto: str, no_docu: str) -> int | None:
    td = tipo_docu.strip().upper()

    if modulo == 'FAT':
        from apps.legacy.repositories import fat_repo
        fac = fat_repo.get_factura(no_cia, punto, td, no_docu)
        if not fac:
            return None
        if fac.get('st_anulado') == 'S':
            return None
        posiciones = (fac.get('posiciones_fijas_ncf') or '').strip().upper()
        return _POSICIONES_A_TIPO_ECF.get(posiciones, 32)

    if modulo == 'CXP':
        return _CXP_TIPO_ECF.get(td)

    if modulo == 'CXC':
        return _CXC_TIPO_ECF.get(td)

    if modulo == 'ACC':
        return 43  # Gastos Menores

    return None


def _construir_xml(tipo_ecf: int, modulo: str, no_cia: str, punto: str,
                   tipo_docu: str, no_docu: str) -> str:
    from apps.fe import ecf_builder

    if modulo == 'FAT':
        if tipo_ecf == 31:
            return ecf_builder.construir_ecf_31(no_cia, punto, tipo_docu, no_docu)
        elif tipo_ecf == 32:
            return ecf_builder.construir_ecf_32(no_cia, punto, tipo_docu, no_docu)
        elif tipo_ecf in (44, 45, 46):
            return ecf_builder.construir_ecf_31(no_cia, punto, tipo_docu, no_docu)
        raise ValueError(f"Tipo e-CF {tipo_ecf} no soportado para FAT")

    if modulo == 'CXP':
        return ecf_builder.construir_ecf_cxp(tipo_ecf, no_cia, punto, tipo_docu, no_docu)

    if modulo == 'CXC':
        return ecf_builder.construir_ecf_cxc(tipo_ecf, no_cia, punto, tipo_docu, no_docu)

    if modulo == 'ACC':
        return ecf_builder.construir_ecf_acc(tipo_ecf, no_cia, punto, tipo_docu, no_docu)

    raise ValueError(f"Módulo {modulo} no soportado para e-CF")


def _es_rfce(no_cia: str, punto: str, tipo_docu: str, no_docu: str) -> bool:
    """Tipo 32 < RD$250,000 va por RFCE (host diferente, síncrono)."""
    from apps.legacy.repositories import fat_repo
    fac = fat_repo.get_factura(no_cia, punto, tipo_docu, no_docu)
    if not fac:
        return False
    monto = Decimal(str(fac.get('total') or 0))
    return monto < UMBRAL_RFCE


def emitir_anulacion_ecf(
    *,
    no_cia: str,
    punto: str,
    tipo_factura: str,
    no_factura: str,
) -> dict | None:
    """Emite un E34 (NC) de anulación para una factura FAT que ya tiene e-NCF.

    Se llama DESPUÉS de anular_factura(). Busca el e-NCF original en
    TFE_DOCUMENTO; si no existe (factura sin e-CF), retorna None.
    Nunca lanza excepción — errores se loguean y generan ticket.
    """
    try:
        cfg = fe_repo.get_config(no_cia)
        if not cfg or cfg.get('activo') != 'S':
            return None

        encf_original = fe_repo.get_encf_por_documento(
            no_cia, punto, tipo_factura, no_factura)
        if not encf_original:
            return None

        ambiente = cfg.get('ambiente', 'ecf')

        from apps.fe import ecf_builder, dgii_client

        xml_sin_firmar = ecf_builder.construir_ecf_anulacion_fat(
            no_cia, punto, tipo_factura, no_factura, encf_original)

        e_ncf = _extraer_encf(xml_sin_firmar)

        resultado = dgii_client.enviar_ecf(
            no_cia, ambiente, e_ncf, xml_sin_firmar)
        track_id = resultado['trackId']

        fe_repo.save_documento_enviado(
            no_cia=no_cia,
            e_ncf=e_ncf,
            tipo_ecf='34',
            track_id=track_id,
            xml_firmado=resultado.get('xml_firmado', ''),
            respuesta=str(resultado.get('respuesta_cruda', '')),
            punto=punto,
            tipo_docu=tipo_factura,
            no_docu=no_factura,
        )

        log.info("e-CF anulación emitida: FAT %s/%s → %s (ref %s, track %s)",
                 tipo_factura, no_factura, e_ncf, encf_original, track_id)

        return {
            'e_ncf': e_ncf,
            'e_ncf_original': encf_original,
            'track_id': track_id,
            'estado': 'ENVIADO',
        }

    except Exception:
        log.exception("Error emitiendo e-CF anulación para FAT %s/%s cia %s",
                      tipo_factura, no_factura, no_cia)
        try:
            from apps.reportes.auto_ticket import log_error_ticket
            log_error_ticket(
                f"e-CF anulación falló: FAT {tipo_factura}/{no_factura} cia {no_cia}",
                modulo='FE',
            )
        except Exception:
            pass
        return None


def _extraer_encf(xml: str) -> str:
    m = re.search(r'<eNCF>([^<]+)</eNCF>', xml)
    if not m:
        raise ValueError("XML no contiene <eNCF>")
    return m.group(1)
