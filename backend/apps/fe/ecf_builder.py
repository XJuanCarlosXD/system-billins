"""Generacion del XML e-CF (Encabezado + DetallesItems + FechaHoraFirma)
para los tipos 31 (Factura de Credito Fiscal Electronica) y 32 (Factura de
Consumo Electronica).

Fuente de verdad: los XSD reales de la DGII en
``backend/docs/superpowers/reference/2026-08-31-set-pruebas-paso2/``
(``e-CF-31-v1.0.xsd`` / ``e-CF-32-v1.0.xsd``). Comparten el mismo elemento
raiz ``<ECF>`` y la mayoria del arbol es identica -- por eso hay un solo
builder interno (``_construir_ecf``) para ambos -- pero NO son el mismo
esquema. Diferencias que este modulo SI respeta (rama explicita por
``tipo_ecf``):

- ``IdDoc/FechaVencimientoSecuencia`` (minOccurs=1) existe solo en 31,
  justo despues de ``eNCF``; no existe en 32.
- ``Comprador/RNCComprador`` y ``RazonSocialComprador`` son obligatorios
  en 31 (levanta ``ECFBuilderError`` si faltan); opcionales en 32.

Diferencias adicionales que este modulo NO implementa (ambas opcionales
en el XSD, sin dato mapeado): el bloque de retencion/percepcion de
``Totales``/``Item`` (solo en 31, ``TFAT_FACTURA.itbis_retenido``/
``isr_retenido`` ya existen y podrian mapear aqui si algun dia se pide) y
``Comprador/IdentificadorExtranjero`` + el bloque ``Mineria`` de ``Item``
(solo en 32, no aplica al negocio de Abregonza). Ver ``NOTAS.md`` en esa
misma carpeta para el mapeo completo campo e-CF -> columna real.

Alcance: SOLO arma el XML "sin firmar", terminando en ``FechaHoraFirma``.
El XSD exige despues un ``<xs:any>`` donde va el ``<Signature>`` XMLDSig;
ese nodo lo agrega ``apps.fe.firma.firmar_con_app_oficial()`` despues y
este modulo no lo genera ni lo importa.

``construir_ecf_31``/``construir_ecf_32`` toman
``(no_cia, punto, tipo_factura, no_factura)`` -- la clave real de
``TFAT_FACTURA`` (ver ``fat_repo.get_factura``); no existe una columna
``no_docu`` unica para identificar una factura de FAT.
"""
from __future__ import annotations

import re
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal

from lxml import etree

from apps.legacy.repositories import fat_repo, fe_repo

# IdDoc/TipoeCF soportados por los wrappers publicos de este modulo (los
# otros 8 valores del catalogo -- 33,34,41,43,44,45,46,47 -- quedan fuera
# de alcance de Task 1, ver NOTAS.md #1 y #4: el modo test generico para
# esos tipos es Task 5).
TIPO_CREDITO_FISCAL = 31
TIPO_CONSUMO = 32

# posiciones_fijas_ncf reales (ver fat_repo._compose_ncf_dgi / CNT.TCNT_NCF)
# que clasifican una factura como Credito Fiscal o Consumo -- el MISMO
# criterio que ya usa el resto del sistema (607 en fat_repo.archivo_dgii_607,
# cuadre de caja por B01/B02) para distinguir el NCF de papel. No se
# inventa un criterio nuevo para el e-CF.
_POSICIONES_CREDITO_FISCAL = {'B01', 'E31'}
_POSICIONES_CONSUMO = {'B02', 'E32'}

# TFAT_FACTURAL.porciento_impuesto -> IdDoc/DetallesItems/Item/
# IndicadorFacturacion (0 No facturable / 1 ITBIS 18% / 2 ITBIS 16% /
# 3 ITBIS 0% / 4 Exento), segun NOTAS.md Set de Pruebas Paso 2 #2 y #3.
_INDICADOR_POR_PORCIENTO = {18: 1, 16: 2, 0: 3}

# TFAT_TIPO_PAGO.tipo_pago == '4' es el codigo que fat_repo.create_factura
# ya fuerza para toda factura con afecta_cxc='S' (ver comentario "A CREDITO"
# en fat_repo.py) -- se reutiliza el mismo codigo para decidir
# IdDoc/TipoPago (1 Contado / 2 Credito) en vez de inventar una regla nueva.
_FORMA_PAGO_CREDITO = '4'


class ECFBuilderError(ValueError):
    """Datos de la factura insuficientes/inconsistentes para armar el e-CF.

    Se usa ValueError como base para que el codigo existente que ya atrapa
    ValueError de los repos (ver vistas legacy) siga funcionando si esto se
    conecta a un endpoint sin cambios adicionales.
    """


def _solo_digitos(valor: str | None) -> str:
    return ''.join(ch for ch in (valor or '') if ch.isdigit())


def _rnc_valido(digitos: str) -> bool:
    return len(digitos) in (9, 11)


def _fmt_monto(valor) -> str:
    """Decimal18D1or2.../Decimal20D1or4...: 2 decimales, punto, sin miles."""
    d = Decimal(str(valor if valor is not None else 0)).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP)
    return f"{d:.2f}"


def _fmt_fecha(fecha) -> str:
    """dd-mm-aaaa, segun FechaValidationType del XSD (ver NOTAS.md #2)."""
    if isinstance(fecha, datetime):
        dt = fecha
    else:
        dt = datetime.strptime(str(fecha)[:10], '%Y-%m-%d')
    return dt.strftime('%d-%m-%Y')


def _fecha_hora_firma(momento: datetime | None = None) -> str:
    """dd-mm-aaaa HH:MM:SS, segun DateTimeValidationType del XSD.

    Se calcula aqui con la hora local del servidor en el momento de armar
    el XML. La firma (``firmar_con_app_oficial``) NO reescribe este valor
    -- si en el futuro se prefiere que sea el proceso de firma quien decida
    el instante exacto, este parametro ya esta expuesto para que el
    llamador lo fije explicitamente en vez de dejarlo aqui.
    """
    return (momento or datetime.now()).strftime('%d-%m-%Y %H:%M:%S')


def _indicador_facturacion(porciento_impuesto) -> int:
    if porciento_impuesto is None:
        return 4  # Exento
    try:
        p = int(round(float(porciento_impuesto)))
    except (TypeError, ValueError):
        return 4
    return _INDICADOR_POR_PORCIENTO.get(p, 4)


def _resolver_tipo_ecf_esperado(posiciones_fijas_ncf: str | None) -> int | None:
    p = (posiciones_fijas_ncf or '').strip().upper()
    if p in _POSICIONES_CREDITO_FISCAL:
        return TIPO_CREDITO_FISCAL
    if p in _POSICIONES_CONSUMO:
        return TIPO_CONSUMO
    return None


def _sub(parent, tag: str, text=None):
    el = etree.SubElement(parent, tag)
    if text is not None:
        el.text = str(text)
    return el


def _tipo_pago_y_formas(datos_fiscales: dict,
                        monto_total: str) -> tuple[int, list[tuple[int, str]]]:
    """IdDoc/TipoPago (1 Contado/2 Credito) + TablaFormasPago/FormaDePago.

    Regla: forma_pago_fat == '4' (A CREDITO, ver constante del modulo) es el
    unico codigo que el resto del sistema ya usa para marcar una factura
    como credito. Cualquier otro codigo se trata como contado y se reporta
    con un unico FormaDePago usando tipo_pago_fiscal (FormaPagoType 1-8);
    si no esta configurado o es invalido se asume 1=Efectivo en vez de
    fallar la generacion del documento (mismo espiritu del fallback que ya
    usa fat_repo.archivo_dgii_607: ``int(r['forma_pago_dgii'] or 0)``).
    """
    if (datos_fiscales.get('forma_pago_fat') or '') == _FORMA_PAGO_CREDITO:
        return 2, []
    try:
        forma_pago = int(datos_fiscales.get('tipo_pago_fiscal') or 0)
        if not 1 <= forma_pago <= 8:
            forma_pago = 1
    except (TypeError, ValueError):
        forma_pago = 1
    return 1, [(forma_pago, monto_total)]


