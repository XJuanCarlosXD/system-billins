"""Tests de ``apps.fe.ecf_builder.construir_rfce`` y
``apps.fe.ecf_builder.derivar_codigo_seguridad`` (Task 5b: RFCE builder +
derivación del código de seguridad para las 4 Facturas de Consumo
Electrónica < RD$250,000 del Set de Pruebas Paso 2, hoja ``RFCE``).

Mismo patrón que ``test_ecf_builder_generico.py``: ``construir_rfce`` es una
función pura (dict -> XML) que no toca Oracle, y la prueba más valiosa es
validar el XML generado contra el XSD REAL descargado de la DGII
(``RFCE-32-v1.0.xsd``). ``derivar_codigo_seguridad`` tampoco toca Oracle ni
red -- solo parsea el ``<SignatureValue>`` de un XML ya firmado.

Los 4 escenarios reales (``E320000000012/013/014/015``) se extrajeron
programáticamente de ``set-pruebas-130217432.xlsx`` (hojas ``RFCE`` y
``ECF``) el 2026-09-08 -- ver el propio dict ``_ESCENARIOS_REALES`` abajo,
con el mismo gotcha de RNC ya documentado en
``resultados-paso2-20260904/README.md`` hallazgo #2 (RNCComprador
``131880681`` no es contribuyente activo, sustituido por ``130941361`` /
RC HERNANDEZ, igual que los otros 21 escenarios ya enviados).
"""
from __future__ import annotations

from pathlib import Path

import pytest
from lxml import etree

from apps.fe import ecf_builder

BACKEND_DIR = Path(__file__).resolve().parents[3]
_XSD_DIR = (BACKEND_DIR / 'docs' / 'superpowers' / 'reference'
            / '2026-08-31-set-pruebas-paso2')

def _cargar_xsd_rfce() -> etree.XMLSchema:
    """Carga ``RFCE-32-v1.0.xsd`` corrigiendo SOLO en memoria DOS typos
    reales de fábrica del XSD de la DGII en ``FechaType`` -- libxml2 (motor
    de regex que usa lxml para XSD) rechaza el patrón tal cual viene con
    ``XMLSchemaParseError: ... is not a valid regular expression``, así que
    sin este fix no se puede validar NADA contra este XSD:

    1. ``[12][$0-9]``: un ``$`` literal colado en la clase de caracteres,
       debería ser ``[12][0-9]`` (cubre los días 10-29).
    2. ``(?:...)`` (4 apariciones -- ``FechaType``, y 3 en los tipos
       ``Decimal18D2...Type``): grupo NO-capturante estilo Perl/PCRE -- el
       lenguaje de regex de XML Schema (Parte 2) NO soporta ``(?:...)``,
       solo grupos capturantes ``(...)``. Comparar con
       ``FechaValidationType``/``Decimal18D2...Type`` (los tipos
       equivalentes en ``e-CF-32-v1.0.xsd``, que SI compilan): usan
       ``(19|20)\\d{2}`` / ``(\\.[0-9]{2})?`` sin ``?:`` -- confirma que es
       un typo real repetido del archivo RFCE, no una eleccion valida
       alternativa. Se reemplazan las 4 apariciones por igual (grupo
       capturante simple es equivalente para fines de *matching*, que es
       todo lo que ``XMLSchema.validate`` necesita).

    Mismo patrón ya usado en ``test_ecf_builder_generico._cargar_xsd`` para
    el typo de ``e-CF-31-v1.0.xsd`` (espacio inicial en un nombre de tipo)
    -- no se modifica el archivo real descargado de la DGII, solo la copia
    en memoria usada para compilar el ``XMLSchema``.
    """
    xml_bytes = (_XSD_DIR / 'RFCE-32-v1.0.xsd').read_bytes()
    xml_bytes = xml_bytes.replace(rb'[12][$0-9]', rb'[12][0-9]')
    xml_bytes = xml_bytes.replace(rb'(?:', rb'(')
    return etree.XMLSchema(etree.fromstring(xml_bytes))


