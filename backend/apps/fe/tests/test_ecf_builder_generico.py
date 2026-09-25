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
        'FechaVencimientoSecuencia': '31-12-2028', 'TipoIngresos': '01', 'TipoPago': 2,
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
        'CodigoModificacion': '3',
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


# ---------------------------------------------------------------------------
# 3. Regresion de la revision de spec-compliance: 6 gaps criticos + 1
#    moderado donde _TIPO_CAPS no gateaba bloques que en algunos tipos NO
#    existen en absoluto en el XSD real (Transporte/InformacionesAdicionales
#    ausentes en 41/43/(47 parcial); OtraMoneda con campos distintos por
#    tipo; sub-bloques de Item ausentes en 41/43/44/46/47; TipoIngresos sin
#    exigir minOccurs=1). Filosofia del modulo: un campo que NO aplica al
#    tipo pedido se OMITE en silencio (igual que Comprador/RNCComprador ya
#    hace para otros tipos) en vez de fallar -- cada test de abajo prueba
#    que, aun con el campo invalido presente en 'datos', el XML resultante
#    sigue validando contra el XSD real de ese tipo Y que el elemento
#    invalido efectivamente no aparece (no es "valido por casualidad").
# ---------------------------------------------------------------------------

def _base_41():
    return {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'FechaVencimientoSecuencia': '31-12-2028',
        'RNCComprador': '101623232', 'RazonSocialComprador': 'PROVEEDOR ZZTEST',
        'MontoTotal': '100.00', 'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1,
        'IndicadorAgenteRetencionoPercepcion[1]': 1,
        'NombreItem[1]': 'X', 'IndicadorBienoServicio[1]': 1, 'CantidadItem[1]': '1.00',
        'PrecioUnitarioItem[1]': '100.00', 'MontoItem[1]': '100.00',
    }


def _base_43():
    return {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'FechaVencimientoSecuencia': '31-12-2028', 'MontoTotal': '500.00',
        'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1, 'NombreItem[1]': 'X',
        'IndicadorBienoServicio[1]': 2, 'CantidadItem[1]': '1.00',
        'PrecioUnitarioItem[1]': '500.00', 'MontoItem[1]': '500.00',
    }


def _base_44():
    return {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'FechaVencimientoSecuencia': '31-12-2028', 'TipoIngresos': '01', 'TipoPago': 1,
        'RazonSocialComprador': 'ZONA FRANCA ZZTEST', 'MontoTotal': '1000.00',
        'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1,
        'NombreItem[1]': 'PRODUCTO ZZTEST', 'IndicadorBienoServicio[1]': 1,
        'CantidadItem[1]': '1.00', 'PrecioUnitarioItem[1]': '1000.00',
        'MontoItem[1]': '1000.00',
    }


def _base_46():
    return {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'FechaVencimientoSecuencia': '31-12-2028', 'TipoIngresos': '01', 'TipoPago': 1,
        'RazonSocialComprador': 'IMPORTADOR EXTRANJERO ZZTEST', 'MontoTotal': '5000.00',
        'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 0,
        'NombreItem[1]': 'PRODUCTO EXPORTACION ZZTEST', 'IndicadorBienoServicio[1]': 1,
        'CantidadItem[1]': '1.00', 'PrecioUnitarioItem[1]': '5000.00',
        'MontoItem[1]': '5000.00',
    }


def _base_47():
    return {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'FechaVencimientoSecuencia': '31-12-2028',
        'RazonSocialComprador': 'BENEFICIARIO EXTERIOR ZZTEST', 'MontoTotal': '3000.00',
        'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 0,
        'IndicadorAgenteRetencionoPercepcion[1]': 1, 'MontoISRRetenido[1]': '300.00',
        'NombreItem[1]': 'X', 'IndicadorBienoServicio[1]': 2, 'CantidadItem[1]': '1.00',
        'PrecioUnitarioItem[1]': '3000.00', 'MontoItem[1]': '3000.00',
    }


# --- Finding 1: Transporte no existe en absoluto en 41/43 -----------------