def _construir_ecf(tipo_ecf: int, factura: dict, datos_fiscales: dict,
                   emisor: dict) -> str:
    """Builder generico compartido por Credito Fiscal (31) y Consumo (32).

    ``factura`` es el dict de ``fat_repo.get_factura`` con ``e_ncf`` y
    ``fecha_vencimiento_secuencia`` agregados por el wrapper (de
    ``fe_repo.consumir_siguiente_encf``) y ``datos_fiscales`` el de
    ``fat_repo.get_datos_fiscales_factura``. ``emisor`` viene de
    ``fe_repo.get_config``.
    """
    lineas = [l for l in factura['lineas'] if (l.get('st_anulado') or 'N') != 'S']
    if not lineas:
        raise ECFBuilderError(
            f"La factura {factura['tipo_factura']}-{factura['no_factura']} "
            "no tiene lineas activas para facturar")

    monto_total = _fmt_monto(factura['total_neto'])
    porcientos_raw = datos_fiscales.get('lineas_porciento_raw') or {}
    # Se calcula una sola vez por linea (no en Totales y de nuevo en
    # DetallesItems) y se reutiliza en ambos lugares.
    indicadores = {
        int(l['no_linea']): _indicador_facturacion(
            porcientos_raw.get(int(l['no_linea']), l.get('porciento_impuesto')))
        for l in lineas
    }

    ecf = etree.Element('ECF')
    encabezado = _sub(ecf, 'Encabezado')
    _sub(encabezado, 'Version', '1.0')

    id_doc = _sub(encabezado, 'IdDoc')
    _sub(id_doc, 'TipoeCF', tipo_ecf)
    _sub(id_doc, 'eNCF', factura['e_ncf'])
    if tipo_ecf == TIPO_CREDITO_FISCAL:
        # Obligatorio SOLO en 31 -- e-CF-31-v1.0.xsd exige
        # IdDoc/FechaVencimientoSecuencia (minOccurs=1) justo despues de
        # eNCF; e-CF-32-v1.0.xsd no tiene este elemento en absoluto
        # (confirmado diffeando ambos XSD reales, no es un campo comun a
        # los 10 tipos como se asumio originalmente).
        fecha_vencimiento = factura.get('fecha_vencimiento_secuencia')
        if not fecha_vencimiento:
            raise ECFBuilderError(
                "TFE_SECUENCIA no tiene fecha_vence configurada para el "
                "tipo 31 en esta compania -- obligatoria para "
                "IdDoc/FechaVencimientoSecuencia del e-CF de Credito Fiscal")
        _sub(id_doc, 'FechaVencimientoSecuencia', _fmt_fecha(fecha_vencimiento))
    _sub(id_doc, 'TipoIngresos', datos_fiscales['tipo_ingreso'])
    tipo_pago, formas_pago = _tipo_pago_y_formas(datos_fiscales, monto_total)
    _sub(id_doc, 'TipoPago', tipo_pago)
    if formas_pago:
        tabla = _sub(id_doc, 'TablaFormasPago')
        for forma_pago, monto_pago in formas_pago:
            fdp = _sub(tabla, 'FormaDePago')
            _sub(fdp, 'FormaPago', forma_pago)
            _sub(fdp, 'MontoPago', monto_pago)

    rnc_emisor = _solo_digitos(emisor.get('rnc'))
    if not _rnc_valido(rnc_emisor):
        raise ECFBuilderError(
            f"RNC del emisor invalido en TFE_CONFIG: {emisor.get('rnc')!r} "
            "(debe tener 9 u 11 digitos)")
    razon_social_emisor = (emisor.get('razon_social') or '').strip()
    if not razon_social_emisor:
        raise ECFBuilderError(
            "TFE_CONFIG no tiene razon_social configurada para esta compania")
    direccion_emisor = (emisor.get('direccion') or '').strip()
    if not direccion_emisor:
        raise ECFBuilderError(
            "TFE_CONFIG no tiene direccion_emisor configurada para esta compania")

    em = _sub(encabezado, 'Emisor')
    _sub(em, 'RNCEmisor', rnc_emisor)
    _sub(em, 'RazonSocialEmisor', razon_social_emisor[:150])
    if (emisor.get('nombre_comercial') or '').strip():
        _sub(em, 'NombreComercial', emisor['nombre_comercial'].strip()[:150])
    _sub(em, 'DireccionEmisor', direccion_emisor[:100])
    if (emisor.get('municipio') or '').strip():
        _sub(em, 'Municipio', emisor['municipio'].strip())
    if (emisor.get('provincia') or '').strip():
        _sub(em, 'Provincia', emisor['provincia'].strip())
    _sub(em, 'FechaEmision', _fmt_fecha(factura['fecha']))

    comprador = _sub(encabezado, 'Comprador')
    rnc_comprador = _solo_digitos(datos_fiscales.get('rnc_comprador'))
    razon_comprador = (factura.get('nombre_cliente_factura')
                       or factura.get('nombre_cliente') or '').strip()
    if tipo_ecf == TIPO_CREDITO_FISCAL:
        # e-CF-31-v1.0.xsd exige Comprador/RNCComprador y
        # Comprador/RazonSocialComprador (minOccurs=1 los dos); en
        # e-CF-32-v1.0.xsd ambos son opcionales (consumidor final sin RNC).
        # Un e-CF 31 sin RNC/razon social del comprador es un documento
        # invalido para la DGII -- no se debe generar en silencio.
        if not _rnc_valido(rnc_comprador):
            raise ECFBuilderError(
                "e-CF 31 (Credito Fiscal) requiere un RNC/cedula valido "
                "(9 u 11 digitos) del comprador; la factura "
                f"{factura['tipo_factura']}-{factura['no_factura']} tiene "
                f"{datos_fiscales.get('rnc_comprador')!r}")
        if not razon_comprador:
            raise ECFBuilderError(
                "e-CF 31 (Credito Fiscal) requiere la razon social del "
                f"comprador; la factura {factura['tipo_factura']}-"
                f"{factura['no_factura']} no la tiene")
        _sub(comprador, 'RNCComprador', rnc_comprador)
        _sub(comprador, 'RazonSocialComprador', razon_comprador[:150])
    else:
        if _rnc_valido(rnc_comprador):
            _sub(comprador, 'RNCComprador', rnc_comprador)
        if razon_comprador:
            _sub(comprador, 'RazonSocialComprador', razon_comprador[:150])
    if (datos_fiscales.get('direccion_comprador') or '').strip():
        _sub(comprador, 'DireccionComprador',
             datos_fiscales['direccion_comprador'].strip()[:100])

    totales = _sub(encabezado, 'Totales')
    total_exento = sum(
        float(l['monto_neto'] or 0) for l in lineas
        if indicadores[int(l['no_linea'])] == 4)
    monto_gravado_total = float(factura['total_linea'] or 0) - total_exento
    if monto_gravado_total > 0:
        _sub(totales, 'MontoGravadoTotal', _fmt_monto(monto_gravado_total))
    if total_exento > 0:
        _sub(totales, 'MontoExento', _fmt_monto(total_exento))
    _sub(totales, 'TotalITBIS', _fmt_monto(factura['impuesto']))
    _sub(totales, 'MontoTotal', monto_total)

    detalles = _sub(ecf, 'DetallesItems')
    for linea in lineas:
        no_linea = int(linea['no_linea'])
        item = _sub(detalles, 'Item')
        _sub(item, 'NumeroLinea', no_linea)
        _sub(item, 'IndicadorFacturacion', indicadores[no_linea])
        nombre_item = (linea.get('descripcion') or linea.get('no_produ') or '').strip()
        _sub(item, 'NombreItem', (nombre_item or 'PRODUCTO')[:80])
        # TFAT_FACTURAL no distingue Bien/Servicio; FAT es mayoritariamente
        # venta de bienes -- se asume 1=Bien. Revisar si algun dia se
        # factura servicios puros por este mismo flujo.
        _sub(item, 'IndicadorBienoServicio', 1)
        _sub(item, 'CantidadItem', _fmt_monto(linea['cantidad']))
        _sub(item, 'PrecioUnitarioItem', _fmt_monto(linea['precio']))
        _sub(item, 'MontoItem', _fmt_monto(linea['monto_neto']))

    # FechaHoraFirma es el ultimo elemento real del XSD antes del <xs:any>
    # donde va el <Signature> -- ese nodo lo agrega firmar_con_app_oficial(),
    # no este builder (ver docstring del modulo).
    _sub(ecf, 'FechaHoraFirma', _fecha_hora_firma())

    return etree.tostring(
        ecf, xml_declaration=True, encoding='utf-8',
    ).decode('utf-8')


def _construir_desde_factura(tipo_ecf: int, no_cia: str, punto: str,
                             tipo_factura: str, no_factura: str) -> str:
    factura = fat_repo.get_factura(no_cia, punto, tipo_factura, no_factura)
    if not factura:
        raise ECFBuilderError(
            f"No existe la factura {tipo_factura}-{no_factura} "
            f"(cia {no_cia}, punto {punto})")
    if (factura.get('st_anulado') or 'N') == 'S':
        raise ECFBuilderError(
            f"La factura {tipo_factura}-{no_factura} esta anulada, no se "
            "puede generar su e-CF")

    tipo_esperado = _resolver_tipo_ecf_esperado(factura.get('posiciones_fijas_ncf'))
    if tipo_esperado is None:
        raise ECFBuilderError(
            "La factura no tiene un NCF de tipo Credito Fiscal/Consumo "
            f"asignado (posiciones_fijas_ncf={factura.get('posiciones_fijas_ncf')!r}); "
            "no se puede determinar TipoeCF 31/32.")
    if tipo_esperado != tipo_ecf:
        raise ECFBuilderError(
            f"Se pidio e-CF tipo {tipo_ecf} pero la factura "
            f"{tipo_factura}-{no_factura} es tipo {tipo_esperado} segun su "
            f"NCF de papel ({factura.get('posiciones_fijas_ncf')!r})")

    datos_fiscales = fat_repo.get_datos_fiscales_factura(
        no_cia, punto, tipo_factura, no_factura)
    if not datos_fiscales:
        raise ECFBuilderError(
            "No se pudieron leer los datos fiscales de la factura "
            f"{tipo_factura}-{no_factura}")

    config = fe_repo.get_config(no_cia)
    if not config or not (config.get('rnc_emisor') or '').strip():
        raise ECFBuilderError(
            f"La compania {no_cia} no tiene TFE_CONFIG configurado "
            "(Configuracion > Comprobante Electronico)")

    secuencia = fe_repo.consumir_siguiente_encf(no_cia, tipo_ecf)
    factura['e_ncf'] = secuencia['e_ncf']
    factura['fecha_vencimiento_secuencia'] = secuencia['fecha_vencimiento_secuencia']

    emisor = {
        'rnc': config.get('rnc_emisor'),
        'razon_social': config.get('razon_social'),
        'nombre_comercial': config.get('nombre_comercial'),
        'direccion': config.get('direccion_emisor'),
        'municipio': config.get('municipio'),
        'provincia': config.get('provincia'),
    }
    return _construir_ecf(tipo_ecf, factura, datos_fiscales, emisor)


def construir_ecf_32(no_cia: str, punto: str, tipo_factura: str,
                     no_factura: str) -> str:
    """Factura de Consumo Electronica (IdDoc/TipoeCF=32), sin firmar.

    Consume un e-NCF real de TFE_SECUENCIA (efecto secundario irreversible,
    ver fe_repo.consumir_siguiente_encf) -- llamar solo cuando de verdad se
    va a generar el documento.
    """
    return _construir_desde_factura(TIPO_CONSUMO, no_cia, punto, tipo_factura, no_factura)