_RFCE_SCHEMA = _cargar_xsd_rfce()

# RNC real activo usado para sustituir 131880681 en los 4 escenarios (mismo
# valor que los otros 21 escenarios ya enviados a testecf, ver
# resultados-paso2-20260904/README.md hallazgo #2).
_RNC_ACTIVO = '130941361'


def _validar_contra_xsd_rfce(xml_str: str) -> None:
    """Valida contra el XSD real todo lo que ``construir_rfce`` SI genera
    (Encabezado..CodigoSeguridadeCF). El XSD exige además un ``<xs:any>``
    final (minOccurs=1) donde va ``<Signature>`` -- el builder
    deliberadamente no lo genera, se agrega un placeholder solo para poder
    ejercitar la validación XSD real sobre el resto (mismo patrón que
    ``test_ecf_builder_generico._validar_estructura_contra_xsd``)."""
    root = etree.fromstring(xml_str.encode('utf-8'))
    etree.SubElement(root, 'PlaceholderSignature')
    is_valid = _RFCE_SCHEMA.validate(root)
    assert is_valid, (
        f"RFCE inválido contra RFCE-32-v1.0.xsd: {_RFCE_SCHEMA.error_log}\n{xml_str}")


def _datos_minimos(**overrides) -> dict:
    datos = {
        'RNCEmisor': '130217432',
        'RazonSocialEmisor': 'ABREGONZA, SRL',
        'FechaEmision': '01-04-2020',
        'TipoIngresos': '01',
        'TipoPago': '1',
        'MontoTotal': '11918.00',
    }
    datos.update(overrides)
    return datos


CODIGO_VALIDO = 'abc123'


# ---------------------------------------------------------------------------
# 1. Estructura mínima válida contra el XSD real
# ---------------------------------------------------------------------------

def test_rfce_minimo_valido_contra_xsd():
    xml = ecf_builder.construir_rfce('E320000000012', _datos_minimos(), CODIGO_VALIDO)
    _validar_contra_xsd_rfce(xml)
    assert '<TipoeCF>32</TipoeCF>' in xml
    assert '<eNCF>E320000000012</eNCF>' in xml
    assert f'<CodigoSeguridadeCF>{CODIGO_VALIDO}</CodigoSeguridadeCF>' in xml


def test_rfce_con_comprador_totales_y_forma_pago_contra_xsd():
    datos = _datos_minimos(
        RNCComprador='130941361',
        RazonSocialComprador='RC HERNANDEZ SRL',
        MontoGravadoTotal='10100.00',
        MontoGravadoI1='10100.00',
        TotalITBIS='1818.00',
        TotalITBIS1='1818.00',
        **{'FormaPago[1]': '1', 'MontoPago[1]': '11918.00'},
    )
    xml = ecf_builder.construir_rfce('E320000000012', datos, CODIGO_VALIDO)
    _validar_contra_xsd_rfce(xml)
    assert '<RNCComprador>130941361</RNCComprador>' in xml
    assert '<TablaFormasPago>' in xml
    assert '<FormaPago>1</FormaPago>' in xml
    assert '<MontoPago>11918.00</MontoPago>' in xml


def test_rfce_identificador_extranjero_sin_rnc_comprador():
    """RNCComprador e IdentificadorExtranjero son mutuamente excluyentes
    por regla de negocio (Formato-RFCE-v1.0.pdf nota 3) -- si no hay RNC
    válido pero sí IdentificadorExtranjero, se usa este último."""
    datos = _datos_minimos(IdentificadorExtranjero='PASSPORT123')
    xml = ecf_builder.construir_rfce('E320000000013', datos, CODIGO_VALIDO)
    _validar_contra_xsd_rfce(xml)
    assert '<IdentificadorExtranjero>PASSPORT123</IdentificadorExtranjero>' in xml
    assert '<RNCComprador>' not in xml