@pytest.mark.parametrize('tipo_ecf,base', [(41, _base_41), (43, _base_43)])
def test_transporte_no_existe_en_41_y_43_aunque_haya_datos(tipo_ecf, base):
    datos = {**base(), 'Conductor': 'ZZTEST CONDUCTOR', 'Placa': 'A123456'}
    xml_str = ecf_builder.construir_ecf_generico(
        tipo_ecf, f'E{tipo_ecf:02d}0000000001', datos)
    _validar_estructura_contra_xsd(xml_str, tipo_ecf)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.find('.//Transporte') is None


# --- Finding 2: Transporte de 47 SOLO tiene PaisDestino --------------------

def test_transporte_de_47_solo_admite_paisdestino_no_conductor():
    datos = {**_base_47(), 'PaisDestino': 'ESTADOS UNIDOS', 'Conductor': 'NO DEBE APARECER',
             'Placa': 'A123456'}
    xml_str = ecf_builder.construir_ecf_generico(47, 'E470000000001', datos)
    _validar_estructura_contra_xsd(xml_str, 47)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//Transporte/PaisDestino') == 'ESTADOS UNIDOS'
    assert root.find('.//Transporte/Conductor') is None
    assert root.find('.//Transporte/Placa') is None


def test_paisdestino_se_emite_para_47_no_solo_para_46():
    """Bug de comentario/gate encontrado en la revision: el codigo original
    solo emitia PaisDestino para tipo_ecf==46 -- 47 (Pagos al Exterior,
    donde PaisDestino es semanticamente relevante: pais del beneficiario)
    lo perdia en silencio aunque el operador lo pegara en 'datos'."""
    datos = {**_base_47(), 'PaisDestino': 'ESPANA'}
    xml_str = ecf_builder.construir_ecf_generico(47, 'E470000000001', datos)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//Transporte/PaisDestino') == 'ESPANA'


# --- Finding 3: InformacionesAdicionales no existe en 41/43/47 ------------

@pytest.mark.parametrize('tipo_ecf,base', [(41, _base_41), (43, _base_43), (47, _base_47)])
def test_informaciones_adicionales_no_existe_en_41_43_47(tipo_ecf, base):
    datos = {**base(), 'FechaEmbarque': '01-12-2028', 'NumeroEmbarque': 'EMB-1'}
    xml_str = ecf_builder.construir_ecf_generico(
        tipo_ecf, f'E{tipo_ecf:02d}0000000001', datos)
    _validar_estructura_contra_xsd(xml_str, tipo_ecf)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.find('.//InformacionesAdicionales') is None


# --- Finding 4: OtraMoneda varia de verdad por tipo ------------------------

def test_otra_moneda_43_y_47_solo_admiten_4_campos():
    for tipo_ecf, base in ((43, _base_43), (47, _base_47)):
        datos = {**base(), 'TipoMoneda': 'USD', 'TipoCambio': '58.50',
                 'MontoExentoOtraMoneda': '10.00', 'MontoTotalOtraMoneda': '100.00',
                 'MontoGravadoTotalOtraMoneda': 'NO DEBE APARECER',
                 'TotalITBISOtraMoneda': 'NO DEBE APARECER'}
        xml_str = ecf_builder.construir_ecf_generico(
            tipo_ecf, f'E{tipo_ecf:02d}0000000001', datos)
        _validar_estructura_contra_xsd(xml_str, tipo_ecf)
        root = etree.fromstring(xml_str.encode('utf-8'))
        assert root.findtext('.//OtraMoneda/TipoMoneda') == 'USD'
        assert root.findtext('.//OtraMoneda/MontoTotalOtraMoneda') == '100.00'
        assert root.find('.//OtraMoneda/MontoGravadoTotalOtraMoneda') is None
        assert root.find('.//OtraMoneda/TotalITBISOtraMoneda') is None


def test_otra_moneda_44_solo_admite_3_campos_sin_monto_total():
    datos = {**_base_44(), 'TipoMoneda': 'USD', 'TipoCambio': '58.50',
             'MontoExentoOtraMoneda': '10.00',
             'MontoTotalOtraMoneda': 'NO DEBE APARECER',
             'TotalITBISOtraMoneda': 'NO DEBE APARECER'}
    xml_str = ecf_builder.construir_ecf_generico(44, 'E440000000013', datos)
    _validar_estructura_contra_xsd(xml_str, 44)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//OtraMoneda/TipoMoneda') == 'USD'
    assert root.findtext('.//OtraMoneda/MontoExentoOtraMoneda') == '10.00'
    assert root.find('.//OtraMoneda/MontoTotalOtraMoneda') is None
    assert root.find('.//OtraMoneda/TotalITBISOtraMoneda') is None