def construir_ecf_31(no_cia: str, punto: str, tipo_factura: str,
                     no_factura: str) -> str:
    """Factura de Credito Fiscal Electronica (IdDoc/TipoeCF=31), sin firmar.

    Mismas notas que ``construir_ecf_32`` (consume e-NCF real, no firma).
    """
    return _construir_desde_factura(TIPO_CREDITO_FISCAL, no_cia, punto, tipo_factura, no_factura)


# ---------------------------------------------------------------------------
# Builder generico para el Set de Pruebas de certificacion DGII (Task 5,
# modo test) -- a diferencia de ``_construir_ecf`` (Task 1, arriba), este NO
# recibe un dict con forma de negocio derivado de TFAT_FACTURA. Recibe
# directamente el dict "plano" con notacion de corchetes que el operador
# pega desde una fila de ``set-pruebas-130217432.xlsx`` (columnas nombradas
# igual que los elementos del XSD, ej. ``RNCEmisor``, ``FormaPago[1]``,
# ``NumeroLinea[1]``, ``TipoCodigo[1][1]``). Ver NOTAS.md en
# ``docs/superpowers/reference/2026-08-31-set-pruebas-paso2/`` seccion 5
# para el esquema de aplanado completo (0/1/2 corchetes) y
# ``campos-usados-set-pruebas.txt`` para los 347 campos reales que este
# parser necesita cubrir (de las ~5215 columnas teoricas posibles).
#
# Cubre los 10 valores de TipoeCFType (31,32,33,34,41,43,44,45,46,47) -- los
# otros 8 tipos, fuera de alcance de Task 1, SI son alcance de este builder
# porque el Set de Pruebas real de certificacion trae escenarios de los 10
# (ver NOTAS.md #1). Cada tipo tiene diferencias estructurales reales
# confirmadas diffeando los 10 XSD reales descargados (NOTAS.md #2 y #5) --
# la tabla ``_TIPO_CAPS`` de abajo codifica esas diferencias tal cual se
# encontraron, no una generalizacion inventada.
# ---------------------------------------------------------------------------

TIPOS_ECF_SOPORTADOS = (31, 32, 33, 34, 41, 43, 44, 45, 46, 47)

# Capacidades/diferencias estructurales por TipoeCF, confirmadas leyendo
# directamente cada ``e-CF-<tipo>-v1.0.xsd`` real (no inferidas):
#
# - fecha_venc: IdDoc/FechaVencimientoSecuencia existe y es minOccurs=1
#   (todos salvo 32 y 34).
# - ind_nota_credito: IdDoc/IndicadorNotaCredito existe y es minOccurs=1
#   (solo 34 -- mutuamente excluyente con fecha_venc en la misma posicion
#   del IdDoc, justo despues de eNCF).
# - tipo_ingresos: IdDoc/TipoIngresos existe en el esquema (ausente por
#   completo, no solo opcional, en 41/43/47).
# - tipo_pago_mandatory: IdDoc/TipoPago es minOccurs=1 (si no, es
#   minOccurs=0 en 41/43/47 -- el elemento existe pero no es obligatorio).
# - tabla_formas_pago: IdDoc/TablaFormasPago existe en el esquema (ausente
#   por completo en 34 y 43).
# - comprador: 'rnc_razon_mandatory' (31/41/45 -- RNCComprador Y
#   RazonSocialComprador minOccurs=1), 'razon_mandatory' (44/46 -- solo
#   RazonSocialComprador minOccurs=1), 'opcional' (32/33/34 -- todo
#   opcional), 'reducido' (47 -- Comprador solo tiene
#   IdentificadorExtranjero+RazonSocialComprador, SIN RNCComprador, y el
#   contenedor es opcional), 'ninguno' (43 -- el elemento Comprador no
#   existe en absoluto en e-CF-43-v1.0.xsd).
# - item_retencion: 'no' (32/43/44/45/46 -- el bloque Item/Retencion no
#   existe), 'opcional' (31/33/34 -- existe, minOccurs=0),
#   'mandatory_indicador' (41 -- Retencion e
#   IndicadorAgenteRetencionoPercepcion son minOccurs=1, los montos son
#   opcionales), 'mandatory_completo' (47 -- Retencion,
#   IndicadorAgenteRetencionoPercepcion y MontoISRRetenido son minOccurs=1;
#   47 ademas no tiene MontoITBISRetenido en absoluto).
# - totales_completo: False en 43/47 -- Totales se reduce a
#   MontoExento/MontoTotal/MontoPeriodo/SaldoAnterior/MontoAvancePago/
#   ValorPagar(+TotalISRRetencion en 47); no existen
#   MontoGravado*/ITBIS%/TotalITBIS*/MontoImpuestoAdicional/
#   ImpuestosAdicionales en esos dos tipos.
# - info_referencia_mandatory: InformacionReferencia y sus hijos
#   NCFModificado/FechaNCFModificado/CodigoModificacion son minOccurs=1
#   (33 y 34 -- Nota de Debito/Credito, tienen que referenciar el NCF que
#   modifican).
# - tipo_ingresos_mandatory: IdDoc/TipoIngresos es minOccurs=1 cuando
#   ``tipo_ingresos`` es True (31/32/44/45/46); en 33/34 el elemento existe
#   pero es minOccurs=0 -- no confundir con "ausente del esquema"
#   (``tipo_ingresos=False``, que ya cubre 41/43/47).
# - transporte: conjunto de campos de Transporte que existen en el esquema
#   de este tipo -- frozenset() vacio significa que el elemento Transporte
#   NO existe en absoluto (41/43, confirmado -- 0 apariciones del elemento
#   al grep-ear el XSD). e-CF-47 SI tiene Transporte pero reducido a un
#   unico campo (``PaisDestino``, semanticamente relevante ahi: pais del
#   beneficiario del pago al exterior) -- NO tiene
#   Conductor/Ficha/Placa/etc. e-CF-46 es el unico que tiene los 7 campos
#   "de transporte de carga" estandar MAS ``PaisDestino``. El resto
#   (31-34/44/45) tiene los 7 campos estandar pero SIN ``PaisDestino``.
# - info_adicional: InformacionesAdicionales existe en el esquema (ausente
#   por completo en 41/43/47, igual que Transporte).
# - descuentos_o_recargos: DescuentosORecargos existe en el esquema
#   (ausente por completo en 43/47).
# - otra_moneda_campos: conjunto de campos de OtraMoneda (de los 8 que usa
#   el Set de Pruebas real) que existen en el esquema de este tipo --
#   43/47 solo tienen 4 (TipoMoneda/TipoCambio/MontoExentoOtraMoneda/
#   MontoTotalOtraMoneda), 44 solo 3 (sin MontoTotalOtraMoneda), 46 tiene 7
#   (sin MontoExentoOtraMoneda) -- el resto tiene los 8 completos.
# - item_referencia: bloque CantidadReferencia/UnidadReferencia/
#   TablaSubcantidad/GradosAlcohol/PrecioUnitarioReferencia de Item existe
#   (solo 31/32/33/34/45 -- ausente en 41/43/44/46/47).
# - item_descuento_recargo: bloque DescuentoMonto/TablaSubDescuento/
#   RecargoMonto/TablaSubRecargo de Item existe (todos salvo 43/47, donde
#   Item va directo de PrecioUnitarioItem a OtraMonedaDetalle/MontoItem).
# - item_impuesto_adicional: Item/TablaImpuestoAdicional existe (solo
#   31/32/33/34/44/45 -- ausente en 41/43/46/47; 46 tiene en su lugar un
#   bloque Mineria no relacionado, fuera de alcance de los 347 campos).
_TRANSPORTE_ESTANDAR = frozenset({
    'Conductor', 'DocumentoTransporte', 'Ficha', 'Placa',
    'RutaTransporte', 'ZonaTransporte', 'NumeroAlbaran',
})
# NOTA: no se referencia ``_OTRA_MONEDA_FIELDS`` aqui (definido mas abajo en
# el modulo, junto a ``_INFO_ADICIONAL_FIELDS`` --
# _TIPO_CAPS se evalua primero al cargar el modulo, un forward-reference
# aqui daria NameError) -- se repite la lista literal, debe mantenerse en
# sync con ``_OTRA_MONEDA_FIELDS`` si esa cambia.
_OTRA_MONEDA_COMPLETO = frozenset({
    'TipoMoneda', 'TipoCambio', 'MontoGravadoTotalOtraMoneda',
    'MontoGravado3OtraMoneda', 'MontoExentoOtraMoneda', 'TotalITBISOtraMoneda',
    'TotalITBIS3OtraMoneda', 'MontoTotalOtraMoneda',
})

