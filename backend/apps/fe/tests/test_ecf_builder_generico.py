"""Tests de ``apps.fe.ecf_builder.construir_ecf_generico`` (Task 5, modo
test del Set de Pruebas de certificacion DGII).

A diferencia de ``test_ecf_builder.py`` (Task 1, dict de forma de negocio
derivado de ``TFAT_FACTURA``), este builder recibe el dict PLANO con
notacion de corchetes que el operador pega de una fila de
``set-pruebas-130217432.xlsx`` -- no hay ninguna llamada a Oracle/fat_repo
aqui, ``construir_ecf_generico`` es una funcion pura (dict -> XML), asi que
estos tests no necesitan monkeypatch de repos.

La prueba mas valiosa es ``_validar_estructura_contra_xsd``: valida el XML
generado contra el XSD REAL descargado de la DGII (``e-CF-<tipo>-v1.0.xsd``)
-- una por cada uno de los 10 valores de TipoeCF, no solo 31/32. Ver
``docs/superpowers/reference/2026-08-31-set-pruebas-paso2/NOTAS.md``
seccion 5 para el esquema de aplanado y ``campos-usados-set-pruebas.txt``
para los 347 campos reales que el parser cubre.
"""
from __future__ import annotations

from pathlib import Path

import pytest
from lxml import etree

from apps.fe import ecf_builder

BACKEND_DIR = Path(__file__).resolve().parents[3]
_XSD_DIR = (BACKEND_DIR / 'docs' / 'superpowers' / 'reference'
            / '2026-08-31-set-pruebas-paso2')

_TIPOS = (31, 32, 33, 34, 41, 43, 44, 45, 46, 47)


def _cargar_xsd(tipo_ecf: int) -> etree.XMLSchema:
    """Carga el XSD real de la DGII para ``tipo_ecf``, corrigiendo SOLO en
    memoria el mismo typo de fabrica ya documentado en
    ``test_ecf_builder.py`` (``e-CF-31-v1.0.xsd`` tiene un espacio inicial
    en ``name=" IndicadorServicioTodoIncluidoType"``) -- el ``.replace()``
    es un no-op si el byte exacto no aparece en el archivo de otro tipo,
    asi que aplicarlo a los 10 sin condicion es seguro.
    """
    xml_bytes = (_XSD_DIR / f'e-CF-{tipo_ecf}-v1.0.xsd').read_bytes()
    xml_bytes = xml_bytes.replace(
        b'name=" IndicadorServicioTodoIncluidoType"',
        b'name="IndicadorServicioTodoIncluidoType"',
    )
    return etree.XMLSchema(etree.fromstring(xml_bytes))


_SCHEMA_POR_TIPO = {tipo: _cargar_xsd(tipo) for tipo in _TIPOS}


def _validar_estructura_contra_xsd(xml_str: str, tipo_ecf: int) -> None:
    """Valida contra el XSD real del ``tipo_ecf`` pedido todo lo que
    ``construir_ecf_generico`` SI genera (Encabezado..FechaHoraFirma). El
    XSD exige ademas un ``<xs:any>`` final (minOccurs=1) donde va
    ``<Signature>`` -- el builder deliberadamente no lo genera (lo agrega
    ``firmar_con_app_oficial`` despues), se agrega aqui un placeholder solo
    para poder ejercitar la validacion XSD real sobre el resto.
    """
    schema = _SCHEMA_POR_TIPO[tipo_ecf]
    root = etree.fromstring(xml_str.encode('utf-8'))
    etree.SubElement(root, 'PlaceholderSignature')
    is_valid = schema.validate(root)
    assert is_valid, (
        f"XML invalido contra el XSD real de tipo {tipo_ecf}: {schema.error_log}\n"
        f"{xml_str}")


# ---------------------------------------------------------------------------
# 1. Un test por nivel de profundidad de corchete (parser generico)
# ---------------------------------------------------------------------------

