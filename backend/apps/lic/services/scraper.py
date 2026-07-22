"""Scraper del portal DGCP (SAP Ariba) vía Playwright."""
from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

LOGIN_URL = "https://comunidad.comprasdominicana.gob.do/STS/DGCP/Login.aspx"
OPORTUNIDADES_URL = (
    "https://portal.comprasdominicana.gob.do/DO1BusinessLine/Tendering/"
    "OpportunityDossierWorkspace/Index"
)


def _parse_fecha(texto: str) -> str | None:
    texto = texto.replace("\xa0", "").strip()
    if not texto:
        return None
    dt = datetime.strptime(texto, "%d/%m/%Y %H:%M")
    return dt.strftime("%Y-%m-%d %H:%M")


def parse_oportunidad_row_html(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    wrapper = soup.select_one(".ws_rc_wrapper_opportunity") or soup

    onclick = wrapper.get("onclick", "")
    uid_match = re.search(r"OpportunityDossierUId=' \+ '([\w.]+)'", onclick)
    opportunity_uid = uid_match.group(1) if uid_match else None

    descripciones = wrapper.select(".ws_rc_description")
    titulo = descripciones[0]["title"].strip() if len(descripciones) > 0 else None
    entidad_raw = descripciones[1]["title"].strip() if len(descripciones) > 1 else ""
    entidad = entidad_raw.split("|", 1)[-1].strip() if "|" in entidad_raw else entidad_raw

    contadores = wrapper.select(".ws_rc_replyCounter")
    ofertas_presentadas = int(contadores[0].select_one(".VortalSpan").text.strip()) if contadores else 0
    ofertas_creadas = 0
    for div in contadores:
        if "ws_rc_replyCounter_opportunity" in div.get("class", []):
            ofertas_creadas = int(div.select_one(".VortalSpan").text.strip())

    fechas = {}
    labels = wrapper.select(".ws_rc_dateLabel")
    values = wrapper.select(".ws_rc_date")
    for label, value in zip(labels, values):
        fechas[label.text.strip()] = _parse_fecha(value.text)

    return {
        "referencia": wrapper.select_one(".ws_rc_reference")["title"].strip(),
        "opportunity_uid": opportunity_uid,
        "estado_portal": wrapper.select_one(".ws_rc_state")["title"].strip(),
        "tipo_proceso": wrapper.select_one(".ws_rc_businessOperationLabel")["title"].strip(),
        "titulo": titulo,
        "entidad": entidad,
        "ofertas_presentadas": ofertas_presentadas,
        "ofertas_creadas": ofertas_creadas,
        "fecha_limite": fechas.get("Fecha límite:"),
        "fecha_publicacion": fechas.get("Publicado:"),
    }


class LoginError(Exception):
    pass


class LicitacionesScraper:
    """Una instancia = una sesión de navegador para una empresa."""

    def __init__(self, headless: bool = True):
        self._headless = headless
        self._playwright = None
        self._browser = None
        self._page = None

    def __enter__(self) -> "LicitacionesScraper":
        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(headless=self._headless)
        self._page = self._browser.new_page()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._browser:
            self._browser.close()
        if self._playwright:
            self._playwright.stop()

    def login(self, usuario: str, password: str) -> None:
        # Nota: el formulario de login del portal STS/DGCP está en inglés
        # (placeholders "Username"/"Password") pese a que el resto del portal
        # está en español; verificado en vivo el 2026-07-22 con las
        # credenciales de abregonza. Se usan los ids reales de los campos
        # ASP.NET en vez de accessible names, que no existen en este formulario.
        page = self._page
        page.goto(LOGIN_URL)
        page.wait_for_load_state("load")
        page.locator("#ctl00_content__login_UserName").fill(usuario)
        page.locator("#ctl00_content__login_Password").fill(password)
        page.locator("#ctl00_content__login_LoginButton").click()
        page.wait_for_load_state("networkidle")
        if "Login.aspx" in page.url:
            raise LoginError("Su intento de entrada no se proceso con éxito")

    def list_oportunidades(self, estado_filtro: str = "Todos") -> list[dict]:
        page = self._page
        page.goto(OPORTUNIDADES_URL)
        page.wait_for_load_state("networkidle")
        select = page.locator("select").first
        select.select_option(label=estado_filtro)
        page.wait_for_load_state("networkidle")

        wrappers = page.locator(".ws_rc_wrapper_opportunity")
        count = wrappers.count()
        resultados = []
        for i in range(count):
            html = wrappers.nth(i).evaluate("el => el.outerHTML")
            resultados.append(parse_oportunidad_row_html(html))
        return resultados

    def download_documentos(self, referencia: str, destino_dir: Path) -> list[dict]:
        """Descarga los documentos oficiales del proceso (Pliego de Condiciones,
        especificaciones/fichas técnicas, anexos, etc.) publicados por la
        entidad compradora para la oportunidad con la referencia OD dada.

        Flujo verificado en vivo el 2026-07-22 con las credenciales de
        abregonza (oportunidad AGN-DAF-CM-2025-0038, 8 documentos reales
        descargados con éxito, tamaños de 160KB-665KB):

        1. En el feed de Oportunidades, la fila de la referencia buscada trae
           (una vez clickeada) un enlace "Abrir en una nueva pestaña" cuyo
           href contiene ``RedirectToContractNoticeInNewWindow`` — abre en una
           pestaña nueva el "Aviso de Contrato" (``ContractNoticeView/Index``),
           que es una página Ariba distinta del "Detalle"/work-area
           (``RedirectToWorkAreaInNewWindow``, que en cambio expone nuestra
           propia oferta y sus documentos, no los del proceso).
        2. En esa pestaña, la sección "Documentos del Proceso" es una tabla
           real (``#grdGridDocumentList_tbl``, dentro del fieldset
           ``#fdsDocumentListP2Gen``) con una fila por documento:
           - Nombre: ``span[id^='tdColumnDocumentNameP2Gen_spnDocumentName_']``
           - Tipo: ``span[id^='spnColumnDocumentTypeSpan_']`` (p.ej. "Pliego de
             Condiciones", "Solicitud Compra o Contratación")
           - Descarga: ``a[id^='lnkDownloadLinkP3Gen_']`` con
             ``onclick="getAction('/DO1BusinessLine/Tendering/ContractNoticeView/
             DownloadFile?documentId=<id>&mkey=<mkey>', true)"``. Al hacer clic,
             Playwright captura el evento ``download`` (resuelve a
             ``/DO1BusinessLine/Archive/RetrieveFile/Index?DocumentId=<id>...``)
             y el archivo se puede guardar directamente con
             ``download.save_as(...)`` — no hay que interceptar la navegación
             manualmente.
        """
        destino_dir.mkdir(parents=True, exist_ok=True)
        page = self._page
        page.goto(OPORTUNIDADES_URL)
        page.wait_for_load_state("networkidle")

        wrappers = page.locator(".ws_rc_wrapper_opportunity")
        count = wrappers.count()
        target_row = None
        for i in range(count):
            ref_text = wrappers.nth(i).locator(".ws_rc_reference").first.inner_text().strip()
            if ref_text == referencia:
                target_row = wrappers.nth(i)
                break
        if target_row is None:
            raise ValueError(f"No se encontró la oportunidad con referencia {referencia!r}")

        target_row.click()
        page.wait_for_load_state("networkidle")

        context = page.context
        cn_link = page.locator("a[href*='RedirectToContractNoticeInNewWindow']").first
        with context.expect_page() as new_page_info:
            cn_link.click()
        cn_page = new_page_info.value
        cn_page.wait_for_load_state("networkidle")

        # La pestaña "4. Documentos" a veces requiere un clic explícito para
        # que la tabla se renderice/quede visible.
        try:
            cn_page.locator("a[href='#ContractDocuments']").first.click(timeout=5000)
            cn_page.wait_for_load_state("networkidle")
        except Exception:
            pass

        resultados: list[dict] = []
        filas = cn_page.locator("#grdGridDocumentList_tbl tr[id^='grdGridDocumentList_tr']")
        for i in range(filas.count()):
            fila = filas.nth(i)
            nombre_loc = fila.locator("span[id^='tdColumnDocumentNameP2Gen_spnDocumentName_']")
            tipo_loc = fila.locator("span[id^='spnColumnDocumentTypeSpan_']")
            descargar_loc = fila.locator("a[id^='lnkDownloadLinkP3Gen_']")
            if nombre_loc.count() == 0 or descargar_loc.count() == 0:
                continue

            nombre_archivo = nombre_loc.first.inner_text().strip()
            tipo_documento = tipo_loc.first.inner_text().strip() if tipo_loc.count() else ""

            with cn_page.expect_download() as download_info:
                descargar_loc.first.click()
            download = download_info.value
            ruta_archivo = destino_dir / nombre_archivo
            download.save_as(str(ruta_archivo))

            resultados.append({
                "tipo_documento": tipo_documento,
                "nombre_archivo": nombre_archivo,
                "ruta_archivo": str(ruta_archivo),
            })

        cn_page.close()
        return resultados
