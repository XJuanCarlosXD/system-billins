"""Cliente de los servicios web de la DGII (facturación electrónica).

Fase 1: autenticación semilla→firma→token con cache en TFE_TOKEN.
Fase 2: recepción de e-CF (``enviar_ecf``), recepción de RFCE
(``enviar_rfce``) y consulta de resultado (``consultar_estado``).

Referencia oficial: ``Descripcion-Tecnica-Servicios-DGII.pdf`` en
``backend/docs/superpowers/reference/2026-08-31-set-pruebas-paso2/``
(v1.7, mayo 2026). Los tres servicios de Fase 2 SIEMPRE firman con
``firma.firmar_con_app_oficial()`` (nunca ``firma.firmar_xml()``): la DGII
solo aceptó la firma de la App oficial en la Postulación real, ver
docstring de esa función.
"""
from __future__ import annotations

from datetime import datetime, timedelta

import requests

from apps.fe import crypto, firma
from apps.legacy.repositories import fe_repo

AMBIENTES = ('testecf', 'certecf', 'ecf')
BASE = 'https://ecf.dgii.gov.do/{amb}'
# RFCE (Resumen de Factura de Consumo) vive en un HOST distinto al resto de
# los servicios de e-CF -- no es solo un path distinto bajo ecf.dgii.gov.do,
# confirmado en la Descripcion Tecnica oficial ("Recepción de resumen
# factura de consumo electrónica (RFCE)").
BASE_FC = 'https://fc.dgii.gov.do/{amb}'
TIMEOUT = 30


class DgiiError(Exception):
    pass


def _base(ambiente: str) -> str:
    if ambiente not in AMBIENTES:
        raise DgiiError(f'Ambiente inválido: {ambiente}')
    return BASE.format(amb=ambiente)


def _base_fc(ambiente: str) -> str:
    if ambiente not in AMBIENTES:
        raise DgiiError(f'Ambiente inválido: {ambiente}')
    return BASE_FC.format(amb=ambiente)


def obtener_semilla(ambiente: str) -> str:
    r = requests.get(
        f'{_base(ambiente)}/autenticacion/api/autenticacion/semilla',
        timeout=TIMEOUT)
    if r.status_code != 200:
        raise DgiiError(f'Semilla HTTP {r.status_code}: {r.text[:300]}')
    return r.text


def obtener_token(no_cia: str, ambiente: str, forzar: bool = False) -> str:
    """Token vigente para la cía (cacheado en TFE_TOKEN).

    Firma la semilla con ``firma.firmar_con_app_oficial()`` -- NUNCA
    ``firma.firmar_xml()``. Confirmado 2026-09-04 contra ``testecf`` real:
    la semilla firmada con ``firmar_xml()`` (signxml/lxml) es rechazada por
    ``validarsemilla`` con ``HTTP 400 "Firma del certificado invalida"``,
    el mismo síntoma que bloqueó la Postulación 5 intentos antes de
    resolverse con la App oficial (ver docstring de
    ``firmar_con_app_oficial`` y memoria del proyecto). Esta función se
    había quedado sin migrar cuando se aplicó ese fix al resto del cliente
    (``enviar_ecf``/``enviar_rfce``/``reenviar_ecf`` ya firman correcto).
    """
    if not forzar:
        cached = fe_repo.get_token(no_cia, ambiente)
        if cached:
            return cached

    cert = fe_repo.get_certificado(no_cia)
    if not cert:
        raise DgiiError('La empresa no tiene certificado digital cargado')
    p12_bytes, password_enc = cert
    password = crypto.decrypt(password_enc)

    semilla = obtener_semilla(ambiente)
    semilla_firmada = firma.firmar_con_app_oficial(semilla, p12_bytes, password)

    r = requests.post(
        f'{_base(ambiente)}/autenticacion/api/autenticacion/validarsemilla',
        files={'xml': ('semilla.xml', semilla_firmada.encode('utf-8'),
                       'text/xml')},
        timeout=TIMEOUT)
    if r.status_code != 200:
        raise DgiiError(f'ValidarSemilla HTTP {r.status_code}: {r.text[:300]}')
    try:
        data = r.json()
    except ValueError:
        raise DgiiError(f'Respuesta no JSON de la DGII: {r.text[:300]}')
    token = data.get('token')
    if not token:
        raise DgiiError(f'Respuesta sin token: {str(data)[:300]}')
    expira = _parse_fecha(data.get('expira')) or (
        datetime.now() + timedelta(minutes=55))
    fe_repo.save_token(no_cia, ambiente, token, expira)
    return token