def _datos_minimos_32(**overrides) -> dict:
    """Payload minimo valido para TipoeCF 32 (el mas permisivo -- sin
    FechaVencimientoSecuencia/IndicadorNotaCredito/InformacionReferencia
    obligatorios, Comprador opcional) -- base para los tests de parser."""
    datos = {
        'RNCEmisor': '130217432',
        'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO',
        'FechaEmision': '31-12-2028',
        'TipoIngresos': '01',
        'TipoPago': 1,
        'MontoTotal': '1180.00',
        'NumeroLinea[1]': 1,
        'IndicadorFacturacion[1]': 1,
        'NombreItem[1]': 'PRODUCTO ZZTEST',
        'IndicadorBienoServicio[1]': 1,
        'CantidadItem[1]': '1.00',
        'PrecioUnitarioItem[1]': '1000.00',
        'MontoItem[1]': '1000.00',
    }
    datos.update(overrides)
    return datos


def test_parser_campo_simple_de_encabezado():
    """Profundidad 0: 'WebSite' (sin corchete) va directo dentro de
    Emisor, sin indexar."""
    datos = _datos_minimos_32(WebSite='https://abregonza.example.do')
    xml_str = ecf_builder.construir_ecf_generico(32, 'E320000000006', datos)
    _validar_estructura_contra_xsd(xml_str, 32)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//Emisor/WebSite') == 'https://abregonza.example.do'


def test_parser_grupo_repetido_de_encabezado_un_corchete():
    """Profundidad 1 (grupo repetido de encabezado): FormaPago[1]/
    MontoPago[1] + FormaPago[2]/MontoPago[2] arman DOS instancias de
    TablaFormasPago/FormaDePago, en el orden de los indices."""
    datos = _datos_minimos_32(**{
        'FormaPago[1]': 1, 'MontoPago[1]': '680.00',
        'FormaPago[2]': 3, 'MontoPago[2]': '500.00',
    })
    xml_str = ecf_builder.construir_ecf_generico(32, 'E320000000006', datos)
    _validar_estructura_contra_xsd(xml_str, 32)
    root = etree.fromstring(xml_str.encode('utf-8'))
    formas = root.findall('.//TablaFormasPago/FormaDePago')
    assert len(formas) == 2
    assert formas[0].findtext('FormaPago') == '1'
    assert formas[0].findtext('MontoPago') == '680.00'
    assert formas[1].findtext('FormaPago') == '3'
    assert formas[1].findtext('MontoPago') == '500.00'


def test_parser_campo_de_item_un_corchete():
    """Profundidad 1 (campo de linea/item): NumeroLinea[1]/[2] con sus
    campos asociados arman DOS <Item> distintos dentro de DetallesItems,
    en el orden de los indices de linea -- NO confundir con el grupo
    repetido de encabezado (mismo numero de corchetes, contenedor
    distinto segun el nombre del campo)."""
    datos = _datos_minimos_32(**{
        'NumeroLinea[2]': 2, 'IndicadorFacturacion[2]': 4,
        'NombreItem[2]': 'PRODUCTO ZZTEST EXENTO',
        'IndicadorBienoServicio[2]': 1, 'CantidadItem[2]': '1.00',
        'PrecioUnitarioItem[2]': '180.00', 'MontoItem[2]': '180.00',
    })
    xml_str = ecf_builder.construir_ecf_generico(32, 'E320000000006', datos)
    _validar_estructura_contra_xsd(xml_str, 32)
    root = etree.fromstring(xml_str.encode('utf-8'))
    items = root.findall('.//DetallesItems/Item')
    assert len(items) == 2
    assert items[0].findtext('NumeroLinea') == '1'
    assert items[0].findtext('NombreItem') == 'PRODUCTO ZZTEST'
    assert items[1].findtext('NumeroLinea') == '2'
    assert items[1].findtext('NombreItem') == 'PRODUCTO ZZTEST EXENTO'
    assert items[1].findtext('IndicadorFacturacion') == '4'


