"""Tests de apps.fe.ecf_builder (Task 1, Fase 2 e-CF).

Estrategia (misma que apps/asistente/tests/test_tools_fat.py): monkeypatch
sobre apps.legacy.repositories.fat_repo/fe_repo -- nunca se toca Oracle
real, y por lo tanto nunca se consume un e-NCF real de TFE_SECUENCIA (que
es un recurso de verdad limitado durante la certificacion DGII en curso).
Los datos de factura son un fixture ZZTEST inventado en memoria, no una
factura real de cliente.

La prueba mas valiosa es `_validar_estructura_contra_xsd`: valida el XML
generado contra el XSD REAL descargado de la DGII
(docs/superpowers/reference/2026-08-31-set-pruebas-paso2/e-CF-32-v1.0.xsd),
que es la unica fuente de verdad real disponible sin credenciales del
portal de certificacion.
"""
from __future__ import annotations

from pathlib import Path

import pytest
from lxml import etree

from apps.fe import ecf_builder
from apps.legacy.repositories import fat_repo, fe_repo

BACKEND_DIR = Path(__file__).resolve().parents[3]
XSD_PATH = (BACKEND_DIR / 'docs' / 'superpowers' / 'reference'
            / '2026-08-31-set-pruebas-paso2' / 'e-CF-32-v1.0.xsd')
_SCHEMA = etree.XMLSchema(etree.parse(str(XSD_PATH)))


def _validar_estructura_contra_xsd(xml_str: str) -> None:
    """Valida contra el XSD real de la DGII todo lo que ecf_builder SI
    genera (Encabezado..FechaHoraFirma). El XSD exige ademas un <xs:any>
    final (minOccurs=1) donde va <Signature> -- ecf_builder deliberadamente
    no lo genera (lo agrega firmar_con_app_oficial despues, ver docstring
    del modulo), asi que se le agrega aqui un elemento placeholder solo
    para poder ejercitar la validacion XSD real sobre el resto del
    documento en vez de omitirla.
    """
    root = etree.fromstring(xml_str.encode('utf-8'))
    etree.SubElement(root, 'PlaceholderSignature')
    is_valid = _SCHEMA.validate(root)
    assert is_valid, f"XML invalido contra el XSD real: {_SCHEMA.error_log}"


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
    }

    def fake_get_factura(no_cia, punto, tipo_factura, no_factura):
        return state['factura']

    def fake_get_datos_fiscales(no_cia, punto, tipo_factura, no_factura):
        return state['datos_fiscales']

    def fake_get_config(no_cia):
        return state['config']

    def fake_consumir_siguiente_encf(no_cia, tipo_ecf):
        state['encf_consumido'].append((no_cia, tipo_ecf))
        return f"E{int(tipo_ecf):02d}0000000123"

    monkeypatch.setattr(fat_repo, 'get_factura', fake_get_factura)
    monkeypatch.setattr(fat_repo, 'get_datos_fiscales_factura', fake_get_datos_fiscales)
    monkeypatch.setattr(fe_repo, 'get_config', fake_get_config)
    monkeypatch.setattr(fe_repo, 'consumir_siguiente_encf', fake_consumir_siguiente_encf)
    return state


def test_construir_ecf_32_consumo_contado_valida_contra_xsd(_patch_repos):
    xml_str = ecf_builder.construir_ecf_32('01', '01', 'FT', '0000900')

    _validar_estructura_contra_xsd(xml_str)
    root = etree.fromstring(xml_str.encode('utf-8'))

    assert root.findtext('.//IdDoc/TipoeCF') == '32'
    assert root.findtext('.//IdDoc/eNCF') == 'E320000000123'
    assert len(root.findtext('.//IdDoc/eNCF')) == 13
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
    assert root.findtext('.//Totales/MontoGravadoTotal') == '230.00'

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

    _validar_estructura_contra_xsd(xml_str)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//IdDoc/TipoeCF') == '31'
    assert root.findtext('.//IdDoc/eNCF') == 'E310000000123'
    assert root.findtext('.//IdDoc/TipoPago') == '2'  # credito
    assert root.find('.//TablaFormasPago') is None


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
    e-CF invalido: se omite el elemento opcional en vez de mandarlo roto."""
    _patch_repos['datos_fiscales'] = _datos_fiscales_zztest(rnc_comprador='123')
    xml_str = ecf_builder.construir_ecf_32('01', '01', 'FT', '0000900')
    _validar_estructura_contra_xsd(xml_str)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.find('.//Comprador/RNCComprador') is None
