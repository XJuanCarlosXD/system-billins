"""Firma XMLDSig enveloped (RSA-SHA256) para los XML de la DGII.

El certificado es un .p12/.pfx emitido por una certificadora aprobada
por INDOTEL (propósito "Procedimientos Tributarios").
"""
from __future__ import annotations

from datetime import datetime, timezone

from cryptography.hazmat.primitives.serialization import pkcs12
from lxml import etree
from signxml import XMLSigner, methods
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


def firmar_xml(xml_str: str, p12_bytes: bytes, password: str) -> str:
    key, cert, _subject, vence = leer_p12(p12_bytes, password)
    if vence < datetime.now(timezone.utc):
        raise ValueError(f'El certificado venció el {vence:%d/%m/%Y}')
    root = etree.fromstring(xml_str.encode('utf-8'))
    signer = XMLSigner(
        method=methods.enveloped,
        signature_algorithm=SignatureMethod.RSA_SHA256,
        digest_algorithm=DigestAlgorithm.SHA256,
        c14n_algorithm='http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    )
    signed = signer.sign(root, key=key, cert=[cert])
    return etree.tostring(signed, encoding='unicode')