def test_parser_subgrupo_de_item_dos_corchetes():
    """Profundidad 2 (sub-grupo repetido DENTRO de una linea):
    TipoCodigo[1][1]/CodigoItem[1][1] + TipoCodigo[1][2]/CodigoItem[1][2]
    arman DOS <CodigosItem> dentro de TablaCodigosItem del Item[1] (no
    afecta a otras lineas)."""
    datos = _datos_minimos_32(**{
        'TipoCodigo[1][1]': 'COD1', 'CodigoItem[1][1]': 'ABC123',
        'TipoCodigo[1][2]': 'COD2', 'CodigoItem[1][2]': 'XYZ789',
    })
    xml_str = ecf_builder.construir_ecf_generico(32, 'E320000000006', datos)
    _validar_estructura_contra_xsd(xml_str, 32)
    root = etree.fromstring(xml_str.encode('utf-8'))
    codigos = root.findall('.//DetallesItems/Item[1]/TablaCodigosItem/CodigosItem')
    assert len(codigos) == 2
    assert codigos[0].findtext('TipoCodigo') == 'COD1'
    assert codigos[0].findtext('CodigoItem') == 'ABC123'
    assert codigos[1].findtext('TipoCodigo') == 'COD2'
    assert codigos[1].findtext('CodigoItem') == 'XYZ789'


def test_valor_hashtag_e_se_trata_como_vacio():
    """NOTAS.md #4: '#e' en una celda del Excel significa "campo vacio / no
    aplica", no un string literal -- debe omitirse igual que None."""
    datos = _datos_minimos_32(NombreComercial='#e', Municipio='#e')
    xml_str = ecf_builder.construir_ecf_generico(32, 'E320000000006', datos)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.find('.//Emisor/NombreComercial') is None
    assert root.find('.//Emisor/Municipio') is None


def test_encf_de_datos_se_ignora_usa_el_parametro_explicito():
    """NOTAS.md #5: si el operador pega tambien 'ENCF'/'CasoPrueba' dentro
    de 'datos' (copia literal de la fila), el builder debe ignorarlos y
    usar el parametro e_ncf explicito como fuente de verdad."""
    datos = _datos_minimos_32(**{'ENCF': 'E320000099999', 'CasoPrueba': 'E320000099999'})
    xml_str = ecf_builder.construir_ecf_generico(32, 'E320000000006', datos)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//IdDoc/eNCF') == 'E320000000006'


def test_encf_invalido_lanza_error():
    with pytest.raises(ecf_builder.ECFBuilderError, match='eNCF'):
        ecf_builder.construir_ecf_generico(32, 'CORTO', _datos_minimos_32())


def test_tipo_ecf_no_soportado_lanza_error():
    with pytest.raises(ecf_builder.ECFBuilderError, match='no soportado'):
        ecf_builder.construir_ecf_generico(99, 'E990000000001', _datos_minimos_32())


def test_sin_lineas_lanza_error():
    datos = _datos_minimos_32()
    for k in list(datos):
        if k.startswith(('NumeroLinea', 'IndicadorFacturacion', 'NombreItem',
                         'IndicadorBienoServicio', 'CantidadItem',
                         'PrecioUnitarioItem', 'MontoItem')):
            del datos[k]
    with pytest.raises(ecf_builder.ECFBuilderError, match='DetallesItems'):
        ecf_builder.construir_ecf_generico(32, 'E320000000006', datos)


def test_rnc_emisor_faltante_lanza_error():
    datos = _datos_minimos_32()
    del datos['RNCEmisor']
    with pytest.raises(ecf_builder.ECFBuilderError, match='RNCEmisor'):
        ecf_builder.construir_ecf_generico(32, 'E320000000006', datos)


def test_monto_total_numero_json_crudo_se_formatea_a_2_decimales():
    """Si el operador pega un numero JSON crudo (no string) para un campo
    monetario, se formatea con 2 decimales -- si pega el string ya
    formateado del Excel, se respeta tal cual (ver docstring de
    _valor_texto)."""
    datos = _datos_minimos_32(MontoTotal=1180)
    xml_str = ecf_builder.construir_ecf_generico(32, 'E320000000006', datos)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//Totales/MontoTotal') == '1180.00'


