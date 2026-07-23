"""Scraper del portal DGCP (SAP Ariba) vía Playwright."""
from __future__ import annotations

import logging
import re
from datetime import datetime
from pathlib import Path

from bs4 import BeautifulSoup
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

logger = logging.getLogger(__name__)

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


_DOCUMENT_ID_RE = re.compile(r"'documentId=' \+ '(\d+)'")


def parse_documento_row_html(html: str) -> dict:
    """Parsea una fila ``<tr>`` de la tabla ``#grdGridDocumentList_tbl``
    ("Documentos del Proceso" dentro del Aviso de Contrato) y extrae el
    nombre de archivo, el tipo de documento y el id interno Ariba del
    documento (este último se usa para desambiguar nombres de archivo
    duplicados al descargar).

    Es pura y testeable contra un fragmento de HTML capturado en vivo, igual
    que ``parse_oportunidad_row_html``.
    """
    soup = BeautifulSoup(html, "html.parser")
    row = soup.select_one("tr") or soup

    nombre_el = row.select_one("span[id*='spnDocumentName_']")
    tipo_el = row.select_one("span[id*='spnColumnDocumentTypeSpan_']")
    descargar_el = row.select_one("a[id*='lnkDownloadLinkP3Gen_']")

    document_id = None
    if descargar_el is not None:
        match = _DOCUMENT_ID_RE.search(descargar_el.get("onclick", ""))
        document_id = match.group(1) if match else None

    return {
        "nombre_archivo": nombre_el.text.strip() if nombre_el else None,
        "tipo_documento": tipo_el.text.strip() if tipo_el else "",
        "document_id": document_id,
    }


class LoginError(Exception):
    pass