def test_otra_moneda_46_sin_monto_exento():
    datos = {**_base_46(), 'TipoMoneda': 'USD', 'TipoCambio': '58.50',
             'MontoGravadoTotalOtraMoneda': '90.00', 'MontoTotalOtraMoneda': '100.00',
             'MontoExentoOtraMoneda': 'NO DEBE APARECER'}
    xml_str = ecf_builder.construir_ecf_generico(46, 'E460000000009', datos)
    _validar_estructura_contra_xsd(xml_str, 46)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//OtraMoneda/MontoGravadoTotalOtraMoneda') == '90.00'
    assert root.find('.//OtraMoneda/MontoExentoOtraMoneda') is None


# --- Finding 5: DescuentosORecargos no existe en 43/47 ---------------------

@pytest.mark.parametrize('tipo_ecf,base', [(43, _base_43), (47, _base_47)])
def test_descuentos_o_recargos_no_existe_en_43_47(tipo_ecf, base):
    datos = {**base(), 'NumeroLineaDoR[1]': 1, 'TipoAjuste[1]': 1,
             'MontoDescuentooRecargo[1]': '10.00'}
    xml_str = ecf_builder.construir_ecf_generico(
        tipo_ecf, f'E{tipo_ecf:02d}0000000001', datos)
    _validar_estructura_contra_xsd(xml_str, tipo_ecf)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.find('.//DescuentosORecargos') is None


# --- Finding 6: sub-bloques de Item ausentes segun tipo --------------------

@pytest.mark.parametrize('tipo_ecf,base', [
    (41, _base_41), (43, _base_43), (44, _base_44), (46, _base_46), (47, _base_47)])
def test_item_bloque_referencia_ausente_fuera_de_31_32_33_34_45(tipo_ecf, base):
    """CantidadReferencia/UnidadReferencia/TablaSubcantidad/GradosAlcohol/
    PrecioUnitarioReferencia solo existen en 31/32/33/34/45."""
    datos = {**base(), 'CantidadReferencia[1]': '5.00', 'UnidadReferencia[1]': '1',
             'GradosAlcohol[1]': '10.00'}
    xml_str = ecf_builder.construir_ecf_generico(
        tipo_ecf, f'E{tipo_ecf:02d}0000000001', datos)
    _validar_estructura_contra_xsd(xml_str, tipo_ecf)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.find('.//DetallesItems/Item/CantidadReferencia') is None
    assert root.find('.//DetallesItems/Item/GradosAlcohol') is None


@pytest.mark.parametrize('tipo_ecf,base', [(43, _base_43), (47, _base_47)])
def test_item_bloque_descuento_recargo_ausente_en_43_47(tipo_ecf, base):
    datos = {**base(), 'DescuentoMonto[1]': '5.00', 'RecargoMonto[1]': '2.00',
             'TipoSubDescuento[1][1]': 1, 'MontoSubDescuento[1][1]': '5.00'}
    xml_str = ecf_builder.construir_ecf_generico(
        tipo_ecf, f'E{tipo_ecf:02d}0000000001', datos)
    _validar_estructura_contra_xsd(xml_str, tipo_ecf)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.find('.//DetallesItems/Item/DescuentoMonto') is None
    assert root.find('.//DetallesItems/Item/TablaSubDescuento') is None
    assert root.find('.//DetallesItems/Item/RecargoMonto') is None


@pytest.mark.parametrize('tipo_ecf,base', [
    (41, _base_41), (43, _base_43), (46, _base_46), (47, _base_47)])
def test_item_tabla_impuesto_adicional_ausente_fuera_de_31_32_33_34_44_45(tipo_ecf, base):
    datos = {**base(), 'TipoImpuesto[1][1]': '001'}
    xml_str = ecf_builder.construir_ecf_generico(
        tipo_ecf, f'E{tipo_ecf:02d}0000000001', datos)
    _validar_estructura_contra_xsd(xml_str, tipo_ecf)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.find('.//DetallesItems/Item/TablaImpuestoAdicional') is None