# ---------------------------------------------------------------------------
# 2. Un test por cada uno de los 10 valores de TipoeCF -- construye un
#    documento minimo valido y lo valida contra SU PROPIO XSD real.
# ---------------------------------------------------------------------------

def test_tipo_31_credito_fiscal_valida_contra_xsd():
    datos = {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'FechaVencimientoSecuencia': '31-12-2028',
        'TipoIngresos': '01', 'TipoPago': 2,
        'RNCComprador': '101623232', 'RazonSocialComprador': 'CLIENTE DE PRUEBA',
        'MontoTotal': '1180.00', 'TotalITBIS': '180.00',
        'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1,
        'NombreItem[1]': 'PRODUCTO ZZTEST', 'IndicadorBienoServicio[1]': 1,
        'CantidadItem[1]': '1.00', 'PrecioUnitarioItem[1]': '1000.00',
        'MontoItem[1]': '1000.00',
    }
    xml_str = ecf_builder.construir_ecf_generico(31, 'E310000000001', datos)
    _validar_estructura_contra_xsd(xml_str, 31)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//IdDoc/TipoeCF') == '31'
    assert root.findtext('.//IdDoc/FechaVencimientoSecuencia') == '31-12-2028'
    assert root.findtext('.//Comprador/RNCComprador') == '101623232'


def test_tipo_31_sin_fecha_vencimiento_secuencia_lanza_error():
    datos = {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'TipoPago': 2, 'RNCComprador': '101623232', 'RazonSocialComprador': 'X',
        'MontoTotal': '100.00', 'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1,
        'NombreItem[1]': 'X', 'IndicadorBienoServicio[1]': 1, 'CantidadItem[1]': '1.00',
        'PrecioUnitarioItem[1]': '100.00', 'MontoItem[1]': '100.00',
    }
    with pytest.raises(ecf_builder.ECFBuilderError, match='FechaVencimientoSecuencia'):
        ecf_builder.construir_ecf_generico(31, 'E310000000001', datos)


def test_tipo_31_sin_rnc_comprador_lanza_error():
    datos = {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'FechaVencimientoSecuencia': '31-12-2028', 'TipoPago': 2,
        'MontoTotal': '100.00', 'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1,
        'NombreItem[1]': 'X', 'IndicadorBienoServicio[1]': 1, 'CantidadItem[1]': '1.00',
        'PrecioUnitarioItem[1]': '100.00', 'MontoItem[1]': '100.00',
    }
    with pytest.raises(ecf_builder.ECFBuilderError, match='RNCComprador'):
        ecf_builder.construir_ecf_generico(31, 'E310000000001', datos)


def test_tipo_32_consumo_sin_comprador_valida_contra_xsd():
    xml_str = ecf_builder.construir_ecf_generico(32, 'E320000000006', _datos_minimos_32())
    _validar_estructura_contra_xsd(xml_str, 32)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//IdDoc/TipoeCF') == '32'
    assert root.find('.//IdDoc/FechaVencimientoSecuencia') is None


def test_tipo_33_nota_debito_valida_contra_xsd():
    datos = {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'FechaVencimientoSecuencia': '31-12-2028', 'TipoPago': 1,
        'MontoTotal': '100.00',
        'NCFModificado': 'E320000000006', 'FechaNCFModificado': '01-12-2028',
        'CodigoModificacion': '1',
        'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1,
        'NombreItem[1]': 'AJUSTE ZZTEST', 'IndicadorBienoServicio[1]': 1,
        'CantidadItem[1]': '1.00', 'PrecioUnitarioItem[1]': '100.00',
        'MontoItem[1]': '100.00',
    }
    xml_str = ecf_builder.construir_ecf_generico(33, 'E330000000001', datos)
    _validar_estructura_contra_xsd(xml_str, 33)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//IdDoc/TipoeCF') == '33'
    assert root.findtext('.//InformacionReferencia/NCFModificado') == 'E320000000006'