_TIPO_CAPS = {
    31: dict(fecha_venc=True, ind_nota_credito=False, tipo_ingresos=True,
             tipo_ingresos_mandatory=True, tipo_pago_mandatory=True,
             tabla_formas_pago=True, comprador='rnc_razon_mandatory',
             item_retencion='opcional', totales_completo=True,
             info_referencia_mandatory=False, transporte=_TRANSPORTE_ESTANDAR,
             info_adicional=True, descuentos_o_recargos=True,
             otra_moneda_campos=_OTRA_MONEDA_COMPLETO,
             item_referencia=True, item_descuento_recargo=True,
             item_impuesto_adicional=True),
    32: dict(fecha_venc=False, ind_nota_credito=False, tipo_ingresos=True,
             tipo_ingresos_mandatory=True, tipo_pago_mandatory=True,
             tabla_formas_pago=True, comprador='opcional',
             item_retencion='no', totales_completo=True,
             info_referencia_mandatory=False, transporte=_TRANSPORTE_ESTANDAR,
             info_adicional=True, descuentos_o_recargos=True,
             otra_moneda_campos=_OTRA_MONEDA_COMPLETO,
             item_referencia=True, item_descuento_recargo=True,
             item_impuesto_adicional=True),
    33: dict(fecha_venc=True, ind_nota_credito=False, tipo_ingresos=True,
             tipo_ingresos_mandatory=False, tipo_pago_mandatory=True,
             tabla_formas_pago=True, comprador='opcional',
             item_retencion='opcional', totales_completo=True,
             info_referencia_mandatory=True, transporte=_TRANSPORTE_ESTANDAR,
             info_adicional=True, descuentos_o_recargos=True,
             otra_moneda_campos=_OTRA_MONEDA_COMPLETO,
             item_referencia=True, item_descuento_recargo=True,
             item_impuesto_adicional=True),
    34: dict(fecha_venc=False, ind_nota_credito=True, tipo_ingresos=True,
             tipo_ingresos_mandatory=False, tipo_pago_mandatory=True,
             tabla_formas_pago=False, comprador='opcional',
             item_retencion='opcional', totales_completo=True,
             info_referencia_mandatory=True, transporte=_TRANSPORTE_ESTANDAR,
             info_adicional=True, descuentos_o_recargos=True,
             otra_moneda_campos=_OTRA_MONEDA_COMPLETO,
             item_referencia=True, item_descuento_recargo=True,
             item_impuesto_adicional=True),
    41: dict(fecha_venc=True, ind_nota_credito=False, tipo_ingresos=False,
             tipo_ingresos_mandatory=False, tipo_pago_mandatory=False,
             tabla_formas_pago=True, comprador='rnc_razon_mandatory',
             item_retencion='mandatory_indicador', totales_completo=True,
             info_referencia_mandatory=False, transporte=frozenset(),
             info_adicional=False, descuentos_o_recargos=True,
             otra_moneda_campos=_OTRA_MONEDA_COMPLETO,
             item_referencia=False, item_descuento_recargo=True,
             item_impuesto_adicional=False),
    43: dict(fecha_venc=True, ind_nota_credito=False, tipo_ingresos=False,
             tipo_ingresos_mandatory=False, tipo_pago_mandatory=False,
             tabla_formas_pago=False, comprador='ninguno',
             item_retencion='no', totales_completo=False,
             info_referencia_mandatory=False, transporte=frozenset(),
             info_adicional=False, descuentos_o_recargos=False,
             otra_moneda_campos=frozenset({
                 'TipoMoneda', 'TipoCambio', 'MontoExentoOtraMoneda',
                 'MontoTotalOtraMoneda'}),
             item_referencia=False, item_descuento_recargo=False,
             item_impuesto_adicional=False),
    44: dict(fecha_venc=True, ind_nota_credito=False, tipo_ingresos=True,
             tipo_ingresos_mandatory=True, tipo_pago_mandatory=True,
             tabla_formas_pago=True, comprador='razon_mandatory',
             item_retencion='no', totales_completo=True,
             info_referencia_mandatory=False, transporte=_TRANSPORTE_ESTANDAR,
             info_adicional=True, descuentos_o_recargos=True,
             otra_moneda_campos=frozenset({
                 'TipoMoneda', 'TipoCambio', 'MontoExentoOtraMoneda'}),
             item_referencia=False, item_descuento_recargo=True,
             item_impuesto_adicional=True),
    45: dict(fecha_venc=True, ind_nota_credito=False, tipo_ingresos=True,
             tipo_ingresos_mandatory=True, tipo_pago_mandatory=True,
             tabla_formas_pago=True, comprador='rnc_razon_mandatory',
             item_retencion='no', totales_completo=True,
             info_referencia_mandatory=False, transporte=_TRANSPORTE_ESTANDAR,
             info_adicional=True, descuentos_o_recargos=True,
             otra_moneda_campos=_OTRA_MONEDA_COMPLETO,
             item_referencia=True, item_descuento_recargo=True,
             item_impuesto_adicional=True),
    46: dict(fecha_venc=True, ind_nota_credito=False, tipo_ingresos=True,
             tipo_ingresos_mandatory=True, tipo_pago_mandatory=True,
             tabla_formas_pago=True, comprador='razon_mandatory',
             item_retencion='no', totales_completo=True,
             info_referencia_mandatory=False,
             transporte=_TRANSPORTE_ESTANDAR | {'PaisDestino'},
             info_adicional=True, descuentos_o_recargos=True,
             otra_moneda_campos=frozenset({
                 'TipoMoneda', 'TipoCambio', 'MontoGravadoTotalOtraMoneda',
                 'MontoGravado3OtraMoneda', 'TotalITBISOtraMoneda',
                 'TotalITBIS3OtraMoneda', 'MontoTotalOtraMoneda'}),
             item_referencia=False, item_descuento_recargo=True,
             item_impuesto_adicional=False),
    47: dict(fecha_venc=True, ind_nota_credito=False, tipo_ingresos=False,
             tipo_ingresos_mandatory=False, tipo_pago_mandatory=False,
             tabla_formas_pago=True, comprador='reducido',
             item_retencion='mandatory_completo', totales_completo=False,
             info_referencia_mandatory=False, transporte=frozenset({'PaisDestino'}),
             info_adicional=False, descuentos_o_recargos=False,
             otra_moneda_campos=frozenset({
                 'TipoMoneda', 'TipoCambio', 'MontoExentoOtraMoneda',
                 'MontoTotalOtraMoneda'}),
             item_referencia=False, item_descuento_recargo=False,
             item_impuesto_adicional=False),
}

# Nombres base (sin corchetes) de los 347 campos reales de
# campos-usados-set-pruebas.txt que aparecen con UN corchete
# (``Nombre[N]``). Un mismo corchete simple puede significar dos cosas
# distintas segun el campo (NOTAS.md #5) -- se distinguen por pertenencia a
# uno de estos dos conjuntos, que son disjuntos (verificado):
#
# - grupo repetido de ENCABEZADO (TablaFormasPago/FormaDePago,
#   TablaTelefonoEmisor/TelefonoEmisor, Totales/ImpuestosAdicionales/
#   ImpuestoAdicional, DescuentosORecargos/DescuentoORecargo) -- el N indica
#   la instancia del grupo repetido, NO una linea de factura.
_HEADER_REPEAT_BASE_NAMES = frozenset({
    'FormaPago', 'MontoPago', 'TelefonoEmisor',
    'TipoImpuesto', 'TasaImpuestoAdicional',
    'MontoImpuestoSelectivoConsumoEspecifico', 'MontoImpuestoSelectivoConsumoAdvalorem',
    'NumeroLineaDoR', 'TipoAjuste', 'DescripcionDescuentooRecargo', 'TipoValor',
    'MontoDescuentooRecargo', 'IndicadorFacturacionDescuentooRecargo',
})

# - campo de LINEA/ITEM (DetallesItems/Item) -- el N es el numero de linea
#   (hasta 16 en el Set de Pruebas real).
_ITEM_BASE_NAMES = frozenset({
    'NumeroLinea', 'IndicadorFacturacion', 'IndicadorAgenteRetencionoPercepcion',
    'MontoITBISRetenido', 'MontoISRRetenido', 'NombreItem', 'IndicadorBienoServicio',
    'CantidadItem', 'UnidadMedida', 'CantidadReferencia', 'UnidadReferencia',
    'GradosAlcohol', 'PrecioUnitarioReferencia', 'PrecioUnitarioItem', 'DescuentoMonto',
    'RecargoMonto', 'PrecioOtraMoneda', 'MontoItemOtraMoneda', 'MontoItem',
})

# Campos con DOS corchetes (``Nombre[LineaN][SubM]``) siempre pertenecen a
# un sub-grupo repetido DENTRO de la linea N de Item -- no hace falta un
# conjunto de nombres para distinguirlos (a diferencia de los de 1
# corchete), la profundidad ya lo dice todo. El typo real de fabrica
# ``MontosubRecargo`` (con "s" minuscula, columna real del Excel oficial,
# NO ``MontoSubRecargo``) se traduce al nombre correcto del elemento XSD en
# ``_gen_detalles_items``.

_CAMPO_RE = re.compile(r'^([^\[\]]+)(?:\[(\d+)\])?(?:\[(\d+)\])?$')

_INFO_ADICIONAL_FIELDS = (
    'FechaEmbarque', 'NumeroEmbarque', 'NumeroContenedor', 'NumeroReferencia',
    'PesoBruto', 'PesoNeto', 'UnidadPesoBruto', 'UnidadPesoNeto',
    'CantidadBulto', 'UnidadBulto', 'VolumenBulto', 'UnidadVolumen',
)
_OTRA_MONEDA_FIELDS = (
    'TipoMoneda', 'TipoCambio', 'MontoGravadoTotalOtraMoneda',
    'MontoGravado3OtraMoneda', 'MontoExentoOtraMoneda', 'TotalITBISOtraMoneda',
    'TotalITBIS3OtraMoneda', 'MontoTotalOtraMoneda',
)
# Verifica que la copia literal ``_OTRA_MONEDA_COMPLETO`` (definida arriba,
# junto a ``_TIPO_CAPS``, por el forward-reference explicado ahi) no se
# haya desincronizado de esta lista -- si alguien agrega/quita un campo de
# ``_OTRA_MONEDA_FIELDS`` sin actualizar la otra, esto falla fuerte al
# importar el modulo en vez de dejar un bug silencioso.
assert _OTRA_MONEDA_COMPLETO == frozenset(_OTRA_MONEDA_FIELDS), (
    '_OTRA_MONEDA_COMPLETO desincronizado de _OTRA_MONEDA_FIELDS')

_ENCF_RE = re.compile(r'^[A-Za-z0-9]{13}$')


def _es_vacio(valor) -> bool:
    """``#e`` es el valor que usa el Excel del Set de Pruebas para "campo
    vacio / no aplica" (NOTAS.md #4 y placeholder de ``fe-modo-test.tsx``)
    -- se trata igual que ``None``, no como texto literal."""
    if valor is None:
        return True
    if isinstance(valor, str) and valor.strip() in ('', '#e'):
        return True
    return False