def test_item_bloques_opcionales_completos_se_emiten_para_31():
    """Contraste positivo: 31 SI tiene los 3 bloques (referencia,
    descuento/recargo, impuesto adicional) -- confirma que el gate no los
    esta bloqueando de mas para los tipos que si los soportan."""
    datos = {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'FechaVencimientoSecuencia': '31-12-2028', 'TipoIngresos': '01', 'TipoPago': 1,
        'RNCComprador': '101623232', 'RazonSocialComprador': 'CLIENTE DE PRUEBA',
        'MontoTotal': '1000.00',
        'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1, 'NombreItem[1]': 'X',
        'IndicadorBienoServicio[1]': 1, 'CantidadItem[1]': '1.00',
        'CantidadReferencia[1]': '5.00', 'UnidadReferencia[1]': '1',
        'PrecioUnitarioItem[1]': '1000.00', 'DescuentoMonto[1]': '10.00',
        'TipoImpuesto[1][1]': '001', 'MontoItem[1]': '1000.00',
    }
    xml_str = ecf_builder.construir_ecf_generico(31, 'E310000000001', datos)
    _validar_estructura_contra_xsd(xml_str, 31)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.find('.//DetallesItems/Item/CantidadReferencia') is not None
    assert root.find('.//DetallesItems/Item/DescuentoMonto') is not None
    assert root.find('.//DetallesItems/Item/TablaImpuestoAdicional') is not None


# --- Finding 7 (moderado): TipoIngresos mandatoriness ----------------------

@pytest.mark.parametrize('tipo_ecf,base', [
    (31, None), (32, None), (44, _base_44), (45, None), (46, _base_46)])
def test_tipo_ingresos_obligatorio_en_31_32_44_45_46(tipo_ecf, base):
    if tipo_ecf == 31:
        datos = {
            'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
            'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
            'FechaVencimientoSecuencia': '31-12-2028', 'TipoPago': 2,
            'RNCComprador': '101623232', 'RazonSocialComprador': 'X',
            'MontoTotal': '100.00', 'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1,
            'NombreItem[1]': 'X', 'IndicadorBienoServicio[1]': 1, 'CantidadItem[1]': '1.00',
            'PrecioUnitarioItem[1]': '100.00', 'MontoItem[1]': '100.00',
        }
    elif tipo_ecf == 32:
        datos = _datos_minimos_32()
        del datos['TipoIngresos']
    elif tipo_ecf == 45:
        datos = {
            'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
            'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
            'FechaVencimientoSecuencia': '31-12-2028', 'TipoPago': 2,
            'RNCComprador': '401500001', 'RazonSocialComprador': 'MINISTERIO ZZTEST',
            'MontoTotal': '2000.00', 'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1,
            'NombreItem[1]': 'X', 'IndicadorBienoServicio[1]': 2, 'CantidadItem[1]': '1.00',
            'PrecioUnitarioItem[1]': '2000.00', 'MontoItem[1]': '2000.00',
        }
    else:
        datos = base()
        datos.pop('TipoIngresos', None)
    with pytest.raises(ecf_builder.ECFBuilderError, match='TipoIngresos'):
        ecf_builder.construir_ecf_generico(
            tipo_ecf, f'E{tipo_ecf:02d}0000000001', datos)


def test_tipo_ingresos_opcional_en_33_y_34_no_lanza_error():
    """Contraste con el finding moderado: 33/34 tienen el elemento
    TipoIngresos (``caps['tipo_ingresos']=True``) pero es minOccurs=0 -- no
    debe fallar si 'datos' no lo trae (a diferencia de 31/32/44/45/46)."""
    datos_33 = {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'FechaVencimientoSecuencia': '31-12-2028', 'TipoPago': 1, 'MontoTotal': '100.00',
        'NCFModificado': 'E320000000006', 'FechaNCFModificado': '01-12-2028',
        'CodigoModificacion': '3', 'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1,
        'NombreItem[1]': 'X', 'IndicadorBienoServicio[1]': 1, 'CantidadItem[1]': '1.00',
        'PrecioUnitarioItem[1]': '100.00', 'MontoItem[1]': '100.00',
    }
    xml_str = ecf_builder.construir_ecf_generico(33, 'E330000000001', datos_33)
    _validar_estructura_contra_xsd(xml_str, 33)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.find('.//IdDoc/TipoIngresos') is None

    datos_34 = {
        'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA, SRL',
        'DireccionEmisor': 'AV ZZTEST #1, SANTO DOMINGO', 'FechaEmision': '31-12-2028',
        'IndicadorNotaCredito': 1, 'TipoPago': 1, 'MontoTotal': '100.00',
        'NCFModificado': 'E340000000013', 'FechaNCFModificado': '01-12-2028',
        'CodigoModificacion': '1', 'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1,
        'NombreItem[1]': 'X', 'IndicadorBienoServicio[1]': 1, 'CantidadItem[1]': '1.00',
        'PrecioUnitarioItem[1]': '100.00', 'MontoItem[1]': '100.00',
    }
    xml_str = ecf_builder.construir_ecf_generico(34, 'E340000000013', datos_34)
    _validar_estructura_contra_xsd(xml_str, 34)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.find('.//IdDoc/TipoIngresos') is None