def test_tipo_33_sin_informacion_referencia_lanza_error():
    datos = {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'FechaVencimientoSecuencia': '31-12-2028', 'TipoPago': 1, 'MontoTotal': '100.00',
        'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1, 'NombreItem[1]': 'X',
        'IndicadorBienoServicio[1]': 1, 'CantidadItem[1]': '1.00',
        'PrecioUnitarioItem[1]': '100.00', 'MontoItem[1]': '100.00',
    }
    with pytest.raises(ecf_builder.ECFBuilderError, match='InformacionReferencia'):
        ecf_builder.construir_ecf_generico(33, 'E330000000001', datos)


def test_tipo_34_nota_credito_valida_contra_xsd():
    datos = {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'IndicadorNotaCredito': 1, 'TipoPago': 1, 'MontoTotal': '100.00',
        'NCFModificado': 'E340000000013', 'FechaNCFModificado': '01-12-2028',
        'CodigoModificacion': '1',
        'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1,
        'NombreItem[1]': 'DEVOLUCION ZZTEST', 'IndicadorBienoServicio[1]': 1,
        'CantidadItem[1]': '1.00', 'PrecioUnitarioItem[1]': '100.00',
        'MontoItem[1]': '100.00',
    }
    xml_str = ecf_builder.construir_ecf_generico(34, 'E340000000013', datos)
    _validar_estructura_contra_xsd(xml_str, 34)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//IdDoc/TipoeCF') == '34'
    assert root.findtext('.//IdDoc/IndicadorNotaCredito') == '1'
    assert root.find('.//IdDoc/FechaVencimientoSecuencia') is None
    assert root.find('.//IdDoc/TablaFormasPago') is None


def test_tipo_34_sin_indicador_nota_credito_lanza_error():
    datos = {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'TipoPago': 1, 'MontoTotal': '100.00',
        'NCFModificado': 'E340000000013', 'FechaNCFModificado': '01-12-2028',
        'CodigoModificacion': '1', 'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1,
        'NombreItem[1]': 'X', 'IndicadorBienoServicio[1]': 1, 'CantidadItem[1]': '1.00',
        'PrecioUnitarioItem[1]': '100.00', 'MontoItem[1]': '100.00',
    }
    with pytest.raises(ecf_builder.ECFBuilderError, match='IndicadorNotaCredito'):
        ecf_builder.construir_ecf_generico(34, 'E340000000013', datos)


def test_tipo_41_compras_valida_contra_xsd():
    datos = {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'FechaVencimientoSecuencia': '31-12-2028',
        'RNCComprador': '101623232', 'RazonSocialComprador': 'PROVEEDOR ZZTEST',
        'MontoTotal': '100.00',
        'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1,
        'IndicadorAgenteRetencionoPercepcion[1]': 1,
        'NombreItem[1]': 'COMPRA ZZTEST', 'IndicadorBienoServicio[1]': 1,
        'CantidadItem[1]': '1.00', 'PrecioUnitarioItem[1]': '100.00',
        'MontoItem[1]': '100.00',
    }
    xml_str = ecf_builder.construir_ecf_generico(41, 'E410000000008', datos)
    _validar_estructura_contra_xsd(xml_str, 41)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//IdDoc/TipoeCF') == '41'
    assert root.find('.//IdDoc/TipoIngresos') is None
    assert root.findtext('.//DetallesItems/Item/Retencion/IndicadorAgenteRetencionoPercepcion') == '1'