def _valor_texto(valor, monetario: bool = False):
    """Convierte un valor del payload JSON a texto para el XML.

    El operador pega el valor EXACTO de la celda del Excel (ya formateado
    segun el patron del XSD, ej. fechas ``dd-mm-aaaa`` como texto) -- este
    builder NO reformatea strings, para no corromper un valor que ya viene
    correcto (ver advertencia del modulo sobre no inventar estructura).
    La unica excepcion es si el operador pego un numero JSON crudo (ej.
    ``"MontoTotal": 1180`` en vez de ``"1180.00"``) para un campo monetario
    -- ahi si se formatea con ``_fmt_monto`` para garantizar el patron
    Decimal18D1or2 exigido por el XSD.
    """
    if valor is None:
        return None
    if isinstance(valor, bool):
        return str(valor)
    if monetario and isinstance(valor, (int, float)):
        return _fmt_monto(valor)
    return str(valor).strip()


def _parse_datos_planos(datos: dict) -> dict:
    """Convierte el dict plano con notacion de corchetes (columnas del
    Excel del Set de Pruebas) en una estructura anidada por profundidad,
    ver NOTAS.md #5 para el esquema completo:

    - ``simple``: ``{nombre_base: valor}`` -- campos de encabezado sin
      corchete (``RNCEmisor``, ``FechaEmision``, ``MontoTotal``, etc).
    - ``idx1_header``: ``{nombre_base: {n: valor}}`` -- grupos repetidos de
      encabezado con 1 corchete (``FormaPago[1]``, ``TelefonoEmisor[2]``).
    - ``idx1_item``: ``{nombre_base: {n: valor}}`` -- campos de linea/item
      con 1 corchete (``NumeroLinea[1]``, ``MontoItem[3]``).
    - ``idx2``: ``{n: {nombre_base: {m: valor}}}`` -- sub-grupos DENTRO de
      la linea n con 2 corchetes (``TipoCodigo[1][1]``).

    ``CasoPrueba``/``ENCF``/``TipoeCF``/``Version`` se ignoran aqui aunque
    el operador los haya copiado tal cual del Excel dentro de ``datos`` --
    ``TipoeCF``/``ENCF`` ya vienen por parametro explicito de
    ``construir_ecf_generico`` (fuente de verdad, NOTAS.md #5 al final) y
    ``Version`` es fija ``"1.0"``. Cualquier nombre de campo con 1 corchete
    que no pertenezca a ``_HEADER_REPEAT_BASE_NAMES`` ni a
    ``_ITEM_BASE_NAMES`` se ignora en silencio -- no forma parte de los 347
    campos reales del Set de Pruebas (``campos-usados-set-pruebas.txt``) y
    no hace falta soportar el resto de las ~5215 columnas teoricas
    (NOTAS.md #5).
    """
    simple: dict = {}
    idx1_header: dict = {}
    idx1_item: dict = {}
    idx2: dict = {}
    for clave_bruta, valor in (datos or {}).items():
        if _es_vacio(valor):
            continue
        clave = str(clave_bruta).strip()
        if clave in ('CasoPrueba', 'ENCF', 'TipoeCF', 'Version'):
            continue
        m = _CAMPO_RE.match(clave)
        if not m:
            continue
        base, n1, n2 = m.group(1).strip(), m.group(2), m.group(3)
        if n2 is not None:
            idx2.setdefault(int(n1), {}).setdefault(base, {})[int(n2)] = valor
        elif n1 is not None:
            if base in _ITEM_BASE_NAMES:
                idx1_item.setdefault(base, {})[int(n1)] = valor
            elif base in _HEADER_REPEAT_BASE_NAMES:
                idx1_header.setdefault(base, {})[int(n1)] = valor
            # nombre con 1 corchete no reconocido -- fuera de los 347
            # campos reales, se ignora (ver docstring).
        else:
            simple[base] = valor
    return {'simple': simple, 'idx1_header': idx1_header,
            'idx1_item': idx1_item, 'idx2': idx2}


def _emitir_subgrupo(tabla_el, tag_instancia: str, subs: dict, campos: list):
    """Emite un sub-grupo repetido DENTRO de una linea de Item (2do
    corchete), ej. ``TablaCodigosItem/CodigosItem``.

    ``subs`` es ``idx2[n]`` (``{nombre_base: {m: valor}}``) para la linea
    ``n`` en curso. ``campos`` es una lista de
    ``(nombre_base_en_datos, tag_xsd, monetario)`` en el orden real del
    XSD -- recorre todos los indices ``m`` presentes en cualquiera de esos
    campos y emite una instancia de ``tag_instancia`` por cada uno.
    """
    indices = set()
    for base, _tag, _mon in campos:
        indices.update((subs.get(base) or {}).keys())
    for m in sorted(indices):
        el = _sub(tabla_el, tag_instancia)
        for base, tag, monetario in campos:
            valor = (subs.get(base) or {}).get(m)
            if valor is not None:
                _sub(el, tag, _valor_texto(valor, monetario=monetario))


def _gen_id_doc(id_doc, tipo_ecf: int, e_ncf: str, caps: dict, simple: dict,
                idx1_header: dict) -> None:
    _sub(id_doc, 'TipoeCF', tipo_ecf)
    _sub(id_doc, 'eNCF', e_ncf)
    if caps['fecha_venc']:
        v = simple.get('FechaVencimientoSecuencia')
        if not v:
            raise ECFBuilderError(
                f"IdDoc/FechaVencimientoSecuencia es obligatorio (minOccurs=1) "
                f"para TipoeCF {tipo_ecf} segun e-CF-{tipo_ecf}-v1.0.xsd; falta "
                "en 'datos' (columna FechaVencimientoSecuencia del Excel)")
        _sub(id_doc, 'FechaVencimientoSecuencia', _valor_texto(v))
    if caps['ind_nota_credito']:
        v = simple.get('IndicadorNotaCredito')
        if _es_vacio(v):
            raise ECFBuilderError(
                "IdDoc/IndicadorNotaCredito es obligatorio (minOccurs=1) para "
                "TipoeCF 34 segun e-CF-34-v1.0.xsd; falta en 'datos'")
        _sub(id_doc, 'IndicadorNotaCredito', _valor_texto(v))
    if 'IndicadorMontoGravado' in simple:
        _sub(id_doc, 'IndicadorMontoGravado', _valor_texto(simple['IndicadorMontoGravado']))
    if caps['tipo_ingresos']:
        tipo_ingresos = simple.get('TipoIngresos')
        if caps['tipo_ingresos_mandatory'] and _es_vacio(tipo_ingresos):
            raise ECFBuilderError(
                f"IdDoc/TipoIngresos es obligatorio (minOccurs=1) para TipoeCF "
                f"{tipo_ecf} segun e-CF-{tipo_ecf}-v1.0.xsd; falta en 'datos'")
        if not _es_vacio(tipo_ingresos):
            _sub(id_doc, 'TipoIngresos', _valor_texto(tipo_ingresos))
    tipo_pago = simple.get('TipoPago')
    if caps['tipo_pago_mandatory'] and _es_vacio(tipo_pago):
        raise ECFBuilderError(
            f"IdDoc/TipoPago es obligatorio (minOccurs=1) para TipoeCF "
            f"{tipo_ecf}; falta en 'datos'")
    if not _es_vacio(tipo_pago):
        _sub(id_doc, 'TipoPago', _valor_texto(tipo_pago))
    if simple.get('TerminoPago'):
        _sub(id_doc, 'TerminoPago', _valor_texto(simple['TerminoPago']))
    if caps['tabla_formas_pago'] and idx1_header.get('FormaPago'):
        tabla = _sub(id_doc, 'TablaFormasPago')
        for n in sorted(idx1_header['FormaPago']):
            monto = idx1_header.get('MontoPago', {}).get(n)
            if monto is None:
                raise ECFBuilderError(
                    f"IdDoc/TablaFormasPago/FormaDePago[{n}] tiene FormaPago[{n}] "
                    f"pero no MontoPago[{n}] (ambos minOccurs=1 dentro de "
                    "FormaDePago)")
            fdp = _sub(tabla, 'FormaDePago')
            _sub(fdp, 'FormaPago', _valor_texto(idx1_header['FormaPago'][n]))
            _sub(fdp, 'MontoPago', _valor_texto(monto, monetario=True))
    if simple.get('NumeroCuentaPago'):
        _sub(id_doc, 'NumeroCuentaPago', _valor_texto(simple['NumeroCuentaPago']))
    if simple.get('BancoPago'):
        _sub(id_doc, 'BancoPago', _valor_texto(simple['BancoPago']))


def _gen_emisor(emisor, simple: dict, idx1_header: dict) -> None:
    rnc = _solo_digitos(simple.get('RNCEmisor'))
    if not _rnc_valido(rnc):
        raise ECFBuilderError(
            f"Emisor/RNCEmisor invalido o ausente en 'datos': "
            f"{simple.get('RNCEmisor')!r} (debe tener 9 u 11 digitos, minOccurs=1)")
    _sub(emisor, 'RNCEmisor', rnc)
    razon = _valor_texto(simple.get('RazonSocialEmisor')) or ''
    if not razon:
        raise ECFBuilderError(
            "Emisor/RazonSocialEmisor es obligatorio (minOccurs=1); falta en 'datos'")
    _sub(emisor, 'RazonSocialEmisor', razon[:150])
    if simple.get('NombreComercial'):
        _sub(emisor, 'NombreComercial', _valor_texto(simple['NombreComercial'])[:150])
    direccion = _valor_texto(simple.get('DireccionEmisor')) or ''
    if not direccion:
        raise ECFBuilderError(
            "Emisor/DireccionEmisor es obligatorio (minOccurs=1); falta en 'datos'")
    _sub(emisor, 'DireccionEmisor', direccion[:100])
    if simple.get('Municipio'):
        _sub(emisor, 'Municipio', _valor_texto(simple['Municipio']))
    if simple.get('Provincia'):
        _sub(emisor, 'Provincia', _valor_texto(simple['Provincia']))
    if idx1_header.get('TelefonoEmisor'):
        tabla = _sub(emisor, 'TablaTelefonoEmisor')
        for n in sorted(idx1_header['TelefonoEmisor']):
            _sub(tabla, 'TelefonoEmisor', _valor_texto(idx1_header['TelefonoEmisor'][n]))
    if simple.get('CorreoEmisor'):
        _sub(emisor, 'CorreoEmisor', _valor_texto(simple['CorreoEmisor']))
    if simple.get('WebSite'):
        _sub(emisor, 'WebSite', _valor_texto(simple['WebSite']))
    if simple.get('CodigoVendedor'):
        _sub(emisor, 'CodigoVendedor', _valor_texto(simple['CodigoVendedor']))
    if simple.get('NumeroFacturaInterna'):
        _sub(emisor, 'NumeroFacturaInterna', _valor_texto(simple['NumeroFacturaInterna']))
    if simple.get('NumeroPedidoInterno') is not None:
        _sub(emisor, 'NumeroPedidoInterno', _valor_texto(simple['NumeroPedidoInterno']))
    if simple.get('ZonaVenta'):
        _sub(emisor, 'ZonaVenta', _valor_texto(simple['ZonaVenta']))
    fecha_emision = simple.get('FechaEmision')
    if not fecha_emision:
        raise ECFBuilderError(
            "Emisor/FechaEmision es obligatorio (minOccurs=1); falta en 'datos'")
    _sub(emisor, 'FechaEmision', _valor_texto(fecha_emision))