# Payload REAL para el envio de la 5ta corrida a certecf (Fase 4, 32>=250K
# con RNC de un cliente CXC real -- CONSORCIO RYLCO, RNC 131376292). Este
# test es el "gate XSD-local" obligatorio nuevo (ver plan maestro Fase 4
# Hallazgos 4ta corrida, "Regla nueva: nunca enviar un e-CF a certecf sin
# validar el XML contra el XSD real localmente primero" -- costo de un
# rechazo en Fase 4 = todos los aceptados hasta ese momento, no solo la
# secuencia). Este payload es el mismo que consume el POST paso4-manual.
_PAYLOAD_32_MAYOR_250K_CORRIDA_5 = {
    'RNCEmisor': '130217432',
    'RazonSocialEmisor': 'ABREGONZA COMERCIAL SRL',
    'DireccionEmisor': 'AV LOPE DE VEGA #55, ENSANCHE NACO, SANTO DOMINGO',
    'FechaEmision': '23-09-2026',
    'TipoIngresos': '01',
    'TipoPago': 1,
    'IndicadorMontoGravado': 0,
    'RNCComprador': '131376292',
    'RazonSocialComprador': 'CONSORCIO RYLCO & ASOCIADOS',
    'MontoGravadoTotal': '250000.00',
    'MontoGravadoI1': '250000.00',
    'ITBIS1': '18',
    'TotalITBIS': '45000.00',
    'TotalITBIS1': '45000.00',
    'MontoTotal': '295000.00',
    'NumeroLinea[1]': 1,
    'IndicadorFacturacion[1]': 1,
    'NombreItem[1]': 'Servicio profesional',
    'IndicadorBienoServicio[1]': 2,
    'CantidadItem[1]': '1.00',
    'PrecioUnitarioItem[1]': '250000.00',
    'MontoItem[1]': '250000.00',
}


def test_payload_corrida5_tipo_32_mayor_250k_valida_contra_xsd():
    """Gate XSD-local para el envio real de la 5ta corrida (32>=250K con
    RNCComprador 131376292 CONSORCIO RYLCO). Debe validar contra el XSD
    real e-CF-32-v1.0.xsd antes de disparar el POST a paso4-manual --
    reduce a cero el riesgo de un rechazo estructural que borre los
    contadores otra vez."""
    xml_str = ecf_builder.construir_ecf_generico(
        32, 'E320000001005', _PAYLOAD_32_MAYOR_250K_CORRIDA_5)
    _validar_estructura_contra_xsd(xml_str, 32)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//IdDoc/TipoeCF') == '32'
    assert root.findtext('.//IdDoc/IndicadorMontoGravado') == '0'
    assert root.findtext('.//Comprador/RNCComprador') == '131376292'
    assert root.findtext('.//Comprador/RazonSocialComprador') == 'CONSORCIO RYLCO & ASOCIADOS'
    assert root.findtext('.//Totales/MontoGravadoTotal') == '250000.00'
    assert root.findtext('.//Totales/MontoGravadoI1') == '250000.00'
    assert root.findtext('.//Totales/ITBIS1') == '18'
    assert root.findtext('.//Totales/TotalITBIS') == '45000.00'
    assert root.findtext('.//Totales/TotalITBIS1') == '45000.00'
    assert root.findtext('.//Totales/MontoTotal') == '295000.00'
    # Orden estricto del bloque Totales segun el XSD (lección de la 2da
    # corrida): MontoGravadoTotal, MontoGravadoI1..I3, MontoExento,
    # ITBIS1..3, TotalITBIS, TotalITBIS1..3, ..., MontoTotal.
    totales = root.find('.//Totales')
    hijos = [t.tag for t in totales]
    orden_esperado = ['MontoGravadoTotal', 'MontoGravadoI1', 'ITBIS1',
                      'TotalITBIS', 'TotalITBIS1', 'MontoTotal']
    posiciones = [hijos.index(t) for t in orden_esperado]
    assert posiciones == sorted(posiciones), (
        f"Totales fuera de orden XSD: {hijos}")