def test_tipo_41_sin_indicador_agente_retencion_lanza_error():
    """e-CF-41: Item/Retencion/IndicadorAgenteRetencionoPercepcion es
    minOccurs=1 (a diferencia de 31/33/34 donde todo el bloque Retencion es
    opcional) -- confirmado leyendo e-CF-41-v1.0.xsd."""
    datos = {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'FechaVencimientoSecuencia': '31-12-2028',
        'RNCComprador': '101623232', 'RazonSocialComprador': 'PROVEEDOR ZZTEST',
        'MontoTotal': '100.00', 'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1,
        'NombreItem[1]': 'X', 'IndicadorBienoServicio[1]': 1, 'CantidadItem[1]': '1.00',
        'PrecioUnitarioItem[1]': '100.00', 'MontoItem[1]': '100.00',
    }
    with pytest.raises(ecf_builder.ECFBuilderError, match='IndicadorAgenteRetencionoPercepcion'):
        ecf_builder.construir_ecf_generico(41, 'E410000000008', datos)


def test_tipo_43_gastos_menores_valida_contra_xsd():
    datos = {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'FechaVencimientoSecuencia': '31-12-2028',
        'MontoTotal': '500.00',
        'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1,
        'NombreItem[1]': 'GASTO MENOR ZZTEST', 'IndicadorBienoServicio[1]': 2,
        'CantidadItem[1]': '1.00', 'PrecioUnitarioItem[1]': '500.00',
        'MontoItem[1]': '500.00',
    }
    xml_str = ecf_builder.construir_ecf_generico(43, 'E430000000001', datos)
    _validar_estructura_contra_xsd(xml_str, 43)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//IdDoc/TipoeCF') == '43'
    assert root.find('.//Comprador') is None


def test_tipo_43_ignora_rnc_comprador_no_existe_elemento_comprador():
    """e-CF-43-v1.0.xsd no tiene el elemento Comprador en absoluto -- aunque
    el operador pegue RNCComprador/RazonSocialComprador (por copiar
    columnas de mas de otra fila), el builder no debe emitir <Comprador>."""
    datos = {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'FechaVencimientoSecuencia': '31-12-2028', 'RNCComprador': '101623232',
        'RazonSocialComprador': 'NO DEBE APARECER', 'MontoTotal': '500.00',
        'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1, 'NombreItem[1]': 'X',
        'IndicadorBienoServicio[1]': 2, 'CantidadItem[1]': '1.00',
        'PrecioUnitarioItem[1]': '500.00', 'MontoItem[1]': '500.00',
    }
    xml_str = ecf_builder.construir_ecf_generico(43, 'E430000000001', datos)
    _validar_estructura_contra_xsd(xml_str, 43)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.find('.//Comprador') is None


def test_tipo_44_regimenes_especiales_valida_contra_xsd():
    datos = {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'FechaVencimientoSecuencia': '31-12-2028', 'TipoIngresos': '01', 'TipoPago': 1,
        'RazonSocialComprador': 'ZONA FRANCA ZZTEST', 'MontoTotal': '1000.00',
        'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1,
        'NombreItem[1]': 'PRODUCTO ZZTEST', 'IndicadorBienoServicio[1]': 1,
        'CantidadItem[1]': '1.00', 'PrecioUnitarioItem[1]': '1000.00',
        'MontoItem[1]': '1000.00',
    }
    xml_str = ecf_builder.construir_ecf_generico(44, 'E440000000013', datos)
    _validar_estructura_contra_xsd(xml_str, 44)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//IdDoc/TipoeCF') == '44'
    assert root.findtext('.//Comprador/RazonSocialComprador') == 'ZONA FRANCA ZZTEST'
    assert root.find('.//Comprador/RNCComprador') is None


def test_tipo_45_gubernamental_valida_contra_xsd():
    datos = {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'FechaVencimientoSecuencia': '31-12-2028', 'TipoIngresos': '01', 'TipoPago': 2,
        'RNCComprador': '401500001', 'RazonSocialComprador': 'MINISTERIO ZZTEST',
        'MontoTotal': '2000.00',
        'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1,
        'NombreItem[1]': 'SERVICIO ZZTEST', 'IndicadorBienoServicio[1]': 2,
        'CantidadItem[1]': '1.00', 'PrecioUnitarioItem[1]': '2000.00',
        'MontoItem[1]': '2000.00',
    }
    xml_str = ecf_builder.construir_ecf_generico(45, 'E450000000003', datos)
    _validar_estructura_contra_xsd(xml_str, 45)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//IdDoc/TipoeCF') == '45'
    assert root.findtext('.//Comprador/RNCComprador') == '401500001'


