"""Consulta publica de RNC/Cedula en la DGII (scrape en vivo).

La DGII NO tiene API oficial en tiempo real (confirmado 2026-07-29): solo
el buscador web publico en
https://dgii.gov.do/app/WebApps/ConsultasWeb2/ConsultasWeb/consultas/rnc.aspx
y un archivo descargable con TODOS los RNC del pais. Este modulo replica
el flujo que hace ese formulario ASP.NET WebForms (UpdatePanel/AJAX):

1. GET a la pagina para tomar __VIEWSTATE/__VIEWSTATEGENERATOR/
   __EVENTVALIDATION (tokens de esa carga especifica, obligatorios para
   que el postback no sea rechazado).
2. POST asincrono (mismo patron que dispara el boton BUSCAR: headers
   X-Requested-With/X-MicrosoftAjax, __EVENTTARGET del boton RNC) con el
   RNC/cedula tecleado.
3. La respuesta es el formato "delta" de UpdatePanel (texto plano con
   segmentos separados por pipes), no JSON -- se extrae el fragmento
   HTML con regex y se parsea la tabla de resultados con BeautifulSoup.

Si la DGII no responde, cambia el markup, o el RNC no esta inscrito,
devuelve None -- el llamador debe tratarlo como "no se pudo autocompletar,
sigue llenando a mano" (nunca bloquear el registro del cliente por esto).
"""
from __future__ import annotations

import logging
import re

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_URL = "https://dgii.gov.do/app/WebApps/ConsultasWeb2/ConsultasWeb/consultas/rnc.aspx"
_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Etiqueta tal como la muestra la tabla de la DGII -> clave de nuestro dict.
_FIELD_MAP = {
    "Nombre/Razón Social": "nombre",
    "Nombre Comercial": "nombre_comercial",
    "Categoría": "categoria",
    "Régimen de pagos": "regimen_pagos",
    "Estado": "estado",
    "Actividad Economica": "actividad_economica",
    "Administracion Local": "administracion_local",
    "Facturador Electrónico": "facturador_electronico",
}


def _hidden_value(soup: BeautifulSoup, name: str) -> str:
    el = soup.find("input", {"name": name})
    return el.get("value", "") if el else ""


def consultar_rnc(rnc_o_cedula: str, timeout: int = 12) -> dict | None:
    """Devuelve los datos publicos del contribuyente, o None si no se
    pudo consultar o el RNC/cedula no esta inscrito. Nunca lanza --
    cualquier fallo de red/formato se trata como "sin dato" para que el
    formulario de cliente siga funcionando sin esta ayuda.
    """
    limpio = re.sub(r"\D", "", rnc_o_cedula or "")
    if len(limpio) not in (9, 11):
        return None

    headers = {"User-Agent": _UA}
    try:
        with requests.Session() as sess:
            r1 = sess.get(_URL, headers=headers, timeout=timeout)
            r1.raise_for_status()
            soup = BeautifulSoup(r1.text, "html.parser")

            payload = {
                "ctl00$smMain": "ctl00$cphMain$upBusqueda|ctl00$cphMain$btnBuscarPorRNC",
                "__EVENTTARGET": "ctl00$cphMain$btnBuscarPorRNC",
                "__EVENTARGUMENT": "",
                "__VIEWSTATE": _hidden_value(soup, "__VIEWSTATE"),
                "__VIEWSTATEGENERATOR": _hidden_value(soup, "__VIEWSTATEGENERATOR"),
                "__EVENTVALIDATION": _hidden_value(soup, "__EVENTVALIDATION"),
                "ctl00$cphMain$txtRNCCedula": limpio,
                "ctl00$cphMain$txtRazonSocial": "",
                "ctl00$cphMain$hidActiveTab": "",
                "__ASYNCPOST": "true",
            }
            post_headers = {
                **headers,
                "X-Requested-With": "XMLHttpRequest",
                "X-MicrosoftAjax": "Delta=true",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Referer": _URL,
            }
            r2 = sess.post(_URL, data=payload, headers=post_headers, timeout=timeout)
            r2.raise_for_status()
    except requests.RequestException:
        logger.warning("consultar_rnc: fallo de red consultando DGII", exc_info=True)
        return None

    body = r2.text
    if "no se encuentra inscrito" in body:
        return None

    m = re.search(
        r'<table[^>]*id="cphMain_dvDatosContribuyentes"[^>]*>(.*?)</table>',
        body, re.DOTALL)
    if not m or "<tr" not in m.group(1):
        return None

    filas = BeautifulSoup(f"<table>{m.group(1)}</table>", "html.parser")
    out: dict = {}
    for tr in filas.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) != 2:
            continue
        etiqueta = tds[0].get_text(strip=True)
        valor = tds[1].get_text(strip=True)
        clave = _FIELD_MAP.get(etiqueta)
        if clave and valor:
            out[clave] = valor

    if not out.get("nombre"):
        return None
    out["rnc"] = limpio
    # Sugerencia de tipo de cliente/persona para el formulario -- el
    # operador siempre puede corregirla, nunca se fuerza.
    out["tipo_persona_sugerida"] = "F" if len(limpio) == 11 else "J"
    return out