# Payload REAL para el 2do 32>=250K de la 6ta corrida (Fase 4). Usa otro
# cliente CXC real distinto del de la 5ta corrida (COMERCIAL VALOIS, cliente
# #1 de CXC.TCXC_CLIENTE, RNC 131175341) para no duplicar RNCComprador. El
# builder ya quedo confirmado contra certecf en la 5ta corrida
# (E320000001005 Aceptado) -- este payload solo cambia RNC/RazonSocial, la
# estructura del XML es identica; el gate XSD-local sigue siendo obligatorio
# antes de disparar el POST a certecf.
_PAYLOAD_32_MAYOR_250K_CORRIDA_6 = {
    'RNCEmisor': '130217432',
    'RazonSocialEmisor': 'ABREGONZA COMERCIAL SRL',
    'DireccionEmisor': 'AV LOPE DE VEGA #55, ENSANCHE NACO, SANTO DOMINGO',
    'FechaEmision': '24-09-2026',
    'TipoIngresos': '01',
    'TipoPago': 1,
    'IndicadorMontoGravado': 0,
    'RNCComprador': '131175341',
    'RazonSocialComprador': 'COMERCIAL VALOIS',
    'MontoGravadoTotal': '260000.00',
    'MontoGravadoI1': '260000.00',
    'ITBIS1': '18',
    'TotalITBIS': '46800.00',
    'TotalITBIS1': '46800.00',
    'MontoTotal': '306800.00',
    'NumeroLinea[1]': 1,
    'IndicadorFacturacion[1]': 1,
    'NombreItem[1]': 'Servicio profesional',
    'IndicadorBienoServicio[1]': 2,
    'CantidadItem[1]': '1.00',
    'PrecioUnitarioItem[1]': '260000.00',
    'MontoItem[1]': '260000.00',
}


def test_payload_corrida6_tipo_32_mayor_250k_valida_contra_xsd():
    """Gate XSD-local para el 2do 32>=250K (COMERCIAL VALOIS 131175341).
    Estructura identica a la 5ta corrida (ya Aceptada por certecf), solo
    cambia RNCComprador/RazonSocial/monto. Sigue siendo obligatorio validar
    contra el XSD real antes de disparar el POST -- una regresion silenciosa
    en el builder generico borraria los 5 aceptados que hay hasta ahora."""
    xml_str = ecf_builder.construir_ecf_generico(
        32, 'E320000001006', _PAYLOAD_32_MAYOR_250K_CORRIDA_6)
    _validar_estructura_contra_xsd(xml_str, 32)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//IdDoc/TipoeCF') == '32'
    assert root.findtext('.//IdDoc/IndicadorMontoGravado') == '0'
    assert root.findtext('.//Comprador/RNCComprador') == '131175341'
    assert root.findtext('.//Comprador/RazonSocialComprador') == 'COMERCIAL VALOIS'
    assert root.findtext('.//Totales/MontoGravadoTotal') == '260000.00'
    assert root.findtext('.//Totales/MontoGravadoI1') == '260000.00'
    assert root.findtext('.//Totales/ITBIS1') == '18'
    assert root.findtext('.//Totales/TotalITBIS') == '46800.00'
    assert root.findtext('.//Totales/TotalITBIS1') == '46800.00'
    assert root.findtext('.//Totales/MontoTotal') == '306800.00'
    totales = root.find('.//Totales')
    hijos = [t.tag for t in totales]
    orden_esperado = ['MontoGravadoTotal', 'MontoGravadoI1', 'ITBIS1',
                      'TotalITBIS', 'TotalITBIS1', 'MontoTotal']
    posiciones = [hijos.index(t) for t in orden_esperado]
    assert posiciones == sorted(posiciones), (
        f"Totales fuera de orden XSD: {hijos}")


