"""Firma XMLDSig enveloped (RSA-SHA256) para los XML de la DGII.

El certificado es un .p12/.pfx emitido por una certificadora aprobada
por INDOTEL (propósito "Procedimientos Tributarios").
"""
from __future__ import annotations

import base64
import os
import subprocess
import tempfile
from datetime import datetime, timezone

from cryptography import x509
from cryptography.hazmat.primitives.serialization import pkcs12
from lxml import etree
from signxml import XMLSigner, XMLVerifier, methods
from signxml.algorithms import DigestAlgorithm, SignatureMethod

_FIRMAR_EXE = os.path.join(os.path.dirname(__file__), 'tools', 'firmar.exe')


class FirmaOficialError(Exception):
    pass


def leer_p12(p12_bytes: bytes, password: str):
    """Devuelve (private_key, cert, subject_str, not_valid_after)."""
    key, cert, _extra = pkcs12.load_key_and_certificates(
        p12_bytes, password.encode())
    if key is None or cert is None:
        raise ValueError('El archivo no contiene clave privada y certificado')
    subject = cert.subject.rfc4514_string()
    vence = getattr(cert, 'not_valid_after_utc', None)
    if vence is None:
        vence = cert.not_valid_after.replace(tzinfo=timezone.utc)
    return key, cert, subject, vence


def _normalizar_namespaces(xml_str: str) -> str:
    """Reordena xmlns:xsi/xmlns:xsd alfabéticamente (xsd antes que xsi).

    Los XML que genera el portal de la DGII (p.ej. Postulacion.xml) traen
    xmlns:xsi antes que xmlns:xsd en la raíz. Es un bug de interoperabilidad
    documentado: el validador de la DGII espera el orden alfabético y
    produce un digest distinto al nuestro si no se normaliza antes de
    firmar (confirmado contra una librería de referencia que sí funciona
    en producción: victors1681/dgii-ecf, src/Signature/custom/Digest.ts).
    """
    return xml_str.replace(
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
        'xmlns:xsd="http://www.w3.org/2001/XMLSchema"',
        'xmlns:xsd="http://www.w3.org/2001/XMLSchema" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    )


def firmar_xml(xml_str: str, p12_bytes: bytes, password: str) -> str:
    key, cert, _subject, vence = leer_p12(p12_bytes, password)
    if vence < datetime.now(timezone.utc):
        raise ValueError(f'El certificado venció el {vence:%d/%m/%Y}')
    xml_str = _normalizar_namespaces(xml_str)
    root = etree.fromstring(xml_str.encode('utf-8'))
    signer = XMLSigner(
        method=methods.enveloped,
        signature_algorithm=SignatureMethod.RSA_SHA256,
        digest_algorithm=DigestAlgorithm.SHA256,
        c14n_algorithm='http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    )
    signed = signer.sign(root, key=key, cert=[cert])
    return etree.tostring(
        signed, xml_declaration=True, encoding='utf-8').decode('utf-8')


def firmar_con_app_oficial(xml_str: str, p12_bytes: bytes, password: str) -> str:
    """Firma un XML con la lógica REAL de la App Firma Digital oficial de
    la DGII (``wfFirma.Services.SignServices.FirmarXml``), vía Mono, sin
    abrir ninguna ventana.

    ``firmar_xml()`` (signxml/lxml) es correcto por estándar XMLDSig pero
    el validador de la Postulación de la DGII lo rechazó ("Error XML.
    Firma Inválida.") en 5 intentos reales; solo la App oficial funcionó.
    Confirmado 2026-08-31: invocar su método de firma por reflexión/Mono
    produce un ``DigestValue``/``SignatureValue`` byte-a-byte idéntico al
    de la GUI manual. Usar esta función para cualquier documento que la
    DGII vaya a validar de verdad (Postulación, e-CF); ``firmar_xml()``
    sigue sirviendo para los endpoints propios de recepción P2P donde
    nosotros mismos controlamos ambos lados (firmante y verificador).
    """
    if not os.path.exists(_FIRMAR_EXE):
        raise FirmaOficialError(
            'firmar.exe no está compilado — revisar que mono-complete '
            'esté instalado y que docker/entrypoint.sh haya corrido mcs.')
    with tempfile.TemporaryDirectory() as tmp:
        xml_path = os.path.join(tmp, 'in.xml')
        cert_path = os.path.join(tmp, 'cert.p12')
        out_path = os.path.join(tmp, 'out.xml')
        with open(xml_path, 'w', encoding='utf-8') as f:
            f.write(xml_str)
        with open(cert_path, 'wb') as f:
            f.write(p12_bytes)
        result = subprocess.run(
            ['mono', _FIRMAR_EXE, xml_path, cert_path, out_path],
            input=password + '\n', capture_output=True, text=True,
            timeout=30,
        )
        if result.returncode != 0 or not os.path.exists(out_path):
            raise FirmaOficialError(
                f'Error firmando con la App oficial: '
                f'{result.stdout} {result.stderr}'.strip())
        with open(out_path, encoding='utf-8-sig') as f:
            return f.read()


def verificar_xml(xml_bytes: bytes) -> x509.Certificate:
    """Verifica una firma XMLDSig enveloped y devuelve el certificado firmante.

    Extrae el certificado embebido en la propia firma (KeyInfo/
    X509Certificate) y lo pasa a signxml como ``x509_cert`` explícito: eso
    valida la integridad criptográfica de la firma contra ESE certificado
    exacto sin intentar construir una cadena de confianza (evita que
    ``require_x509=True`` falle con "candidates exhausted": sin ca_pem_file
    signxml intenta construir la cadena contra el almacén de CA del
    sistema, que trae raíces antiguas que a veces disparan advertencias de
    RFC 5280 ajenas al certificado que estamos validando. NO valida la
    cadena contra la CA raíz de INDOTEL ni revocación (OCSP/CRL); endurecer
    antes de que la
    DGII pruebe de verdad los pasos 7-11 de la certificación.
    """
    root = etree.fromstring(xml_bytes)
    ns = {'ds': 'http://www.w3.org/2000/09/xmldsig#'}
    cert_els = root.findall('.//ds:X509Certificate', ns)
    if not cert_els or not (cert_els[0].text or '').strip():
        raise ValueError('La firma no incluye certificado (X509Certificate)')
    der = base64.b64decode(cert_els[0].text.strip())
    cert = x509.load_der_x509_certificate(der)
    XMLVerifier().verify(root, x509_cert=cert)
    return cert