def _parse_fecha(valor) -> datetime | None:
    if not valor:
        return None
    texto = str(valor)
    for fmt in ('%Y-%m-%dT%H:%M:%S.%f', '%Y-%m-%dT%H:%M:%S',
                '%m/%d/%Y %I:%M:%S %p'):
        try:
            return datetime.strptime(texto[:26], fmt)
        except ValueError:
            continue
    return None


def probar_conexion(no_cia: str, ambiente: str) -> dict:
    """Semilla→firma→token de punta a punta. Devuelve dict apto para la UI."""
    token = obtener_token(no_cia, ambiente, forzar=True)
    return {'ok': True, 'ambiente': ambiente,
            'token_preview': token[:24] + '…',
            'mensaje': 'Autenticación exitosa contra la DGII'}


def _firmar_para_envio(no_cia: str, xml_sin_firmar: str) -> tuple[str, str]:
    """Firma ``xml_sin_firmar`` con el certificado de la cía (App oficial,
    NUNCA ``firma.firmar_xml()`` -- ver docstring de
    ``firmar_con_app_oficial``) y devuelve ``(xml_firmado, rnc_emisor)``.

    ``rnc_emisor`` sale de ``TFE_CONFIG`` (no del XML) porque lo necesita el
    llamador para el nombre de archivo ``RNC+eNCF.xml`` exigido por la DGII
    (``Descripcion-Tecnica-Servicios-DGII.pdf``, "Recepción de e-CF").
    """
    cfg = fe_repo.get_config(no_cia)
    if not cfg or not cfg.get('rnc_emisor'):
        raise DgiiError('La empresa no tiene RNC emisor configurado en TFE_CONFIG')
    cert = fe_repo.get_certificado(no_cia)
    if not cert:
        raise DgiiError('La empresa no tiene certificado digital cargado')
    p12_bytes, password_enc = cert
    password = crypto.decrypt(password_enc)
    xml_firmado = firma.firmar_con_app_oficial(xml_sin_firmar, p12_bytes, password)
    return xml_firmado, cfg['rnc_emisor']


def _post_multipart_firmado(url: str, token: str, nombre_archivo: str,
                             xml_firmado: str, contexto_error: str) -> dict:
    """POST multipart del XML ya firmado a un servicio de recepción de la
    DGII; valida el HTTP 200 y parsea el JSON de la respuesta.

    Compartido por ``enviar_ecf`` y ``enviar_rfce`` (mismo request salvo
    URL/host) -- cada llamador arma su propio dict de retorno a partir del
    JSON devuelto porque las formas son distintas (ver docstrings). El
    ``contexto_error`` identifica el servicio en el mensaje de
    ``DgiiError`` (p.ej. ``'Recepción e-CF'``, ``'Recepción RFCE'``).
    """
    r = requests.post(
        url,
        headers={'Authorization': f'Bearer {token}'},
        files={'xml': (nombre_archivo, xml_firmado.encode('utf-8'), 'text/xml')},
        timeout=TIMEOUT)
    if r.status_code != 200:
        raise DgiiError(f'{contexto_error} HTTP {r.status_code}: {r.text[:300]}')
    try:
        return r.json()
    except ValueError:
        raise DgiiError(f'Respuesta no JSON de la DGII: {r.text[:300]}')