# Payload REAL para el 1x33 (Nota de Debito) de la 7ma corrida (Fase 4,
# grupo "Segundo"). NCFModificado = E310000000061 (1er 31 aceptado de la
# 5ta corrida, FC-0007829, RNCComprador 131265863 EMPRESA DISTRIBUIDORA Y
# SERVICIO PAE SRL, FechaEmision 20-11-2025 -- todos datos reales leidos
# de FAT.TFE_DOCUMENTO). Monto pequeno realista (RD$5,000 base + 18% ITBIS
# = RD$5,900 total) porque una Nota de Debito de "diferencia de precio"
# tipicamente es un ajuste menor sobre la factura original. Codigo
# Modificacion=1 + RazonModificacion literal para trazabilidad.
_PAYLOAD_33_CORRIDA_7 = {
    'RNCEmisor': '130217432',
    'RazonSocialEmisor': 'ABREGONZA COMERCIAL SRL',
    'DireccionEmisor': 'AV LOPE DE VEGA #55, ENSANCHE NACO, SANTO DOMINGO',
    'FechaEmision': '25-09-2026',
    'FechaVencimientoSecuencia': '31-12-2028',
    'TipoIngresos': '01',
    'TipoPago': 1,
    'IndicadorMontoGravado': 0,
    'RNCComprador': '131265863',
    'RazonSocialComprador': 'EMPRESA DISTRIBUIDORA Y SERVICIO PAE SRL',
    'MontoGravadoTotal': '5000.00',
    'MontoGravadoI1': '5000.00',
    'ITBIS1': '18',
    'TotalITBIS': '900.00',
    'TotalITBIS1': '900.00',
    'MontoTotal': '5900.00',
    'NCFModificado': 'E310000000061',
    'FechaNCFModificado': '20-11-2025',
    'CodigoModificacion': '1',
    'RazonModificacion': 'Ajuste por diferencia de precio en FC-0007829',
    'NumeroLinea[1]': 1,
    'IndicadorFacturacion[1]': 1,
    'NombreItem[1]': 'Ajuste por diferencia de precio',
    'IndicadorBienoServicio[1]': 2,
    'CantidadItem[1]': '1.00',
    'PrecioUnitarioItem[1]': '5000.00',
    'MontoItem[1]': '5000.00',
}


def test_payload_corrida7_tipo_33_codigo_modificacion_1_es_rechazado_por_builder():
    """Documenta el rechazo real de la 7ma corrida y verifica que el builder
    ahora bloquea localmente el error semantico. El payload de la 7ma
    corrida uso CodigoModificacion=1 (Anula el NCF modificado) con
    tipo_ecf=33 (Nota de Debito) -- inconsistente porque una Nota de Debito
    AGREGA cargos, no anula. Certecf rechazo el envio con codigo interno 64
    + mensaje vacio y reinicio TODOS los contadores de Fase 4 (6 aceptados
    perdidos: 4x31 + 2x32>=250K). El builder ahora levanta ECFBuilderError
    ANTES de generar el XML para prevenir la repeticion del mismo error."""
    with pytest.raises(ecf_builder.ECFBuilderError) as exc:
        ecf_builder.construir_ecf_generico(
            33, 'E330000000001', _PAYLOAD_33_CORRIDA_7)
    mensaje = str(exc.value)
    assert 'CodigoModificacion=1' in mensaje
    assert '33' in mensaje


# Payload corregido para el 1x33 (Nota de Debito), 8va corrida. Mismos
# datos que la 7ma corrida (NCFModificado=E310000000061, monto RD$5,900),
# pero con CodigoModificacion=3 (Corrige montos del NCF modificado) que es
# el codigo semanticamente correcto para una Nota de Debito -- una Nota
# de Debito por definicion corrige montos hacia ARRIBA (agrega cargos
# faltantes a la factura original), por eso el codigo 3 encaja natural. La
# 7ma corrida uso codigo=1 (Anula) y certecf rechazo con codigo interno 64
# + mensaje vacio. Ver plan maestro seccion "Bloqueos activos" 2026-09-25
# para el detalle completo del rechazo.
_PAYLOAD_33_CORRIDA_8 = {
    **_PAYLOAD_33_CORRIDA_7,
    'CodigoModificacion': '3',
    'RazonModificacion': 'Correccion de monto por diferencia de precio en FC-0007829',
}