def test_rfce_impuestos_adicionales_contra_xsd():
    datos = _datos_minimos(**{
        'TipoImpuesto[1]': '001',
        'MontoImpuestoSelectivoConsumoEspecifico[1]': '50.00',
        'MontoImpuestoAdicional': '50.00',
    })
    xml = ecf_builder.construir_rfce('E320000000014', datos, CODIGO_VALIDO)
    _validar_contra_xsd_rfce(xml)
    assert '<ImpuestosAdicionales>' in xml
    assert '<TipoImpuesto>001</TipoImpuesto>' in xml


# ---------------------------------------------------------------------------
# 2. Validaciones de entrada (fallo duro, nunca omitir en silencio)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize('encf', ['E310000000012', 'E330000000012', 'no-es-encf', 'E3200000000'])
def test_rfce_rechaza_encf_que_no_es_tipo_32(encf):
    with pytest.raises(ecf_builder.ECFBuilderError):
        ecf_builder.construir_rfce(encf, _datos_minimos(), CODIGO_VALIDO)


@pytest.mark.parametrize('codigo', ['', 'abc', 'abcdefg', None, '12345'])
def test_rfce_rechaza_codigo_seguridad_con_largo_incorrecto(codigo):
    with pytest.raises(ecf_builder.ECFBuilderError):
        ecf_builder.construir_rfce('E320000000012', _datos_minimos(), codigo)


@pytest.mark.parametrize('campo', ['TipoIngresos', 'TipoPago', 'RNCEmisor',
                                   'RazonSocialEmisor', 'FechaEmision', 'MontoTotal'])
def test_rfce_rechaza_falta_de_campo_obligatorio(campo):
    datos = _datos_minimos()
    datos.pop(campo)
    with pytest.raises(ecf_builder.ECFBuilderError):
        ecf_builder.construir_rfce('E320000000012', datos, CODIGO_VALIDO)


def test_rfce_rechaza_rnc_emisor_invalido():
    datos = _datos_minimos(RNCEmisor='123')
    with pytest.raises(ecf_builder.ECFBuilderError):
        ecf_builder.construir_rfce('E320000000012', datos, CODIGO_VALIDO)


# ---------------------------------------------------------------------------
# 3. derivar_codigo_seguridad
# ---------------------------------------------------------------------------

def _xml_firmado_fake(signature_value: str) -> str:
    return (
        '<?xml version="1.0" encoding="utf-8"?>'
        '<ECF><Encabezado><Version>1.0</Version></Encabezado>'
        '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">'
        '<SignedInfo/>'
        f'<SignatureValue>{signature_value}</SignatureValue>'
        '<KeyInfo/></Signature></ECF>'
    )


def test_derivar_codigo_seguridad_devuelve_6_caracteres():
    xml = _xml_firmado_fake('QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=')
    codigo = ecf_builder.derivar_codigo_seguridad(xml)
    assert len(codigo) == 6
    assert codigo == codigo.lower()


def test_derivar_codigo_seguridad_es_deterministico():
    xml = _xml_firmado_fake('c2lnbmF0dXJlLXZhbHVlLWV4YW1wbGU=')
    assert (ecf_builder.derivar_codigo_seguridad(xml)
            == ecf_builder.derivar_codigo_seguridad(xml))


def test_derivar_codigo_seguridad_distinto_signature_value_distinto_codigo():
    a = ecf_builder.derivar_codigo_seguridad(_xml_firmado_fake('AAAA'))
    b = ecf_builder.derivar_codigo_seguridad(_xml_firmado_fake('BBBB'))
    assert a != b


def test_derivar_codigo_seguridad_falla_sin_signature():
    xml = '<ECF><Encabezado><Version>1.0</Version></Encabezado></ECF>'
    with pytest.raises(ecf_builder.ECFBuilderError):
        ecf_builder.derivar_codigo_seguridad(xml)


def test_derivar_codigo_seguridad_falla_signature_value_vacio():
    xml = _xml_firmado_fake('')
    with pytest.raises(ecf_builder.ECFBuilderError):
        ecf_builder.derivar_codigo_seguridad(xml)