def _gen_comprador(comprador, tipo_ecf: int, caps: dict, simple: dict) -> None:
    modo = caps['comprador']
    rnc = _solo_digitos(simple.get('RNCComprador'))
    razon = _valor_texto(simple.get('RazonSocialComprador')) or ''
    if modo == 'reducido':
        # e-CF-47: Comprador SOLO tiene IdentificadorExtranjero +
        # RazonSocialComprador -- NO existe RNCComprador en este esquema
        # (confirmado leyendo e-CF-47-v1.0.xsd), a diferencia de todos los
        # demas tipos.
        if simple.get('IdentificadorExtranjero'):
            _sub(comprador, 'IdentificadorExtranjero',
                 _valor_texto(simple['IdentificadorExtranjero'])[:20])
        if razon:
            _sub(comprador, 'RazonSocialComprador', razon[:150])
        return
    if modo == 'rnc_razon_mandatory' and not _rnc_valido(rnc):
        raise ECFBuilderError(
            f"e-CF {tipo_ecf}: Comprador/RNCComprador es obligatorio (9 u 11 "
            f"digitos, minOccurs=1); 'datos' tiene {simple.get('RNCComprador')!r}")
    if modo in ('rnc_razon_mandatory', 'razon_mandatory') and not razon:
        raise ECFBuilderError(
            f"e-CF {tipo_ecf}: Comprador/RazonSocialComprador es obligatorio "
            "(minOccurs=1); falta en 'datos'")
    if _rnc_valido(rnc):
        _sub(comprador, 'RNCComprador', rnc)
    # e-CF-41-v1.0.xsd no tiene IdentificadorExtranjero/FechaEntrega/
    # TelefonoAdicional/FechaOrdenCompra/NumeroOrdenCompra en Comprador
    # (confirmado leyendo el XSD); el resto de tipos si.
    if tipo_ecf != 41 and simple.get('IdentificadorExtranjero'):
        _sub(comprador, 'IdentificadorExtranjero',
             _valor_texto(simple['IdentificadorExtranjero'])[:20])
    if razon:
        _sub(comprador, 'RazonSocialComprador', razon[:150])
    if simple.get('ContactoComprador'):
        _sub(comprador, 'ContactoComprador', _valor_texto(simple['ContactoComprador']))
    if simple.get('CorreoComprador'):
        _sub(comprador, 'CorreoComprador', _valor_texto(simple['CorreoComprador']))
    if simple.get('DireccionComprador'):
        _sub(comprador, 'DireccionComprador', _valor_texto(simple['DireccionComprador'])[:100])
    if simple.get('MunicipioComprador'):
        _sub(comprador, 'MunicipioComprador', _valor_texto(simple['MunicipioComprador']))
    if simple.get('ProvinciaComprador'):
        _sub(comprador, 'ProvinciaComprador', _valor_texto(simple['ProvinciaComprador']))
    if tipo_ecf != 41 and simple.get('FechaEntrega'):
        _sub(comprador, 'FechaEntrega', _valor_texto(simple['FechaEntrega']))
    if tipo_ecf != 41 and simple.get('TelefonoAdicional'):
        _sub(comprador, 'TelefonoAdicional', _valor_texto(simple['TelefonoAdicional']))
    if tipo_ecf != 41 and simple.get('FechaOrdenCompra'):
        _sub(comprador, 'FechaOrdenCompra', _valor_texto(simple['FechaOrdenCompra']))
    if tipo_ecf != 41 and simple.get('NumeroOrdenCompra'):
        _sub(comprador, 'NumeroOrdenCompra', _valor_texto(simple['NumeroOrdenCompra']))
    if simple.get('CodigoInternoComprador'):
        _sub(comprador, 'CodigoInternoComprador', _valor_texto(simple['CodigoInternoComprador']))


def _gen_informaciones_adicionales(info_ad, simple: dict) -> None:
    for campo in ('FechaEmbarque', 'NumeroEmbarque', 'NumeroContenedor', 'NumeroReferencia'):
        if simple.get(campo):
            _sub(info_ad, campo, _valor_texto(simple[campo]))
    for campo in ('PesoBruto', 'PesoNeto'):
        if simple.get(campo) is not None:
            _sub(info_ad, campo, _valor_texto(simple[campo], monetario=True))
    for campo in ('UnidadPesoBruto', 'UnidadPesoNeto'):
        if simple.get(campo):
            _sub(info_ad, campo, _valor_texto(simple[campo]))
    if simple.get('CantidadBulto') is not None:
        _sub(info_ad, 'CantidadBulto', _valor_texto(simple['CantidadBulto'], monetario=True))
    if simple.get('UnidadBulto'):
        _sub(info_ad, 'UnidadBulto', _valor_texto(simple['UnidadBulto']))
    if simple.get('VolumenBulto') is not None:
        _sub(info_ad, 'VolumenBulto', _valor_texto(simple['VolumenBulto'], monetario=True))
    if simple.get('UnidadVolumen'):
        _sub(info_ad, 'UnidadVolumen', _valor_texto(simple['UnidadVolumen']))


def _gen_transporte(transporte, caps: dict, simple: dict) -> None:
    """Emite solo los campos de Transporte que ``caps['transporte']``
    permite para este tipo (ver comentario de ``_TIPO_CAPS``) -- e-CF-46 es
    el unico con ``PaisDestino`` MAS los 7 campos estandar; e-CF-47 SOLO
    tiene ``PaisDestino`` (sin Conductor/Ficha/Placa/etc, a diferencia de
    lo que se asumia antes de este fix); el resto de los tipos que tienen
    Transporte (31-34/44/45) tienen los 7 campos estandar SIN
    ``PaisDestino``. ``construir_ecf_generico`` ya se asegura de no llamar
    a esta funcion en absoluto para 41/43 (``caps['transporte']`` vacio ->
    el elemento Transporte no existe en esos dos esquemas)."""
    permitidos = caps['transporte']
    if 'PaisDestino' in permitidos and simple.get('PaisDestino'):
        _sub(transporte, 'PaisDestino', _valor_texto(simple['PaisDestino']))
    for campo in ('Conductor', 'DocumentoTransporte', 'Ficha', 'Placa',
                  'RutaTransporte', 'ZonaTransporte', 'NumeroAlbaran'):
        if campo in permitidos and simple.get(campo):
            _sub(transporte, campo, _valor_texto(simple[campo]))


def _gen_totales(totales, tipo_ecf: int, caps: dict, simple: dict, idx1_header: dict) -> None:
    completo = caps['totales_completo']
    if completo:
        for campo in ('MontoGravadoTotal', 'MontoGravadoI1', 'MontoGravadoI2', 'MontoGravadoI3'):
            if simple.get(campo) is not None:
                _sub(totales, campo, _valor_texto(simple[campo], monetario=True))
    if simple.get('MontoExento') is not None:
        _sub(totales, 'MontoExento', _valor_texto(simple['MontoExento'], monetario=True))
    if completo:
        for campo in ('ITBIS1', 'ITBIS2', 'ITBIS3'):
            if simple.get(campo) is not None:
                _sub(totales, campo, _valor_texto(simple[campo]))
        for campo in ('TotalITBIS', 'TotalITBIS1', 'TotalITBIS2', 'TotalITBIS3'):
            if simple.get(campo) is not None:
                _sub(totales, campo, _valor_texto(simple[campo], monetario=True))
        if simple.get('MontoImpuestoAdicional') is not None:
            _sub(totales, 'MontoImpuestoAdicional',
                 _valor_texto(simple['MontoImpuestoAdicional'], monetario=True))
        if idx1_header.get('TipoImpuesto'):
            grupo = _sub(totales, 'ImpuestosAdicionales')
            for n in sorted(idx1_header['TipoImpuesto']):
                tasa = idx1_header.get('TasaImpuestoAdicional', {}).get(n)
                if tasa is None:
                    raise ECFBuilderError(
                        f"Totales/ImpuestosAdicionales/ImpuestoAdicional[{n}] "
                        f"tiene TipoImpuesto[{n}] pero no TasaImpuestoAdicional[{n}] "
                        "(ambos minOccurs=1 dentro de ImpuestoAdicional)")
                item = _sub(grupo, 'ImpuestoAdicional')
                _sub(item, 'TipoImpuesto', _valor_texto(idx1_header['TipoImpuesto'][n]))
                _sub(item, 'TasaImpuestoAdicional', _valor_texto(tasa, monetario=True))
                esp = idx1_header.get('MontoImpuestoSelectivoConsumoEspecifico', {}).get(n)
                if esp is not None:
                    _sub(item, 'MontoImpuestoSelectivoConsumoEspecifico',
                         _valor_texto(esp, monetario=True))
                adv = idx1_header.get('MontoImpuestoSelectivoConsumoAdvalorem', {}).get(n)
                if adv is not None:
                    _sub(item, 'MontoImpuestoSelectivoConsumoAdvalorem',
                         _valor_texto(adv, monetario=True))
    monto_total = simple.get('MontoTotal')
    if _es_vacio(monto_total):
        raise ECFBuilderError(
            "Totales/MontoTotal es obligatorio (minOccurs=1); falta en 'datos'")
    _sub(totales, 'MontoTotal', _valor_texto(monto_total, monetario=True))
    if simple.get('MontoPeriodo') is not None:
        _sub(totales, 'MontoPeriodo', _valor_texto(simple['MontoPeriodo'], monetario=True))
    if simple.get('ValorPagar') is not None:
        _sub(totales, 'ValorPagar', _valor_texto(simple['ValorPagar'], monetario=True))
    if simple.get('TotalITBISRetenido') is not None:
        _sub(totales, 'TotalITBISRetenido',
             _valor_texto(simple['TotalITBISRetenido'], monetario=True))
    if simple.get('TotalISRRetencion') is not None:
        _sub(totales, 'TotalISRRetencion',
             _valor_texto(simple['TotalISRRetencion'], monetario=True))