def test_payload_corrida8_tipo_33_codigo_modificacion_3_valida_contra_xsd():
    """Gate XSD-local obligatorio para el 1x33 corregido (8va corrida).
    Mismo NCFModificado real que la 7ma corrida (E310000000061) pero con
    CodigoModificacion=3 (Corrige montos) en vez de 1 (Anular). La proxima
    corrida real puede usar este payload para reintentar el envio a
    certecf una vez que el usuario valide la hipotesis del bloqueo. Sin
    este gate, un XML invalido llegaria a certecf y disparraria otro
    reinicio de contadores."""
    xml_str = ecf_builder.construir_ecf_generico(
        33, 'E330000000001', _PAYLOAD_33_CORRIDA_8)
    _validar_estructura_contra_xsd(xml_str, 33)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//IdDoc/TipoeCF') == '33'
    assert root.findtext('.//IdDoc/IndicadorMontoGravado') == '0'
    assert root.findtext('.//Comprador/RNCComprador') == '131265863'
    assert root.findtext('.//Comprador/RazonSocialComprador') == \
        'EMPRESA DISTRIBUIDORA Y SERVICIO PAE SRL'
    assert root.findtext('.//Totales/MontoGravadoTotal') == '5000.00'
    assert root.findtext('.//Totales/MontoGravadoI1') == '5000.00'
    assert root.findtext('.//Totales/ITBIS1') == '18'
    assert root.findtext('.//Totales/TotalITBIS') == '900.00'
    assert root.findtext('.//Totales/TotalITBIS1') == '900.00'
    assert root.findtext('.//Totales/MontoTotal') == '5900.00'
    assert root.findtext('.//InformacionReferencia/NCFModificado') == \
        'E310000000061'
    assert root.findtext('.//InformacionReferencia/FechaNCFModificado') == \
        '20-11-2025'
    assert root.findtext('.//InformacionReferencia/CodigoModificacion') == '3'
    totales = root.find('.//Totales')
    hijos = [t.tag for t in totales]
    orden_esperado = ['MontoGravadoTotal', 'MontoGravadoI1', 'ITBIS1',
                      'TotalITBIS', 'TotalITBIS1', 'MontoTotal']
    posiciones = [hijos.index(t) for t in orden_esperado]
    assert posiciones == sorted(posiciones), (
        f"Totales fuera de orden XSD: {hijos}")


def test_construir_ecf_generico_tipo_33_codigo_modificacion_2_permitido():
    """Codigo 2 (Corrige Texto) tambien es semanticamente valido para una
    Nota de Debito (menos comun, pero footnote 80 del Formato-e-CF-V1.0.pdf
    dice que codigos 1/2/3 aplican a notas 'segun corresponda'). El builder
    solo bloquea el codigo 1 (Anular) para tipo 33 porque una anulacion no
    encaja en la definicion de Nota de Debito (que agrega cargos)."""
    payload = {
        **_PAYLOAD_33_CORRIDA_7,
        'CodigoModificacion': '2',
    }
    xml_str = ecf_builder.construir_ecf_generico(
        33, 'E330000000001', payload)
    _validar_estructura_contra_xsd(xml_str, 33)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//InformacionReferencia/CodigoModificacion') == '2'


def test_construir_ecf_generico_tipo_34_codigo_modificacion_1_permitido():
    """Confirma que la validacion NO se aplica a tipo 34 (Nota de Credito):
    codigo 1 (Anular) es semanticamente valido para una Nota de Credito
    porque anular un NCF por su totalidad es un caso natural de emision de
    nota de credito. Regresion guard para no romper el 34 al arreglar el
    33."""
    payload_34 = {
        **_PAYLOAD_33_CORRIDA_7,
        'IndicadorNotaCredito': '0',
        'CodigoModificacion': '1',
    }
    xml_str = ecf_builder.construir_ecf_generico(
        34, 'E340000000052', payload_34)
    _validar_estructura_contra_xsd(xml_str, 34)
    root = etree.fromstring(xml_str.encode('utf-8'))
    assert root.findtext('.//InformacionReferencia/CodigoModificacion') == '1'