def enviar_ecf(no_cia: str, ambiente: str, e_ncf: str, xml_sin_firmar: str) -> dict:
    """Firma y envía un e-CF tentativo al servicio de Recepción de e-CF.

    ``POST {base}/recepcion/api/facturaselectronicas`` (multipart, campo
    ``xml``, nombre de archivo ``RNC+eNCF.xml`` sin separador -- estándar
    oficial de la DGII). Devuelve ``{'trackId', 'xml_firmado',
    'respuesta_cruda'}``; el ``trackId`` es solo un acuse de recibo, NO el
    resultado de validación -- eso se consulta después con
    ``consultar_estado()`` (la DGII valida de forma asíncrona).

    Las Facturas de Consumo (tipo 32) con monto < RD$250,000 NO se envían
    aquí: van por ``enviar_rfce()``.
    """
    xml_firmado, rnc_emisor = _firmar_para_envio(no_cia, xml_sin_firmar)
    token = obtener_token(no_cia, ambiente)
    nombre_archivo = f'{rnc_emisor}{e_ncf}.xml'
    data = _post_multipart_firmado(
        f'{_base(ambiente)}/recepcion/api/facturaselectronicas',
        token, nombre_archivo, xml_firmado, 'Recepción e-CF')
    track_id = data.get('trackId')
    if not track_id:
        # 'error'/'mensaje' son los nombres de campo reales que documenta la
        # DGII para este servicio (no el genérico str(data)[:300] usado en
        # obtener_token) -- se listan explícitos para que el mensaje de
        # error sea legible sin tener que parsear el dict completo.
        raise DgiiError(
            f"Recepción e-CF sin trackId -- error: {data.get('error')!r}, "
            f"mensaje: {data.get('mensaje')!r}")
    # NOTA: 'trackId' se deja tal cual (camelCase de la DGII) a propósito --
    # a diferencia de enviar_rfce, que normaliza a snake_case porque arma un
    # dict de forma propia. No "corregir" esto a snake_case: rompería a
    # cualquier llamador que dependa de 'trackId' literal per spec.
    return {'trackId': track_id, 'xml_firmado': xml_firmado, 'respuesta_cruda': data}


def enviar_rfce(no_cia: str, ambiente: str, e_ncf: str, xml_sin_firmar: str) -> dict:
    """Firma y envía un RFCE (Resumen de Factura de Consumo Electrónica),
    paso obligatorio ANTES de la factura íntegra para e-CF tipo 32 con
    monto < RD$250,000 (``TFAT_FACTURA``/``ecf_builder`` no arma este XML,
    solo lo firma y envía -- construir el RFCE es alcance de otra tarea).

    ``POST https://fc.dgii.gov.do/{ambiente}/recepcionfc/api/recepcion/ecf``
    -- HOST distinto al resto de los servicios (``fc.dgii.gov.do``, no
    ``ecf.dgii.gov.do``), confirmado en la Descripción Técnica oficial. El
    token de autenticación es el MISMO que usa ``enviar_ecf``
    (``obtener_token``) -- la documentación de la DGII no define un
    servicio de autenticación separado para RFCE, y el ejemplo curl oficial
    de este servicio manda un bearer token con el mismo formato.

    A diferencia de ``enviar_ecf``, la respuesta de RFCE es SÍNCRONA: la
    DGII ya devuelve el estado final (Aceptado/Aceptado condicional/
    Rechazado) en esta misma llamada, sin trackId ni consulta posterior.
    Por eso se devuelve el dict completo de la respuesta en vez de
    replicar la forma de ``enviar_ecf`` -- un "Rechazado" no es un error de
    transporte, es un resultado de negocio válido que el llamador debe
    poder inspeccionar (igual que ``consultar_estado``, no se colapsa a un
    booleano).
    """
    xml_firmado, rnc_emisor = _firmar_para_envio(no_cia, xml_sin_firmar)
    token = obtener_token(no_cia, ambiente)
    nombre_archivo = f'{rnc_emisor}{e_ncf}.xml'
    data = _post_multipart_firmado(
        f'{_base_fc(ambiente)}/recepcionfc/api/recepcion/ecf',
        token, nombre_archivo, xml_firmado, 'Recepción RFCE')
    return {
        'estado': data.get('estado'),
        'codigo': data.get('codigo'),
        'mensajes': data.get('mensajes'),
        'encf': data.get('encf'),
        # snake_case aqui a proposito -- este dict es una forma propia (no
        # un passthrough), a diferencia de 'trackId' en enviar_ecf (ver nota
        # ahi).
        'secuencia_utilizada': data.get('secuenciaUtilizada'),
        'xml_firmado': xml_firmado,
        'respuesta_cruda': data,
    }