def _gen_otra_moneda(otra, caps: dict, simple: dict) -> None:
    """Emite solo los campos de OtraMoneda que ``caps['otra_moneda_campos']``
    permite para este tipo -- el conjunto varia de verdad (43/47 solo tienen
    4 de los 8 campos que usa el Set de Pruebas real, 44 solo 3, 46 tiene 7
    sin ``MontoExentoOtraMoneda``; ver comentario de ``_TIPO_CAPS``)."""
    permitidos = caps['otra_moneda_campos']
    if 'TipoMoneda' in permitidos and simple.get('TipoMoneda'):
        _sub(otra, 'TipoMoneda', _valor_texto(simple['TipoMoneda']))
    if 'TipoCambio' in permitidos and simple.get('TipoCambio') is not None:
        _sub(otra, 'TipoCambio', _valor_texto(simple['TipoCambio'], monetario=True))
    for campo in ('MontoGravadoTotalOtraMoneda', 'MontoGravado3OtraMoneda',
                  'MontoExentoOtraMoneda', 'TotalITBISOtraMoneda',
                  'TotalITBIS3OtraMoneda', 'MontoTotalOtraMoneda'):
        if campo in permitidos and simple.get(campo) is not None:
            _sub(otra, campo, _valor_texto(simple[campo], monetario=True))


def _gen_detalles_items(ecf, tipo_ecf: int, caps: dict, idx1_item: dict, idx2: dict) -> None:
    numeros = sorted(idx1_item.get('NumeroLinea', {}).keys())
    if not numeros:
        raise ECFBuilderError(
            "DetallesItems/Item no tiene ninguna linea -- 'datos' debe incluir "
            "al menos NumeroLinea[1], IndicadorFacturacion[1], NombreItem[1], "
            "IndicadorBienoServicio[1], CantidadItem[1], PrecioUnitarioItem[1] "
            "y MontoItem[1]")
    detalles = _sub(ecf, 'DetallesItems')
    for n in numeros:
        item = _sub(detalles, 'Item')
        _sub(item, 'NumeroLinea', _valor_texto(idx1_item['NumeroLinea'][n]))
        subs = idx2.get(n, {})
        if subs.get('TipoCodigo') or subs.get('CodigoItem'):
            tabla = _sub(item, 'TablaCodigosItem')
            _emitir_subgrupo(tabla, 'CodigosItem', subs,
                             [('TipoCodigo', 'TipoCodigo', False),
                              ('CodigoItem', 'CodigoItem', False)])
        indicador_fact = idx1_item.get('IndicadorFacturacion', {}).get(n)
        if indicador_fact is None:
            raise ECFBuilderError(
                f"Item[{n}] no tiene IndicadorFacturacion[{n}] (minOccurs=1)")
        _sub(item, 'IndicadorFacturacion', _valor_texto(indicador_fact))
        if caps['item_retencion'] != 'no':
            ind_ret = idx1_item.get('IndicadorAgenteRetencionoPercepcion', {}).get(n)
            monto_itbis_ret = (idx1_item.get('MontoITBISRetenido', {}).get(n)
                                if caps['item_retencion'] != 'mandatory_completo' else None)
            monto_isr_ret = idx1_item.get('MontoISRRetenido', {}).get(n)
            if (caps['item_retencion'] in ('mandatory_indicador', 'mandatory_completo')
                    and ind_ret is None):
                raise ECFBuilderError(
                    f"e-CF {tipo_ecf} Item[{n}]: Retencion/"
                    "IndicadorAgenteRetencionoPercepcion es obligatorio "
                    f"(minOccurs=1) para este tipo; falta "
                    f"IndicadorAgenteRetencionoPercepcion[{n}] en 'datos'")
            if caps['item_retencion'] == 'mandatory_completo' and monto_isr_ret is None:
                raise ECFBuilderError(
                    f"e-CF 47 Item[{n}]: Retencion/MontoISRRetenido es "
                    f"obligatorio (minOccurs=1); falta MontoISRRetenido[{n}] "
                    "en 'datos'")
            if ind_ret is not None or monto_itbis_ret is not None or monto_isr_ret is not None:
                ret = _sub(item, 'Retencion')
                if ind_ret is not None:
                    _sub(ret, 'IndicadorAgenteRetencionoPercepcion', _valor_texto(ind_ret))
                if monto_itbis_ret is not None:
                    _sub(ret, 'MontoITBISRetenido', _valor_texto(monto_itbis_ret, monetario=True))
                if monto_isr_ret is not None:
                    _sub(ret, 'MontoISRRetenido', _valor_texto(monto_isr_ret, monetario=True))
        nombre = idx1_item.get('NombreItem', {}).get(n)
        if not nombre:
            raise ECFBuilderError(f"Item[{n}] no tiene NombreItem[{n}] (minOccurs=1)")
        _sub(item, 'NombreItem', _valor_texto(nombre)[:80])
        ind_bien = idx1_item.get('IndicadorBienoServicio', {}).get(n)
        if ind_bien is None:
            raise ECFBuilderError(
                f"Item[{n}] no tiene IndicadorBienoServicio[{n}] (minOccurs=1)")
        _sub(item, 'IndicadorBienoServicio', _valor_texto(ind_bien))
        cantidad = idx1_item.get('CantidadItem', {}).get(n)
        if cantidad is None:
            raise ECFBuilderError(f"Item[{n}] no tiene CantidadItem[{n}] (minOccurs=1)")
        _sub(item, 'CantidadItem', _valor_texto(cantidad, monetario=True))
        if idx1_item.get('UnidadMedida', {}).get(n) is not None:
            _sub(item, 'UnidadMedida', _valor_texto(idx1_item['UnidadMedida'][n]))
        # Bloque CantidadReferencia/UnidadReferencia/TablaSubcantidad/
        # GradosAlcohol/PrecioUnitarioReferencia -- SOLO existe en
        # 31/32/33/34/45 (``caps['item_referencia']``); ausente por completo
        # en 41/43/44/46/47 (confirmado leyendo los 10 XSD reales).
        if caps['item_referencia']:
            if idx1_item.get('CantidadReferencia', {}).get(n) is not None:
                _sub(item, 'CantidadReferencia',
                     _valor_texto(idx1_item['CantidadReferencia'][n], monetario=True))
            if idx1_item.get('UnidadReferencia', {}).get(n) is not None:
                _sub(item, 'UnidadReferencia', _valor_texto(idx1_item['UnidadReferencia'][n]))
            if subs.get('Subcantidad') or subs.get('CodigoSubcantidad'):
                tabla = _sub(item, 'TablaSubcantidad')
                _emitir_subgrupo(tabla, 'SubcantidadItem', subs,
                                 [('Subcantidad', 'Subcantidad', True),
                                  ('CodigoSubcantidad', 'CodigoSubcantidad', False)])
            if idx1_item.get('GradosAlcohol', {}).get(n) is not None:
                _sub(item, 'GradosAlcohol',
                     _valor_texto(idx1_item['GradosAlcohol'][n], monetario=True))
            if idx1_item.get('PrecioUnitarioReferencia', {}).get(n) is not None:
                _sub(item, 'PrecioUnitarioReferencia',
                     _valor_texto(idx1_item['PrecioUnitarioReferencia'][n], monetario=True))
        precio = idx1_item.get('PrecioUnitarioItem', {}).get(n)
        if precio is None:
            raise ECFBuilderError(f"Item[{n}] no tiene PrecioUnitarioItem[{n}] (minOccurs=1)")
        _sub(item, 'PrecioUnitarioItem', _valor_texto(precio, monetario=True))
        # Bloque DescuentoMonto/TablaSubDescuento/RecargoMonto/
        # TablaSubRecargo -- ausente por completo en 43/47
        # (``caps['item_descuento_recargo']``), presente en todos los demas.
        if caps['item_descuento_recargo']:
            if idx1_item.get('DescuentoMonto', {}).get(n) is not None:
                _sub(item, 'DescuentoMonto',
                     _valor_texto(idx1_item['DescuentoMonto'][n], monetario=True))
            if subs.get('TipoSubDescuento') or subs.get('SubDescuentoPorcentaje') or subs.get('MontoSubDescuento'):
                tabla = _sub(item, 'TablaSubDescuento')
                _emitir_subgrupo(tabla, 'SubDescuento', subs,
                                 [('TipoSubDescuento', 'TipoSubDescuento', False),
                                  ('SubDescuentoPorcentaje', 'SubDescuentoPorcentaje', True),
                                  ('MontoSubDescuento', 'MontoSubDescuento', True)])
            if idx1_item.get('RecargoMonto', {}).get(n) is not None:
                _sub(item, 'RecargoMonto',
                     _valor_texto(idx1_item['RecargoMonto'][n], monetario=True))
            if subs.get('TipoSubRecargo') or subs.get('SubRecargoPorcentaje') or subs.get('MontosubRecargo'):
                tabla = _sub(item, 'TablaSubRecargo')
                _emitir_subgrupo(tabla, 'SubRecargo', subs,
                                 [('TipoSubRecargo', 'TipoSubRecargo', False),
                                  ('SubRecargoPorcentaje', 'SubRecargoPorcentaje', True),
                                  # 'MontosubRecargo' (s minuscula) es el nombre REAL
                                  # de la columna en el Excel oficial del Set de
                                  # Pruebas (typo de fabrica) -- el elemento
                                  # correcto de e-CF-*-v1.0.xsd es 'MontoSubRecargo'.
                                  ('MontosubRecargo', 'MontoSubRecargo', True)])
        # TablaImpuestoAdicional (item) -- SOLO 31/32/33/34/44/45
        # (``caps['item_impuesto_adicional']``); ausente en 41/43/46/47 (46
        # tiene en su lugar un bloque Mineria no relacionado y fuera de
        # alcance de los 347 campos reales).
        if caps['item_impuesto_adicional'] and subs.get('TipoImpuesto'):
            tabla = _sub(item, 'TablaImpuestoAdicional')
            _emitir_subgrupo(tabla, 'ImpuestoAdicional', subs,
                             [('TipoImpuesto', 'TipoImpuesto', False)])
        precio_otra = idx1_item.get('PrecioOtraMoneda', {}).get(n)
        monto_otra = idx1_item.get('MontoItemOtraMoneda', {}).get(n)
        if precio_otra is not None or monto_otra is not None:
            otra = _sub(item, 'OtraMonedaDetalle')
            if precio_otra is not None:
                _sub(otra, 'PrecioOtraMoneda', _valor_texto(precio_otra, monetario=True))
            if monto_otra is not None:
                _sub(otra, 'MontoItemOtraMoneda', _valor_texto(monto_otra, monetario=True))
        monto_item = idx1_item.get('MontoItem', {}).get(n)
        if monto_item is None:
            raise ECFBuilderError(f"Item[{n}] no tiene MontoItem[{n}] (minOccurs=1)")
        _sub(item, 'MontoItem', _valor_texto(monto_item, monetario=True))