def test_derivar_codigo_seguridad_acepta_bytes():
    xml_bytes = _xml_firmado_fake('QUJDREVGR0g=').encode('utf-8')
    codigo = ecf_builder.derivar_codigo_seguridad(xml_bytes)
    assert len(codigo) == 6


# ---------------------------------------------------------------------------
# 4. Los 4 escenarios reales del Set de Pruebas (hoja RFCE), con el gotcha
#    de RNC ya conocido aplicado -- confirma que el payload REAL que se va a
#    enviar a testecf arma un RFCE válido contra el XSD real antes de
#    intentar el envío de verdad.
# ---------------------------------------------------------------------------

_ESCENARIOS_REALES = {
    'E320000000012': {
        'RNCEmisor': '130217432',
        'RazonSocialEmisor': 'DOCUMENTOS ELECTRONICOS PRUEBA FACTURA DE CONSUMO MENOR 250MIL',
        'FechaEmision': '01-04-2020',
        'TipoIngresos': '01',
        'TipoPago': '1',
        'RNCComprador': _RNC_ACTIVO,
        'RazonSocialComprador': 'RC HERNANDEZ SRL',
        'MontoGravadoTotal': '40000.00',
        'MontoGravadoI1': '40000.00',
        'TotalITBIS': '7200.00',
        'TotalITBIS1': '7200.00',
        'MontoTotal': '47200.00',
    },
    'E320000000013': {
        'RNCEmisor': '130217432',
        'RazonSocialEmisor': 'DOCUMENTOS ELECTRONICOS PRUEBA FACTURA DE CONSUMO MENOR 250MIL',
        'FechaEmision': '01-04-2020',
        'TipoIngresos': '01',
        'TipoPago': '1',
        'RNCComprador': _RNC_ACTIVO,
        'RazonSocialComprador': 'RC HERNANDEZ SRL',
        'MontoGravadoTotal': '95000.00',
        'MontoGravadoI1': '95000.00',
        'TotalITBIS': '17100.00',
        'TotalITBIS1': '17100.00',
        'MontoTotal': '112100.00',
    },
    'E320000000014': {
        'RNCEmisor': '130217432',
        'RazonSocialEmisor': 'DOCUMENTOS ELECTRONICOS PRUEBA FACTURA DE CONSUMO MENOR 250MIL',
        'FechaEmision': '01-04-2020',
        'TipoIngresos': '01',
        'TipoPago': '1',
        'RNCComprador': _RNC_ACTIVO,
        'RazonSocialComprador': 'RC HERNANDEZ SRL',
        'MontoGravadoTotal': '10100.00',
        'MontoGravadoI1': '10100.00',
        'TotalITBIS': '1818.00',
        'TotalITBIS1': '1818.00',
        'MontoTotal': '11918.00',
    },
    'E320000000015': {
        'RNCEmisor': '130217432',
        'RazonSocialEmisor': 'DOCUMENTOS ELECTRONICOS PRUEBA FACTURA DE CONSUMO MENOR 250MIL',
        'FechaEmision': '01-04-2020',
        'TipoIngresos': '01',
        'TipoPago': '1',
        'RNCComprador': _RNC_ACTIVO,
        'RazonSocialComprador': 'RC HERNANDEZ SRL',
        'MontoGravadoTotal': '55000.00',
        'MontoGravadoI1': '55000.00',
        'TotalITBIS': '9900.00',
        'TotalITBIS1': '9900.00',
        'MontoTotal': '64900.00',
    },
}


@pytest.mark.parametrize('encf,datos', sorted(_ESCENARIOS_REALES.items()))
def test_rfce_escenarios_reales_del_set_de_pruebas(encf, datos):
    xml = ecf_builder.construir_rfce(encf, datos, CODIGO_VALIDO)
    _validar_contra_xsd_rfce(xml)
    assert f'<eNCF>{encf}</eNCF>' in xml
    assert f'<RNCComprador>{_RNC_ACTIVO}</RNCComprador>' in xml
    assert '<RNCComprador>131880681</RNCComprador>' not in xml
