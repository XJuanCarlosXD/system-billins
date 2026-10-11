"""Tests de ``apps.fe.firma`` — red de seguridad para la verificación
XMLDSig que la DGII usa contra nuestro endpoint ``validacioncertificado``
(Fase 9 en adelante).

Fixtures reales (74va-76va corridas, extraídos de
``FAT.TFE_DOCUMENTO_RECIBIDO`` de Oracle):

- ``fixture_dgii_ecf_*.xml``: e-CFs tipo 31 que la DGII envió a nuestro
  ``/fe/recepcion/api/ecf`` en Fase 9, firmados con la persona de prueba
  DGII (``PEDRO PEREZ MARTINEZ``, ``IDCDO-00199999996``, cert VIAFIRMA
  TEST). Mismo estilo de firma que los sobres de semilla que entran por
  ``validacioncertificado_view``, por eso sirven de contrato real para
  ``verificar_xml``.
- ``fixture_abregonza_arecf_firmado.xml``: ACECF entrante con
  ``<Signature xmlns="xmldsig#">`` sin prefijo ``ds:``. Documentado como
  ``xfail``: ``verificar_xml`` todavía no maneja esa variante de
  canonicalización. No bloquea Fase 11 porque la verificación de firma
  solo se usa en ``validacioncertificado_view``.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from apps.fe import firma


FIXTURES_DIR = Path(__file__).parent / 'fixtures'


# ---------- errores estructurales ----------


def test_verificar_xml_sin_signature_falla():
    xml = b'<?xml version="1.0"?><Doc><Dato>x</Dato></Doc>'
    with pytest.raises(ValueError, match='no contiene <Signature>'):
        firma.verificar_xml(xml)


def test_verificar_xml_sin_x509certificate_falla():
    xml = (
        '<?xml version="1.0"?>'
        '<Doc xmlns:ds="http://www.w3.org/2000/09/xmldsig#">'
        '<ds:Signature>'
        '<ds:SignedInfo><ds:CanonicalizationMethod Algorithm=""/></ds:SignedInfo>'
        '<ds:SignatureValue>Zg==</ds:SignatureValue>'
        '</ds:Signature></Doc>'
    ).encode('utf-8')
    with pytest.raises(ValueError, match='no incluye certificado'):
        firma.verificar_xml(xml)


# ---------- fixtures reales DGII (Fase 9) ----------


DGII_PEDRO_PEREZ_RNC = '00199999996'


@pytest.mark.parametrize('fixture_name', [
    'fixture_dgii_ecf_pedro_perez.xml',
    'fixture_dgii_ecf_contribuyente_simulado.xml',
])
def test_verificar_ecf_entrante_firmado_por_dgii(fixture_name):
    """e-CFs reales enviados por DGII a nuestra ``/fe/recepcion/api/ecf`` en
    Fase 9: la firma XMLDSig debe verificar y el cert embebido debe ser el
    de la persona de prueba DGII (PEDRO PEREZ MARTINEZ, VIAFIRMA TEST).
    """
    xml_bytes = (FIXTURES_DIR / fixture_name).read_bytes()

    cert = firma.verificar_xml(xml_bytes)

    subject = cert.subject.rfc4514_string()
    assert 'PEDRO PEREZ MARTINEZ' in subject
    assert f'IDCDO-{DGII_PEDRO_PEREZ_RNC}' in subject


def test_verificar_rechaza_e_cf_dgii_adulterado():
    """Si un atacante MITM modifica el payload tras la firma de la DGII,
    ``verificar_xml`` debe fallar — es lo que protege a
    ``validacioncertificado_view`` de aceptar un sobre tamper.
    """
    original = (FIXTURES_DIR / 'fixture_dgii_ecf_pedro_perez.xml').read_bytes()
    adulterado = original.replace(b'<MontoTotal>7080.00', b'<MontoTotal>1.00', 1)
    assert adulterado != original, 'El fixture debe contener el valor patched'

    with pytest.raises(ValueError, match='DigestValue'):
        firma.verificar_xml(adulterado)


# ---------- limitación conocida ----------


@pytest.mark.xfail(
    reason="verificar_xml no maneja la herencia de xmlns default dentro "
    "del subárbol de la firma cuando <Signature xmlns=\"xmldsig#\"> no "
    "declara prefijo ds: (fixture ACECF 76va). No bloquea Fase 11 porque "
    "la función solo se usa en validacioncertificado_view donde la DGII "
    "firma con prefijo ds:. TODO: generalizar canon de SignedInfo.",
    strict=True,
)
def test_verificar_acecf_entrante_firmado_por_dgii_sin_prefijo_ds():
    xml_bytes = (FIXTURES_DIR / 'fixture_abregonza_arecf_firmado.xml').read_bytes()
    firma.verificar_xml(xml_bytes)


# ---------- round-trip firmar_xml → verificar_xml ----------


def _generar_p12_autofirmado(subject_cn='TEST ABREGONZA RUNNER',
                              password='pwd1234'):
    """Genera un certificado + clave RSA-2048 self-signed y lo serializa
    como PKCS#12. Pensado para tests que necesitan ejercitar firmar_xml
    sin depender del cert productivo de Abregonza.
    """
    from datetime import datetime, timedelta, timezone
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives.serialization import pkcs12
    from cryptography.x509.oid import NameOID

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, subject_cn),
    ])
    now = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=5))
        .not_valid_after(now + timedelta(days=365))
        .sign(key, hashes.SHA256())
    )
    p12 = pkcs12.serialize_key_and_certificates(
        name=subject_cn.encode(),
        key=key,
        cert=cert,
        cas=None,
        encryption_algorithm=serialization.BestAvailableEncryption(
            password.encode()),
    )
    return p12, password


# Import x509 at module scope para que el helper lo tenga disponible.
from cryptography import x509  # noqa: E402


def test_round_trip_firmar_y_verificar():
    """firmar_xml produce XMLDSig con prefijo ds: (signxml default).
    verificar_xml debe aceptar ese prefijo — hoy no lo hace (regex
    SignedInfo busca ``<SignedInfo`` sin prefijo). Red de seguridad para
    cuando se necesite verificar un XML que firmamos nosotros mismos
    (p.ej. Fase 13 Declaración Jurada o ARECF/ACECF salientes).
    """
    p12, password = _generar_p12_autofirmado(subject_cn='TEST ROUND-TRIP 80va')
    xml_sin_firmar = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<DocumentoTest><Dato>hola mundo</Dato></DocumentoTest>'
    )

    xml_firmado = firma.firmar_xml(xml_sin_firmar, p12, password)

    cert = firma.verificar_xml(xml_firmado.encode('utf-8'))

    assert 'TEST ROUND-TRIP 80va' in cert.subject.rfc4514_string()