def _gen_descuentos_o_recargos(ecf, idx1_header: dict) -> None:
    dor = _sub(ecf, 'DescuentosORecargos')
    for n in sorted(idx1_header.get('NumeroLineaDoR', {}).keys()):
        tipo_ajuste = idx1_header.get('TipoAjuste', {}).get(n)
        if tipo_ajuste is None:
            raise ECFBuilderError(
                f"DescuentosORecargos/DescuentoORecargo[{n}] no tiene "
                f"TipoAjuste[{n}] (minOccurs=1 dentro de DescuentoORecargo)")
        el = _sub(dor, 'DescuentoORecargo')
        _sub(el, 'NumeroLinea', _valor_texto(idx1_header['NumeroLineaDoR'][n]))
        _sub(el, 'TipoAjuste', _valor_texto(tipo_ajuste))
        if idx1_header.get('DescripcionDescuentooRecargo', {}).get(n) is not None:
            _sub(el, 'DescripcionDescuentooRecargo',
                 _valor_texto(idx1_header['DescripcionDescuentooRecargo'][n]))
        if idx1_header.get('TipoValor', {}).get(n) is not None:
            _sub(el, 'TipoValor', _valor_texto(idx1_header['TipoValor'][n]))
        if idx1_header.get('MontoDescuentooRecargo', {}).get(n) is not None:
            _sub(el, 'MontoDescuentooRecargo',
                 _valor_texto(idx1_header['MontoDescuentooRecargo'][n], monetario=True))
        if idx1_header.get('IndicadorFacturacionDescuentooRecargo', {}).get(n) is not None:
            _sub(el, 'IndicadorFacturacionDescuentooRecargo',
                 _valor_texto(idx1_header['IndicadorFacturacionDescuentooRecargo'][n]))


def _gen_informacion_referencia(ecf, tipo_ecf: int, caps: dict, simple: dict) -> None:
    ncf_mod = simple.get('NCFModificado')
    fecha_mod = simple.get('FechaNCFModificado')
    cod_mod = simple.get('CodigoModificacion')
    if caps['info_referencia_mandatory'] and (
            _es_vacio(ncf_mod) or _es_vacio(fecha_mod) or _es_vacio(cod_mod)):
        raise ECFBuilderError(
            f"e-CF {tipo_ecf}: InformacionReferencia/NCFModificado+"
            "FechaNCFModificado+CodigoModificacion son obligatorios "
            "(minOccurs=1, referencian el NCF que este documento modifica); "
            "falta alguno en 'datos'")
    info = _sub(ecf, 'InformacionReferencia')
    if not _es_vacio(ncf_mod):
        _sub(info, 'NCFModificado', _valor_texto(ncf_mod))
    if simple.get('RNCOtroContribuyente'):
        _sub(info, 'RNCOtroContribuyente', _solo_digitos(simple['RNCOtroContribuyente']))
    if not _es_vacio(fecha_mod):
        _sub(info, 'FechaNCFModificado', _valor_texto(fecha_mod))
    if not _es_vacio(cod_mod):
        _sub(info, 'CodigoModificacion', _valor_texto(cod_mod))
    if tipo_ecf in (33, 34) and simple.get('RazonModificacion'):
        _sub(info, 'RazonModificacion', _valor_texto(simple['RazonModificacion'])[:90])


def construir_ecf_generico(tipo_ecf: int, e_ncf: str, datos: dict) -> str:
    """Arma el e-CF "sin firmar" de CUALQUIERA de los 10 tipos directo desde
    el payload plano del Set de Pruebas de certificacion DGII (Task 5, modo
    test) -- NO pasa por ``TFAT_FACTURA``/``fat_repo`` en absoluto.

    ``e_ncf`` es el valor EXPLICITO que trae la fila del Excel (columna
    ``ENCF``/``CasoPrueba``) -- son e-NCF fijos que la propia DGII define
    para el Set de Pruebas, NO una secuencia real de
    ``TFE_SECUENCIA``/``fe_repo.consumir_siguiente_encf`` (esta funcion no
    la llama ni la importa: usarla aqui quemaria numeracion real de
    produccion sobre datos de prueba, ver NOTAS.md #5 y docstring del
    endpoint que llama a esta funcion en ``apps/fe/views.py``).

    Lanza ``ECFBuilderError`` (fallo duro, nunca omite en silencio) si
    falta un campo que el XSD real del ``tipo_ecf`` pedido exige
    (``minOccurs=1``) segun la tabla ``_TIPO_CAPS`` de este modulo,
    construida diffeando los 10 XSD reales -- ver ese comentario para el
    detalle de cada diferencia estructural.
    """
    if tipo_ecf not in TIPOS_ECF_SOPORTADOS:
        raise ECFBuilderError(
            f"TipoeCF {tipo_ecf} no soportado -- catalogo real (TipoeCFType): "
            f"{TIPOS_ECF_SOPORTADOS}")
    e_ncf = (e_ncf or '').strip()
    if not _ENCF_RE.match(e_ncf):
        raise ECFBuilderError(
            f"eNCF invalido: {e_ncf!r} (eNCFValidationType exige exactamente "
            "13 caracteres alfanumericos, ej. E320000000006)")
    caps = _TIPO_CAPS[tipo_ecf]
    parsed = _parse_datos_planos(datos or {})
    simple = parsed['simple']
    idx1_header = parsed['idx1_header']
    idx1_item = parsed['idx1_item']
    idx2 = parsed['idx2']

    ecf = etree.Element('ECF')
    encabezado = _sub(ecf, 'Encabezado')
    _sub(encabezado, 'Version', '1.0')

    id_doc = _sub(encabezado, 'IdDoc')
    _gen_id_doc(id_doc, tipo_ecf, e_ncf, caps, simple, idx1_header)

    emisor = _sub(encabezado, 'Emisor')
    _gen_emisor(emisor, simple, idx1_header)

    if caps['comprador'] != 'ninguno':
        comprador = _sub(encabezado, 'Comprador')
        _gen_comprador(comprador, tipo_ecf, caps, simple)

    # InformacionesAdicionales/Transporte/DescuentosORecargos NO existen en
    # absoluto en el esquema de algunos tipos (41/43 para los dos primeros;
    # 43/47 para el tercero) -- ``caps`` gatea la EXISTENCIA del elemento,
    # no solo si hay datos para llenarlo (ver comentario de ``_TIPO_CAPS``).
    if caps['info_adicional'] and any(
            simple.get(campo) is not None for campo in _INFO_ADICIONAL_FIELDS):
        info_ad = _sub(encabezado, 'InformacionesAdicionales')
        _gen_informaciones_adicionales(info_ad, simple)

    if caps['transporte'] and any(
            simple.get(campo) is not None for campo in caps['transporte']):
        transporte = _sub(encabezado, 'Transporte')
        _gen_transporte(transporte, caps, simple)

    totales = _sub(encabezado, 'Totales')
    _gen_totales(totales, tipo_ecf, caps, simple, idx1_header)

    if any(campo in caps['otra_moneda_campos'] and simple.get(campo) is not None
           for campo in _OTRA_MONEDA_FIELDS):
        otra = _sub(encabezado, 'OtraMoneda')
        _gen_otra_moneda(otra, caps, simple)

    _gen_detalles_items(ecf, tipo_ecf, caps, idx1_item, idx2)

    if caps['descuentos_o_recargos'] and idx1_header.get('NumeroLineaDoR'):
        _gen_descuentos_o_recargos(ecf, idx1_header)

    if caps['info_referencia_mandatory'] or any(
            simple.get(c) for c in ('NCFModificado', 'FechaNCFModificado',
                                    'CodigoModificacion', 'RazonModificacion')):
        _gen_informacion_referencia(ecf, tipo_ecf, caps, simple)

    # FechaHoraFirma es el ultimo elemento real del XSD antes del <xs:any>
    # donde va <Signature> -- igual que en _construir_ecf (Task 1), no se
    # genera aqui el nodo de firma.
    _sub(ecf, 'FechaHoraFirma', _fecha_hora_firma())

    return etree.tostring(
        ecf, xml_declaration=True, encoding='utf-8',
    ).decode('utf-8')