class DocumentoNoDisponibleError(Exception):
    """El Aviso de Contrato de una oportunidad no expuso la sección de
    documentos del proceso como se esperaba (enlace, pestaña o tabla
    ausentes), o un documento puntual no se pudo descargar."""


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
        logger.info("lic.scraper.login: iniciando sesión (usuario=%s)", usuario)
        page = self._page
        page.goto(LOGIN_URL)
        page.wait_for_load_state("load")
        page.locator("#ctl00_content__login_UserName").fill(usuario)
        page.locator("#ctl00_content__login_Password").fill(password)
        page.locator("#ctl00_content__login_LoginButton").click()
        page.wait_for_load_state("networkidle")
        if "Login.aspx" in page.url:
            logger.error("lic.scraper.login: fallo de autenticación (usuario=%s)", usuario)
            raise LoginError("Su intento de entrada no se proceso con éxito")
        logger.info("lic.scraper.login: sesión iniciada correctamente (usuario=%s)", usuario)

    def list_oportunidades(self, estado_filtro: str = "Todos") -> list[dict]:
        logger.info("lic.scraper.list_oportunidades: iniciando (estado_filtro=%s)", estado_filtro)
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
        logger.info(
            "lic.scraper.list_oportunidades: %d oportunidades encontradas (estado_filtro=%s)",
            len(resultados), estado_filtro,
        )
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

        Cada documento se descarga en su propio try/except: si uno falla, el
        resto de la corrida continúa y ese documento queda registrado con
        ``estado: "error"`` en vez de abortar toda la descarga. Los nombres de
        archivo duplicados dentro de una misma corrida (frecuente en portales
        de gobierno — p.ej. dos revisiones de "Pliego de Condiciones.pdf") se
        desambiguan agregando el id interno Ariba del documento.
        """
        logger.info("lic.scraper.download_documentos: iniciando (referencia=%s)", referencia)
        destino_dir.mkdir(parents=True, exist_ok=True)
        page = self._page
        page.goto(OPORTUNIDADES_URL)
        page.wait_for_load_state("networkidle")

        # Igual que list_oportunidades: sin seleccionar "Todos" la vista por
        # defecto del portal puede no incluir todas las oportunidades y una
        # referencia real terminaría reportándose como "no encontrada".
        select = page.locator("select").first
        select.select_option(label="Todos")
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
            logger.error("lic.scraper.download_documentos: referencia=%s no encontrada en el feed", referencia)
            raise ValueError(f"No se encontró la oportunidad con referencia {referencia!r}")

        target_row.click()
        page.wait_for_load_state("networkidle")

        context = page.context
        cn_link = page.locator("a[href*='RedirectToContractNoticeInNewWindow']").first
        if cn_link.count() == 0:
            logger.error(
                "lic.scraper.download_documentos: referencia=%s sin enlace al Aviso de Contrato", referencia
            )
            raise DocumentoNoDisponibleError(
                f"La oportunidad {referencia!r} no tiene enlace al Aviso de Contrato "
                "(RedirectToContractNoticeInNewWindow)"
            )

        try:
            with context.expect_page() as new_page_info:
                cn_link.click()
            cn_page = new_page_info.value
        except PlaywrightTimeoutError as exc:
            logger.error(
                "lic.scraper.download_documentos: referencia=%s no abrió la pestaña del Aviso de Contrato",
                referencia,
            )
            raise DocumentoNoDisponibleError(
                f"No se pudo abrir la pestaña del Aviso de Contrato para {referencia!r}"
            ) from exc

        try:
            cn_page.wait_for_load_state("networkidle")

            # La pestaña "4. Documentos" a veces requiere un clic explícito
            # para que la tabla se renderice/quede visible; si el enlace no
            # aparece a tiempo seguimos con lo que ya haya en el DOM (algunas
            # vistas la muestran expandida por defecto).
            try:
                cn_page.locator("a[href='#ContractDocuments']").first.click(timeout=5000)
                cn_page.wait_for_load_state("networkidle")
            except PlaywrightTimeoutError:
                pass

            tabla = cn_page.locator("#grdGridDocumentList_tbl")
            try:
                tabla.wait_for(state="attached", timeout=10000)
            except PlaywrightTimeoutError as exc:
                logger.error(
                    "lic.scraper.download_documentos: referencia=%s sin tabla de documentos del proceso",
                    referencia,
                )
                raise DocumentoNoDisponibleError(
                    f"El Aviso de Contrato de {referencia!r} no expuso la tabla de documentos del proceso"
                ) from exc

            resultados: list[dict] = []
            nombres_usados: set[str] = set()
            filas = cn_page.locator("#grdGridDocumentList_tbl tr[id^='grdGridDocumentList_tr']")
            total_filas = filas.count()

            for i in range(total_filas):
                fila = filas.nth(i)
                try:
                    fila_html = fila.evaluate("el => el.outerHTML")
                    datos = parse_documento_row_html(fila_html)
                    nombre_archivo = datos["nombre_archivo"]
                    tipo_documento = datos["tipo_documento"]
                    document_id = datos["document_id"]

                    if nombre_archivo is None:
                        raise DocumentoNoDisponibleError(
                            f"Fila {i} de la tabla de documentos sin nombre de archivo reconocible"
                        )

                    descargar_loc = fila.locator("a[id^='lnkDownloadLinkP3Gen_']")
                    if descargar_loc.count() == 0:
                        raise DocumentoNoDisponibleError(
                            f"Documento {nombre_archivo!r} sin enlace de descarga"
                        )

                    ruta_archivo = self._ruta_sin_colision(destino_dir, nombre_archivo, document_id, nombres_usados)

                    with cn_page.expect_download() as download_info:
                        descargar_loc.first.click()
                    download = download_info.value
                    download.save_as(str(ruta_archivo))

                    resultados.append({
                        "tipo_documento": tipo_documento,
                        "nombre_archivo": ruta_archivo.name,
                        "ruta_archivo": str(ruta_archivo),
                        "estado": "ok",
                    })
                except Exception as exc:  # noqa: BLE001 - se registra y se continúa a propósito
                    logger.exception(
                        "lic.scraper.download_documentos: referencia=%s fallo al descargar documento %d/%d",
                        referencia, i + 1, total_filas,
                    )
                    resultados.append({
                        "tipo_documento": None,
                        "nombre_archivo": None,
                        "ruta_archivo": None,
                        "estado": "error",
                        "error": str(exc),
                    })
                    continue

            ok_count = sum(1 for r in resultados if r["estado"] == "ok")
            error_count = len(resultados) - ok_count
            logger.info(
                "lic.scraper.download_documentos: referencia=%s finalizado (%d ok, %d error de %d filas)",
                referencia, ok_count, error_count, total_filas,
            )
            return resultados
        finally:
            cn_page.close()

    @staticmethod
    def _ruta_sin_colision(
        destino_dir: Path, nombre_archivo: str, document_id: str | None, nombres_usados: set[str]
    ) -> Path:
        """Evita sobrescrituras silenciosas cuando dos documentos de la misma
        corrida comparten nombre (común en portales de gobierno, p.ej. dos
        revisiones de "Pliego de Condiciones.pdf"): si el nombre ya se usó en
        esta llamada, se desambigua agregando el id interno Ariba del
        documento (o un contador incremental si no hay id disponible)."""
        candidato = nombre_archivo
        if candidato in nombres_usados:
            base = Path(nombre_archivo)
            sufijo = document_id or str(len(nombres_usados) + 1)
            candidato = f"{base.stem}__{sufijo}{base.suffix}"
            contador = 2
            while candidato in nombres_usados:
                candidato = f"{base.stem}__{sufijo}_{contador}{base.suffix}"
                contador += 1
        nombres_usados.add(candidato)
        return destino_dir / candidato
