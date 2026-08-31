"""Firma XMLDSig enveloped (RSA-SHA256) para los XML de la DGII.

El certificado es un .p12/.pfx emitido por una certificadora aprobada
por INDOTEL (propósito "Procedimientos Tributarios").
"""
from __future__ import annotations

import base64
from datetime import datetime, timezone

from cryptography import x509
from cryptography.hazmat.primitives.serialization import pkcs12
from lxml import etree
from signxml import XMLSigner, XMLVerifier, methods
from signxml.algorithms import DigestAlgorithm, SignatureMethod


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