def test_tipo_46_exportaciones_valida_contra_xsd():
    datos = {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'FechaVencimientoSecuencia': '31-12-2028', 'TipoIngresos': '01', 'TipoPago': 1,
        'RazonSocialComprador': 'IMPORTADOR EXTRANJERO ZZTEST',
        'PaisDestino': 'ESTADOS UNIDOS',
        'MontoTotal': '5000.00',
        'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 0,
        'NombreItem[1]': 'PRODUCTO EXPORTACION ZZTEST', 'IndicadorBienoServicio[1]': 1,
        'CantidadItem[1]': '1.00', 'PrecioUnitarioItem[1]': '5000.00',
        'MontoItem[1]': '5000.00',
    }
    xml_str = ecf_builder.construir_ecf_generico(46, 'E460000000009', datos)
    _validar_estructura_contra_xsd(xml_str, 46)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//IdDoc/TipoeCF') == '46'
    assert root.findtext('.//Transporte/PaisDestino') == 'ESTADOS UNIDOS'
    assert root.find('.//Comprador/RNCComprador') is None


def test_tipo_47_pagos_al_exterior_valida_contra_xsd():
    datos = {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'FechaVencimientoSecuencia': '31-12-2028',
        'IdentificadorExtranjero': 'FOREIGN-ID-1',
        'RazonSocialComprador': 'BENEFICIARIO EXTERIOR ZZTEST',
        'MontoTotal': '3000.00',
        'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 0,
        'IndicadorAgenteRetencionoPercepcion[1]': 1, 'MontoISRRetenido[1]': '300.00',
        'NombreItem[1]': 'PAGO SERVICIO EXTERIOR ZZTEST', 'IndicadorBienoServicio[1]': 2,
        'CantidadItem[1]': '1.00', 'PrecioUnitarioItem[1]': '3000.00',
        'MontoItem[1]': '3000.00',
    }
    xml_str = ecf_builder.construir_ecf_generico(47, 'E470000000001', datos)
    _validar_estructura_contra_xsd(xml_str, 47)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//IdDoc/TipoeCF') == '47'
    assert root.find('.//Comprador/RNCComprador') is None
    assert root.findtext('.//Comprador/IdentificadorExtranjero') == 'FOREIGN-ID-1'
    assert root.findtext('.//DetallesItems/Item/Retencion/MontoISRRetenido') == '300.00'


def test_tipo_47_sin_monto_isr_retenido_lanza_error():
    """e-CF-47: Item/Retencion/MontoISRRetenido es minOccurs=1 (a diferencia
    de 41, donde ese monto es opcional)."""
    datos = {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'FechaVencimientoSecuencia': '31-12-2028',
        'RazonSocialComprador': 'BENEFICIARIO EXTERIOR ZZTEST', 'MontoTotal': '3000.00',
        'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 0,
        'IndicadorAgenteRetencionoPercepcion[1]': 1,
        'NombreItem[1]': 'X', 'IndicadorBienoServicio[1]': 2, 'CantidadItem[1]': '1.00',
        'PrecioUnitarioItem[1]': '3000.00', 'MontoItem[1]': '3000.00',
    }
    with pytest.raises(ecf_builder.ECFBuilderError, match='MontoISRRetenido'):
        ecf_builder.construir_ecf_generico(47, 'E470000000001', datos)


@pytest.mark.parametrize('tipo_ecf', _TIPOS)
def test_todos_los_10_tipos_tienen_schema_cargable(tipo_ecf):
    """Verifica que los 10 XSD reales se pudieron cargar (sanity check del
    fixture de modulo _SCHEMA_POR_TIPO) -- si alguno fallara al cargar, los
    tests de arriba fallarian con un error de coleccion menos claro."""
    assert tipo_ecf in _SCHEMA_POR_TIPO
