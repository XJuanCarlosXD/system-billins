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