def reenviar_ecf(no_cia: str, ambiente: str, e_ncf: str, xml_firmado: str) -> dict:
    """Reenvía a la DGII un e-CF que YA fue firmado anteriormente (el mismo
    ``XML_FIRMADO`` guardado en ``TFE_DOCUMENTO`` por ``enviar_ecf``), SIN
    volver a firmarlo.

    El e-NCF y la firma digital de un e-CF no cambian entre intentos de
    envío -- solo se repite la sumisión HTTP (p.ej. reintentar tras un
    rechazo por un problema transitorio, o un envío que quedó en un estado
    inconsistente por un timeout de red). Llamar a ``enviar_ecf()`` con
    este XML ya firmado como ``xml_sin_firmar`` firmaría un XML que ya
    tiene el nodo ``<Signature>`` una segunda vez (double-signing), que la
    DGII rechazaría -- por eso esta función existe como variante separada
    que se salta ``_firmar_para_envio`` por completo y reusa
    ``_post_multipart_firmado`` (mismo endpoint/formato multipart que
    ``enviar_ecf``) directo con el XML tal cual está guardado.

    Devuelve ``{'trackId', 'respuesta_cruda'}`` (no incluye
    ``xml_firmado`` en el resultado -- a diferencia de ``enviar_ecf``, el
    llamador ya lo tiene, es el mismo que le pasó a esta función).
    """
    cfg = fe_repo.get_config(no_cia)
    if not cfg or not cfg.get('rnc_emisor'):
        raise DgiiError('La empresa no tiene RNC emisor configurado en TFE_CONFIG')
    token = obtener_token(no_cia, ambiente)
    nombre_archivo = f"{cfg['rnc_emisor']}{e_ncf}.xml"
    data = _post_multipart_firmado(
        f'{_base(ambiente)}/recepcion/api/facturaselectronicas',
        token, nombre_archivo, xml_firmado, 'Reenvío e-CF')
    track_id = data.get('trackId')
    if not track_id:
        raise DgiiError(
            f"Reenvío e-CF sin trackId -- error: {data.get('error')!r}, "
            f"mensaje: {data.get('mensaje')!r}")
    return {'trackId': track_id, 'respuesta_cruda': data}


def consultar_estado(no_cia: str, ambiente: str, track_id: str) -> dict:
    """Consulta el resultado de validación de un e-CF enviado con
    ``enviar_ecf`` (servicio oficial "Consulta de resultado e-CF").

    ``GET {base}/consultaresultado/api/consultas/estado?trackid={track_id}``.
    Devuelve el dict COMPLETO de la respuesta de la DGII (``codigo``,
    ``estado``, ``rnc``, ``eNCF``, ``secuenciaUtilizada``,
    ``fechaRecepcion``, ``mensajes``) -- el código numérico solo
    (0=No encontrado, 1=Aceptado, 2=Rechazado, 3=En Proceso,
    4=Aceptado Condicional) no alcanza para mostrarle al usuario el motivo
    real de un rechazo, que viene en ``mensajes``.
    """
    token = obtener_token(no_cia, ambiente)
    r = requests.get(
        f'{_base(ambiente)}/consultaresultado/api/consultas/estado',
        headers={'Authorization': f'Bearer {token}'},
        params={'trackid': track_id},
        timeout=TIMEOUT)
    if r.status_code != 200:
        raise DgiiError(f'Consulta resultado HTTP {r.status_code}: {r.text[:300]}')
    try:
        return r.json()
    except ValueError:
        raise DgiiError(f'Respuesta no JSON de la DGII: {r.text[:300]}')
