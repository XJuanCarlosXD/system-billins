"""Tests de apps.fe.ecf_builder (Task 1, Fase 2 e-CF).

Estrategia (misma que apps/asistente/tests/test_tools_fat.py): monkeypatch
sobre apps.legacy.repositories.fat_repo/fe_repo -- nunca se toca Oracle
real, y por lo tanto nunca se consume un e-NCF real de TFE_SECUENCIA (que
es un recurso de verdad limitado durante la certificacion DGII en curso).
Los datos de factura son un fixture ZZTEST inventado en memoria, no una
factura real de cliente.

La prueba mas valiosa es `_validar_estructura_contra_xsd`: valida el XML
generado contra el XSD REAL descargado de la DGII. IMPORTANTE (bug
encontrado en code review post-commit 54e2de3): e-CF-31-v1.0.xsd y
e-CF-32-v1.0.xsd NO son el mismo esquema (aunque comparten la enorme
mayoria del arbol) -- 31 exige `IdDoc/FechaVencimientoSecuencia` y
`Comprador/RNCComprador`+`RazonSocialComprador` obligatorios, que 32 no
exige. Validar la salida de `construir_ecf_31` contra el XSD de 32 (mas
permisivo) habria dado una falsa sensacion de seguridad -- por eso aqui
se cargan AMBOS esquemas reales y cada tipo se valida contra el suyo.
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pytest
from lxml import etree

from apps.fe import ecf_builder
from apps.legacy.repositories import fat_repo, fe_repo

BACKEND_DIR = Path(__file__).resolve().parents[3]
_XSD_DIR = (BACKEND_DIR / 'docs' / 'superpowers' / 'reference'
            / '2026-08-31-set-pruebas-paso2')


def _cargar_xsd(nombre: str) -> etree.XMLSchema:
    """Carga un XSD real de la DGII, corrigiendo SOLO en memoria un typo de
    fabrica confirmado en el archivo oficial ``e-CF-31-v1.0.xsd``:
    ``<xs:simpleType name=" IndicadorServicioTodoIncluidoType">`` tiene un
    espacio inicial en el atributo ``name`` que no coincide con la
    referencia ``type="IndicadorServicioTodoIncluidoType"`` (sin espacio)
    usada en ``IdDoc`` -- ``xs:NCName`` no colapsa ese espacio para
    libxml2/lxml, y ``etree.XMLSchema()`` falla al parsear el esquema
    completo con ``XMLSchemaParseError: ... does not resolve to a(n) type
    definition`` si no se corrige. Es un error de tipeo del archivo
    descargado de la DGII, no algo que ``ecf_builder`` introduce ni pueda
    arreglar (el XML que generamos ni siquiera usa ese elemento opcional).
    El archivo de referencia en ``docs/`` se deja intacto -- la correccion
    se aplica solo a los bytes en memoria, solo para poder cargar el
    esquema aqui en las pruebas.
    """
    xml_bytes = (_XSD_DIR / nombre).read_bytes()
    xml_bytes = xml_bytes.replace(
        b'name=" IndicadorServicioTodoIncluidoType"',
        b'name="IndicadorServicioTodoIncluidoType"',
    )
    return etree.XMLSchema(etree.fromstring(xml_bytes))


_SCHEMA_31 = _cargar_xsd('e-CF-31-v1.0.xsd')
_SCHEMA_32 = _cargar_xsd('e-CF-32-v1.0.xsd')
_SCHEMA_POR_TIPO = {31: _SCHEMA_31, 32: _SCHEMA_32}


def _validar_estructura_contra_xsd(xml_str: str, tipo_ecf: int) -> None:
    """Valida contra el XSD REAL de la DGII (el especifico de `tipo_ecf`,
    31 o 32 -- no son intercambiables, ver docstring del modulo) todo lo
    que ecf_builder SI genera (Encabezado..FechaHoraFirma). El XSD exige
    ademas un <xs:any> final (minOccurs=1) donde va <Signature> --
    ecf_builder deliberadamente no lo genera (lo agrega
    firmar_con_app_oficial despues), asi que se le agrega aqui un
    elemento placeholder solo para poder ejercitar la validacion XSD real
    sobre el resto del documento en vez de omitirla.
    """
    schema = _SCHEMA_POR_TIPO[tipo_ecf]
    root = etree.fromstring(xml_str.encode('utf-8'))
    etree.SubElement(root, 'PlaceholderSignature')
    is_valid = schema.validate(root)
    assert is_valid, f"XML invalido contra el XSD real de tipo {tipo_ecf}: {schema.error_log}"


def _linea(no_linea, descripcion, cantidad, precio, porciento_impuesto,
          impuesto, monto_neto, st_anulado='N'):
    return {
        'no_linea': no_linea, 'no_produ': f'ZZTEST-{no_linea}',
        'descripcion': descripcion, 'almacen': '01',
        'cantidad': cantidad, 'precio': precio,
        'porc_descuento': 0.0, 'descuento': 0.0,
        # get_factura() real coerce porciento_impuesto con `or 0` (colapsa
        # NULL/exento con 0% explicito) -- se simula ese mismo dato "ya
        # coercionado" aqui para probar que ecf_builder usa el valor CRUDO
        # de lineas_porciento_raw (ver fat_repo.get_datos_fiscales_factura)
        # y no este.
        'porciento_impuesto': porciento_impuesto or 0.0,
        'impuesto': impuesto, 'monto_neto': monto_neto,
        'cantidad_regalia': 0.0, 'st_anulado': st_anulado,
    }


def _factura_zztest(tipo_factura='FT', no_factura='0000900',
                    posiciones_fijas_ncf='B02', forma_pago='EFECTIVO'):
    """Factura ZZTEST con 3 lineas: ITBIS 18%, Exento (porciento None) e
    ITBIS 0% explicito (porciento 0) -- para probar que ecf_builder
    distingue Exento (IndicadorFacturacion=4) de 0% (IndicadorFacturacion=3),
    caso que get_factura() por si solo no puede distinguir.
    """
    lineas = [
        _linea(1, 'PRODUCTO ZZTEST GRAVADO 18%', 2.0, 100.0, 18.0, 36.0, 200.0),
        _linea(2, 'PRODUCTO ZZTEST EXENTO', 1.0, 50.0, None, 0.0, 50.0),
        _linea(3, 'PRODUCTO ZZTEST ITBIS 0%', 1.0, 30.0, 0.0, 0.0, 30.0),
    ]
    total_linea = sum(l['monto_neto'] for l in lineas)  # 280.00
    impuesto = sum(l['impuesto'] for l in lineas)  # 36.00
    return {
        'no_cia': '01', 'punto': '01', 'tipo_factura': tipo_factura,
        'no_factura': no_factura, 'no_cliente': 999999,
        'nombre_cliente': 'CLIENTE ZZTEST SRL',
        'nombre_cliente_factura': 'CLIENTE ZZTEST SRL',
        'rnc_factura': '130217432',
        'fecha': '2026-08-31', 'vendedor': '01',
        'total_linea': total_linea, 'descuento': 0.0, 'impuesto': impuesto,
        'total_neto': total_linea + impuesto, 'propina': 0.0, 'estado': 'A',
        'ncf': 6, 'posiciones_fijas_ncf': posiciones_fijas_ncf,
        'ncf_dgi': f'{posiciones_fijas_ncf}00000006',
        'codigo_ncf': posiciones_fijas_ncf, 'tipo_ncf_fiscal': '',
        'plazo_pago': 0, 'forma_pago': forma_pago, 'no_condicion_pago': '',
        'tasa_us': 0.0, 'porc_impuesto': 18.0, 'nota': '', 'detalle': '',
        'usuario': 'ZZTEST', 'st_anulado': 'N', 'st_impresion': 'N',
        'st_generado_cnt': 'N', 'tipo_anula_dgii': '', 'motivo_anulacion': '',
        'valor_recibido': 0.0, 'valor_devuelto': 0.0,
        'lineas': lineas, 'notas_credito_aplicadas': [],
    }


def _datos_fiscales_zztest(forma_pago_fat='1', tipo_pago_fiscal='1',
                           rnc_comprador='130217432'):
    return {
        'rnc_comprador': rnc_comprador,
        'direccion_comprador': 'CALLE ZZTEST #1, SANTO DOMINGO',
        'cedula_comprador': '',
        'tipo_ingreso': '01',
        'forma_pago_fat': forma_pago_fat,
        'tipo_pago_fiscal': tipo_pago_fiscal,
        'lineas_porciento_raw': {1: 18.0, 2: None, 3: 0.0},
    }


def _config_zztest():
    return {
        'no_cia': '01', 'ambiente': 'testecf', 'rnc_emisor': '130217432',
        'razon_social': 'ABREGONZA SRL', 'nombre_comercial': 'ABREGONZA',
        'direccion_emisor': 'AV. ZZTEST #100, SANTO DOMINGO',
        'municipio': '010000', 'provincia': '010000',
        'cert_subject': '', 'cert_vence': None, 'estado_cert': '',
        'activo': 'S', 'fecha_actualiza': None, 'tiene_cert': 'N',
    }


@pytest.fixture(autouse=True)
def _patch_repos(monkeypatch):
    """Evita cualquier acceso a Oracle real; cada test ajusta lo que
    necesite via monkeypatch adicional sobre estos mismos fakes."""
    state = {
        'factura': _factura_zztest(),
        'datos_fiscales': _datos_fiscales_zztest(),
        'config': _config_zztest(),
        'encf_consumido': [],
        'fecha_vencimiento_secuencia': datetime(2028, 12, 31),
    }

    def fake_get_factura(no_cia, punto, tipo_factura, no_factura):
        return state['factura']

    def fake_get_datos_fiscales(no_cia, punto, tipo_factura, no_factura):
        return state['datos_fiscales']

    def fake_get_config(no_cia):
        return state['config']

    def fake_consumir_siguiente_encf(no_cia, tipo_ecf):
        state['encf_consumido'].append((no_cia, tipo_ecf))
        return {
            'e_ncf': f"E{int(tipo_ecf):02d}0000000123",
            'fecha_vencimiento_secuencia': state['fecha_vencimiento_secuencia'],
        }

    monkeypatch.setattr(fat_repo, 'get_factura', fake_get_factura)
    monkeypatch.setattr(fat_repo, 'get_datos_fiscales_factura', fake_get_datos_fiscales)
    monkeypatch.setattr(fe_repo, 'get_config', fake_get_config)
    monkeypatch.setattr(fe_repo, 'consumir_siguiente_encf', fake_consumir_siguiente_encf)
    return state


def test_construir_ecf_32_consumo_contado_valida_contra_xsd(_patch_repos):
    xml_str = ecf_builder.construir_ecf_32('01', '01', 'FT', '0000900')

    _validar_estructura_contra_xsd(xml_str, 32)
    root = etree.fromstring(xml_str.encode('utf-8'))

    assert root.findtext('.//IdDoc/TipoeCF') == '32'
    assert root.findtext('.//IdDoc/eNCF') == 'E320000000123'
    assert len(root.findtext('.//IdDoc/eNCF')) == 13
    # 32 no tiene FechaVencimientoSecuencia en absoluto (solo existe en 31).
    assert root.find('.//IdDoc/FechaVencimientoSecuencia') is None
    assert root.findtext('.//IdDoc/TipoPago') == '1'  # contado
    formas = root.findall('.//TablaFormasPago/FormaDePago')
    assert len(formas) == 1
    assert formas[0].findtext('FormaPago') == '1'
    assert formas[0].findtext('MontoPago') == '316.00'

    assert root.findtext('.//Emisor/RNCEmisor') == '130217432'
    assert root.findtext('.//Emisor/RazonSocialEmisor') == 'ABREGONZA SRL'
    assert root.findtext('.//Emisor/FechaEmision') == '31-08-2026'

    assert root.findtext('.//Comprador/RNCComprador') == '130217432'
    assert root.findtext('.//Comprador/RazonSocialComprador') == 'CLIENTE ZZTEST SRL'

    assert root.findtext('.//Totales/TotalITBIS') == '36.00'
    assert root.findtext('.//Totales/MontoTotal') == '316.00'
    assert root.findtext('.//Totales/MontoExento') == '50.00'
    # Gravado 18% (200) + gravado 0% (30) = 230 (exento 50 no cuenta).
    assert root.findtext('.//Totales/MontoGravadoTotal') == '230.00'
    assert root.findtext('.//Totales/MontoGravadoI1') == '200.00'
    assert root.findtext('.//Totales/MontoGravadoI3') == '30.00'
    assert root.find('.//Totales/MontoGravadoI2') is None  # no hay lineas 16%

    items = root.findall('.//DetallesItems/Item')
    assert len(items) == 3
    # Linea 1: ITBIS 18% -> IndicadorFacturacion 1
    assert items[0].findtext('IndicadorFacturacion') == '1'
    assert items[0].findtext('NombreItem') == 'PRODUCTO ZZTEST GRAVADO 18%'
    assert items[0].findtext('CantidadItem') == '2.00'
    assert items[0].findtext('PrecioUnitarioItem') == '100.00'
    assert items[0].findtext('MontoItem') == '200.00'
    # Linea 2: exento (raw None) -> IndicadorFacturacion 4, NO 3
    assert items[1].findtext('IndicadorFacturacion') == '4'
    # Linea 3: ITBIS 0% explicito (raw 0.0) -> IndicadorFacturacion 3, NO 4
    assert items[2].findtext('IndicadorFacturacion') == '3'

    assert root.find('FechaHoraFirma') is not None
    # No debe incluir el nodo de firma -- eso lo agrega firma.py despues.
    assert root.find('Signature') is None


def test_construir_ecf_31_credito_fiscal_sin_tabla_formas_pago(_patch_repos):
    _patch_repos['factura'] = _factura_zztest(
        tipo_factura='FC', no_factura='0000901', posiciones_fijas_ncf='B01')
    _patch_repos['datos_fiscales'] = _datos_fiscales_zztest(forma_pago_fat='4')

    xml_str = ecf_builder.construir_ecf_31('01', '01', 'FC', '0000901')

    _validar_estructura_contra_xsd(xml_str, 31)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//IdDoc/TipoeCF') == '31'
    assert root.findtext('.//IdDoc/eNCF') == 'E310000000123'
    assert root.findtext('.//IdDoc/TipoPago') == '2'  # credito
    assert root.find('.//TablaFormasPago') is None

    # Bug critico encontrado en code review: 31 exige FechaVencimientoSecuencia
    # (minOccurs=1) justo despues de eNCF -- 32 no tiene este elemento.
    id_doc = root.find('.//IdDoc')
    tags = [child.tag for child in id_doc]
    assert tags.index('eNCF') + 1 == tags.index('FechaVencimientoSecuencia'), (
        "FechaVencimientoSecuencia debe ir INMEDIATAMENTE despues de eNCF, "
        f"segun la secuencia del XSD real de tipo 31. Orden actual: {tags}")
    assert root.findtext('.//IdDoc/FechaVencimientoSecuencia') == '31-12-2028'

    # Bug critico: RNCComprador/RazonSocialComprador son obligatorios en 31.
    assert root.findtext('.//Comprador/RNCComprador') == '130217432'
    assert root.findtext('.//Comprador/RazonSocialComprador') == 'CLIENTE ZZTEST SRL'


def test_fecha_limite_pago_default_30_dias_cuando_credito_sin_plazo(_patch_repos):
    """Bug encontrado en Paso 4 real (E310000000055 rechazado 2026-09-22
    con codigo 1100 'FechaLimitePago no es valido'): la DGII exige
    FechaLimitePago cuando TipoPago=2 (credito). Muchas facturas reales
    de credito en FAT tienen plazo_pago=0; en ese caso default=30 dias.
    """
    _patch_repos['factura'] = _factura_zztest(
        tipo_factura='FC', no_factura='0000903', posiciones_fijas_ncf='B01')
    _patch_repos['factura']['plazo_pago'] = 0
    _patch_repos['factura']['fecha'] = '2026-08-31'
    _patch_repos['datos_fiscales'] = _datos_fiscales_zztest(forma_pago_fat='4')
    xml_str = ecf_builder.construir_ecf_31('01', '01', 'FC', '0000903')

    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//IdDoc/TipoPago') == '2'
    # fecha 2026-08-31 + 30 dias = 2026-09-30 -> '30-09-2026'
    assert root.findtext('.//IdDoc/FechaLimitePago') == '30-09-2026'


def test_indicador_monto_gravado_es_cero_y_monto_item_no_incluye_itbis(_patch_repos):
    """Bug critico encontrado en Paso 4 real (E310000000054 rechazado por
    DGII 2026-09-22 con codigo 176 'IndicadorMontoGravado no es valido'):
    la DGII exige IndicadorMontoGravado en IdDoc (aunque el XSD diga
    minOccurs=0) Y que MontoItem NO incluya el ITBIS cuando ese indicador
    es 0. En la BD real (TFAT_FACTURAL) monto_neto SI incluye el ITBIS
    (ej. FC-0007829: cantidad=1, precio=578567.03, impuesto=104142.07,
    monto_neto=682709.10) -- por eso MontoItem se calcula de
    precio*cantidad-descuento en vez de monto_neto directo.
    """
    # Linea con ITBIS 18%: precio 100 x cantidad 2 - descuento 0 = 200
    # (sin ITBIS). En cambio monto_neto+ITBIS seria 200+36 = 236.
    _patch_repos['factura'] = _factura_zztest(
        tipo_factura='FC', no_factura='0000902', posiciones_fijas_ncf='B01')
    xml_str = ecf_builder.construir_ecf_31('01', '01', 'FC', '0000902')

    root = etree.fromstring(xml_str.encode('utf-8'))
    # IndicadorMontoGravado presente y con valor 0
    assert root.findtext('.//IdDoc/IndicadorMontoGravado') == '0'
    # Debe ir antes de TipoIngresos (orden del XSD).
    id_doc = root.find('.//IdDoc')
    tags = [child.tag for child in id_doc]
    assert tags.index('IndicadorMontoGravado') < tags.index('TipoIngresos')
    # MontoItem = precio*cantidad-descuento (SIN ITBIS), no monto_neto.
    items = root.findall('.//DetallesItems/Item')
    assert items[0].findtext('MontoItem') == '200.00'  # 100*2 - 0
    assert items[1].findtext('MontoItem') == '50.00'   # 50*1 - 0 exento
    assert items[2].findtext('MontoItem') == '30.00'   # 30*1 - 0 itbis 0%


def test_totales_desglose_por_tasa_itbis_y_orden_xsd(_patch_repos):
    """Bug encontrado en Paso 4 real (E310000000056 rechazado 2026-09-22
    codigo 1930 "MontoGravadoI1 no es valido"): la DGII exige el desglose
    Totales/MontoGravadoI1..I3 + ITBIS1..3 + TotalITBIS1..3 cuando hay
    lineas gravadas, aunque en el XSD todos esos campos sean minOccurs=0.
    Ademas, el XSD exige un orden estricto entre esos elementos y
    MontoExento/TotalITBIS/MontoTotal -- si se emiten fuera de orden el
    XSD marca el documento invalido.
    """
    _patch_repos['factura'] = _factura_zztest(
        tipo_factura='FC', no_factura='0000904', posiciones_fijas_ncf='B01')
    _patch_repos['datos_fiscales'] = _datos_fiscales_zztest(forma_pago_fat='4')
    xml_str = ecf_builder.construir_ecf_31('01', '01', 'FC', '0000904')
    _validar_estructura_contra_xsd(xml_str, 31)

    root = etree.fromstring(xml_str.encode('utf-8'))
    totales = root.find('.//Totales')
    # Base gravada por linea = precio*cantidad - descuento (SIN ITBIS).
    # Linea 1 (18%): 100*2 = 200 base, 36 ITBIS.
    # Linea 3 (0%): 30*1 = 30 base, 0 ITBIS.
    # Linea 2 (exento): 50*1 = 50 -> MontoExento (no cuenta a I1..I3).
    assert totales.findtext('MontoGravadoTotal') == '230.00'
    assert totales.findtext('MontoGravadoI1') == '200.00'
    assert totales.find('MontoGravadoI2') is None
    assert totales.findtext('MontoGravadoI3') == '30.00'
    assert totales.findtext('MontoExento') == '50.00'
    assert totales.findtext('ITBIS1') == '18'
    assert totales.find('ITBIS2') is None
    assert totales.findtext('ITBIS3') == '0'
    assert totales.findtext('TotalITBIS') == '36.00'
    assert totales.findtext('TotalITBIS1') == '36.00'
    assert totales.find('TotalITBIS2') is None
    assert totales.findtext('TotalITBIS3') == '0.00'
    assert totales.findtext('MontoTotal') == '316.00'

    # Orden exacto del XSD (e-CF-31-v1.0.xsd lineas 132-162).
    tags = [c.tag for c in totales]
    esperado = [
        'MontoGravadoTotal', 'MontoGravadoI1', 'MontoGravadoI3',
        'MontoExento', 'ITBIS1', 'ITBIS3', 'TotalITBIS', 'TotalITBIS1',
        'TotalITBIS3', 'MontoTotal',
    ]
    assert tags == esperado, f"orden incorrecto en Totales: {tags}"


def test_totales_16pct_emite_i2_e_itbis2(_patch_repos):
    """Cobertura del breakdown para 16% (MontoGravadoI2/ITBIS2/TotalITBIS2)
    -- FAT en la practica factura casi solo 18%, pero el builder tiene que
    manejar 16% correctamente igual (no adivinar el orden en produccion).
    """
    factura = _factura_zztest(
        tipo_factura='FC', no_factura='0000905', posiciones_fijas_ncf='B01')
    factura['lineas'] = [
        _linea(1, 'PROD ITBIS 16', 1.0, 100.0, 16.0, 16.0, 116.0),
    ]
    factura['total_linea'] = 100.0
    factura['impuesto'] = 16.0
    factura['total_neto'] = 116.0
    _patch_repos['factura'] = factura
    _patch_repos['datos_fiscales'] = _datos_fiscales_zztest(forma_pago_fat='4')
    _patch_repos['datos_fiscales']['lineas_porciento_raw'] = {1: 16.0}
    xml_str = ecf_builder.construir_ecf_31('01', '01', 'FC', '0000905')
    _validar_estructura_contra_xsd(xml_str, 31)

    root = etree.fromstring(xml_str.encode('utf-8'))
    totales = root.find('.//Totales')
    assert totales.findtext('MontoGravadoI2') == '100.00'
    assert totales.findtext('ITBIS2') == '16'
    assert totales.findtext('TotalITBIS2') == '16.00'
    assert totales.find('MontoGravadoI1') is None
    assert totales.find('MontoGravadoI3') is None


def test_construir_ecf_31_sin_rnc_comprador_lanza_error_en_vez_de_omitir(_patch_repos):
    """Bug critico (code review post-commit 54e2de3): un e-CF 31 sin RNC del
    comprador es un documento invalido para la DGII (RNCComprador es
    minOccurs=1 en e-CF-31-v1.0.xsd, a diferencia de 32) -- debe fallar la
    generacion, no construir un XML incompleto en silencio."""
    _patch_repos['factura'] = _factura_zztest(
        tipo_factura='FC', no_factura='0000901', posiciones_fijas_ncf='B01')
    _patch_repos['datos_fiscales'] = _datos_fiscales_zztest(
        forma_pago_fat='4', rnc_comprador='')

    with pytest.raises(ecf_builder.ECFBuilderError, match='e-CF 31.*RNC'):
        ecf_builder.construir_ecf_31('01', '01', 'FC', '0000901')


def test_construir_ecf_31_sin_razon_social_comprador_lanza_error(_patch_repos):
    """Mismo bug critico que el RNC: RazonSocialComprador tambien es
    minOccurs=1 en 31."""
    factura = _factura_zztest(
        tipo_factura='FC', no_factura='0000901', posiciones_fijas_ncf='B01')
    factura['nombre_cliente_factura'] = ''
    factura['nombre_cliente'] = ''
    _patch_repos['factura'] = factura
    _patch_repos['datos_fiscales'] = _datos_fiscales_zztest(forma_pago_fat='4')

    with pytest.raises(ecf_builder.ECFBuilderError, match='e-CF 31.*razon social'):
        ecf_builder.construir_ecf_31('01', '01', 'FC', '0000901')


def test_construir_ecf_31_sin_fecha_vencimiento_secuencia_lanza_error(_patch_repos):
    """Si TFE_SECUENCIA no tiene fecha_vence configurada para el tipo 31, no
    se debe generar un e-CF 31 sin IdDoc/FechaVencimientoSecuencia (obligatorio)."""
    _patch_repos['factura'] = _factura_zztest(
        tipo_factura='FC', no_factura='0000901', posiciones_fijas_ncf='B01')
    _patch_repos['datos_fiscales'] = _datos_fiscales_zztest(forma_pago_fat='4')
    _patch_repos['fecha_vencimiento_secuencia'] = None

    with pytest.raises(ecf_builder.ECFBuilderError, match='FechaVencimientoSecuencia'):
        ecf_builder.construir_ecf_31('01', '01', 'FC', '0000901')


def test_construir_ecf_32_sin_rnc_comprador_no_lanza_error(_patch_repos):
    """Contraste directo con el bug de 31: en 32 (Consumo) el comprador SI
    puede no tener RNC (consumidor final) -- eso debe seguir funcionando
    para MontoTotal < 250,000."""
    _patch_repos['datos_fiscales'] = _datos_fiscales_zztest(rnc_comprador='')
    xml_str = ecf_builder.construir_ecf_32('01', '01', 'FT', '0000900')
    _validar_estructura_contra_xsd(xml_str, 32)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.find('.//Comprador/RNCComprador') is None


def test_construir_ecf_32_mayor_o_igual_250mil_sin_rnc_lanza_error(_patch_repos):
    """DGII exige RNCComprador para tipo 32 (Consumo) cuando MontoTotal
    >= RD$250,000, aunque el XSD lo marque minOccurs=0. E320000001004
    rechazado 2026-09-23 codigo 1381 confirma la regla contra certecf
    real."""
    factura = _factura_zztest()
    # Escalar total_neto por encima de 250,000 (mantener la estructura de
    # lineas para que el XSD sigue siendo valido si no fuera por el RNC).
    factura['lineas'][0]['cantidad'] = 2500.0
    factura['lineas'][0]['monto_neto'] = 250000.0 * 1.18  # con ITBIS
    factura['lineas'][0]['impuesto'] = 250000.0 * 0.18
    factura['impuesto'] = factura['lineas'][0]['impuesto']
    factura['total_linea'] = 250000.0 + 50.0 + 30.0
    factura['total_neto'] = factura['total_linea'] + factura['impuesto']  # ~295K
    assert factura['total_neto'] >= 250000
    _patch_repos['factura'] = factura
    _patch_repos['datos_fiscales'] = _datos_fiscales_zztest(rnc_comprador='')
    with pytest.raises(ecf_builder.ECFBuilderError, match=r'250,000.*RNC'):
        ecf_builder.construir_ecf_32('01', '01', 'FT', '0000900')


def test_consume_encf_del_tipo_correcto(_patch_repos):
    ecf_builder.construir_ecf_32('01', '01', 'FT', '0000900')
    assert _patch_repos['encf_consumido'] == [('01', 32)]


def test_tipo_solicitado_no_coincide_con_ncf_de_papel_lanza_error(_patch_repos):
    # La factura es B02 (Consumo) pero se pide el e-CF de Credito Fiscal.
    with pytest.raises(ecf_builder.ECFBuilderError, match=r'tipo 31.*tipo 32'):
        ecf_builder.construir_ecf_31('01', '01', 'FT', '0000900')


def test_factura_sin_ncf_credito_fiscal_ni_consumo_lanza_error(_patch_repos):
    _patch_repos['factura'] = _factura_zztest(posiciones_fijas_ncf='B04')
    with pytest.raises(ecf_builder.ECFBuilderError, match='Credito Fiscal/Consumo'):
        ecf_builder.construir_ecf_32('01', '01', 'FT', '0000900')


def test_factura_anulada_lanza_error(_patch_repos):
    _patch_repos['factura']['st_anulado'] = 'S'
    with pytest.raises(ecf_builder.ECFBuilderError, match='anulada'):
        ecf_builder.construir_ecf_32('01', '01', 'FT', '0000900')


def test_factura_inexistente_lanza_error(_patch_repos):
    _patch_repos['factura'] = None
    with pytest.raises(ecf_builder.ECFBuilderError, match='No existe'):
        ecf_builder.construir_ecf_32('01', '01', 'FT', '9999999')


def test_sin_lineas_activas_lanza_error(_patch_repos):
    factura = _factura_zztest()
    for l in factura['lineas']:
        l['st_anulado'] = 'S'
    _patch_repos['factura'] = factura
    with pytest.raises(ecf_builder.ECFBuilderError, match='lineas activas'):
        ecf_builder.construir_ecf_32('01', '01', 'FT', '0000900')


def test_sin_tfe_config_lanza_error(_patch_repos):
    _patch_repos['config'] = None
    with pytest.raises(ecf_builder.ECFBuilderError, match='TFE_CONFIG'):
        ecf_builder.construir_ecf_32('01', '01', 'FT', '0000900')


def test_rnc_comprador_invalido_se_omite_en_vez_de_enviarse_mal(_patch_repos):
    """Un RNC/cedula mal capturado (ni 9 ni 11 digitos) no debe generar un
    e-CF invalido: en 32 (opcional) se omite el elemento en vez de mandarlo
    roto. En 31 (obligatorio) esto debe fallar -- ver
    test_construir_ecf_31_sin_rnc_comprador_lanza_error_en_vez_de_omitir."""
    _patch_repos['datos_fiscales'] = _datos_fiscales_zztest(rnc_comprador='123')
    xml_str = ecf_builder.construir_ecf_32('01', '01', 'FT', '0000900')
    _validar_estructura_contra_xsd(xml_str, 32)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.find('.//Comprador/RNCComprador') is None
