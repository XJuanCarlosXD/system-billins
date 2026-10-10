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
    X509Certificate) y valida la firma manualmente (c14n 1.0 inclusive +
    RSA-SHA256) en vez de delegar a signxml, porque la canonicalización de
    `lxml.etree.tostring(method='c14n')` sobre un subárbol inyecta
    `xmlns=""` espurio en elementos hijos que heredan el namespace del
    padre, lo que rompe el verify para firmas .NET-style de DGII donde
    `Signature` declara xmlns default y los descendientes lo heredan sin
    prefijo. NO valida la cadena contra la CA raíz de INDOTEL ni
    revocación (OCSP/CRL); endurecer antes de pasar a producción.
    """
    import re
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import padding

    root = etree.fromstring(xml_bytes)
    ns = {'ds': 'http://www.w3.org/2000/09/xmldsig#'}
    sig = root.find('.//ds:Signature', ns)
    if sig is None:
        raise ValueError('El XML no contiene <Signature>')
    cert_els = root.findall('.//ds:X509Certificate', ns)
    if not cert_els or not (cert_els[0].text or '').strip():
        raise ValueError('La firma no incluye certificado (X509Certificate)')
    der = base64.b64decode(cert_els[0].text.strip())
    cert = x509.load_der_x509_certificate(der)

    sv_el = sig.find('ds:SignatureValue', ns)
    if sv_el is None or not (sv_el.text or '').strip():
        raise ValueError('La firma no incluye <SignatureValue>')
    sig_bytes = base64.b64decode(sv_el.text.strip())

    canon_full = etree.tostring(root, method='c14n', with_comments=False, exclusive=False)
    m = re.search(rb'<SignedInfo(\s[^>]*)?>.*?</SignedInfo>', canon_full, re.DOTALL)
    if m is None:
        raise ValueError('No se pudo canonicalizar SignedInfo')
    si_c14n = m.group(0)
    xmldsig_ns = b'http://www.w3.org/2000/09/xmldsig#'
    if b'xmlns=' not in si_c14n.split(b'>', 1)[0]:
        si_c14n = si_c14n.replace(b'<SignedInfo', b'<SignedInfo xmlns="' + xmldsig_ns + b'"', 1)

    cert.public_key().verify(
        sig_bytes, si_c14n, padding.PKCS1v15(), hashes.SHA256())

    ref = sig.find('ds:SignedInfo/ds:Reference', ns)
    dv_el = ref.find('ds:DigestValue', ns) if ref is not None else None
    if dv_el is None or not (dv_el.text or '').strip():
        raise ValueError('La firma no incluye <DigestValue>')
    expected_digest = base64.b64decode(dv_el.text.strip())

    root_sin_sig = etree.fromstring(xml_bytes)
    sig_rm = root_sin_sig.find('.//ds:Signature', ns)
    sig_rm.getparent().remove(sig_rm)
    data_c14n = etree.tostring(root_sin_sig, method='c14n', with_comments=False, exclusive=False)
    h = hashes.Hash(hashes.SHA256())
    h.update(data_c14n)
    actual_digest = h.finalize()
    if actual_digest != expected_digest:
        raise ValueError('DigestValue no coincide con el c14n del documento')

    return cert
