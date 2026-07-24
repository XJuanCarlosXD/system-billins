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
BUSQUEDA_AVANZADA_URL = (
    "https://comunidad.comprasdominicana.gob.do/Public/Tendering/"
    "ContractNoticeManagement/Index"
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


def parse_advanced_search_row_html(html: str) -> dict:
    """Parsea una fila ``<tr>`` de la tabla de resultados de la Búsqueda avanzada
    pública (``Public/Tendering/ContractNoticeManagement/Index``, sin login) --
    columnas Contracting Authority / Reference / Description / Official Publish
    Date / Replies Deadline / Base Price / Status / Detail. A diferencia de
    ``parse_oportunidad_row_html`` (feed autenticado, personalizado por
    empresa) esta pantalla es pública y trae todo lo publicado, sin matching
    por rubro."""
    soup = BeautifulSoup(html, "html.parser")
    row = soup.select_one("tr") or soup
    celdas = row.select("td")
    if len(celdas) < 7:
        raise ValueError(f"Fila de búsqueda avanzada con {len(celdas)} celdas, se esperaban 7+")

    return {
        "entidad": celdas[0].get_text(strip=True) or None,
        "referencia": celdas[1].get_text(strip=True),
        "titulo": celdas[2].get_text(strip=True) or None,
        "fecha_publicacion": _parse_fecha_busqueda_avanzada(celdas[3].get_text(strip=True)),
        "fecha_limite": _parse_fecha_busqueda_avanzada(celdas[4].get_text(strip=True)),
        "presupuesto_estimado": celdas[5].get_text(strip=True) or None,
        "estado_portal": celdas[6].get_text(strip=True) or None,
    }


def _parse_fecha_busqueda_avanzada(texto: str) -> str | None:
    """Convierte 'dd/mm/YYYY HH:MM (UTC -4 hours)' -> 'YYYY-mm-dd HH:MM'. Formato
    distinto al de ``_parse_fecha`` (feed autenticado, sin sufijo de zona horaria)."""
    texto = texto.strip()
    if not texto:
        return None
    match = re.match(r"(\d{2}/\d{2}/\d{4} \d{2}:\d{2})", texto)
    if not match:
        return None
    dt = datetime.strptime(match.group(1), "%d/%m/%Y %H:%M")
    return dt.strftime("%Y-%m-%d %H:%M")


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
        # --disable-dev-shm-usage: el contenedor Docker tiene /dev/shm limitado
        # a 64MB por defecto, insuficiente para Chromium y causa timeouts/
        # crashes intermitentes; hace que Chromium use /tmp en su lugar
        # (recomendación oficial de Playwright para entornos containerizados).
        self._browser = self._playwright.chromium.launch(
            headless=self._headless, args=["--disable-dev-shm-usage"]
        )
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
        # wait_until="domcontentloaded" (no "load"/"networkidle"): el portal
        # tiene un widget de chat embebido que sigue haciendo requests en
        # background indefinidamente, así que "load"/"networkidle" pueden
        # nunca resolver dentro del timeout — solo necesitamos el DOM listo
        # para interactuar con el formulario. timeout=60000 porque el portal
        # real puede tardar más de los 30000ms por defecto de Playwright.
        page.goto(LOGIN_URL, wait_until="domcontentloaded", timeout=60000)
        page.locator("#ctl00_content__login_UserName").fill(usuario)
        page.locator("#ctl00_content__login_Password").fill(password)
        page.locator("#ctl00_content__login_LoginButton").click()
        page.wait_for_load_state("domcontentloaded", timeout=60000)
        if "Login.aspx" in page.url:
            logger.error("lic.scraper.login: fallo de autenticación (usuario=%s)", usuario)
            raise LoginError("Su intento de entrada no se proceso con éxito")
        logger.info("lic.scraper.login: sesión iniciada correctamente (usuario=%s)", usuario)

    def list_oportunidades(self, estado_filtro: str = "Todos") -> list[dict]:
        logger.info("lic.scraper.list_oportunidades: iniciando (estado_filtro=%s)", estado_filtro)
        page = self._page
        # domcontentloaded (no networkidle): ver comentario en login() — el
        # widget de chat del portal impide que la red quede realmente idle.
        page.goto(OPORTUNIDADES_URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_load_state("domcontentloaded", timeout=60000)
        select = page.locator("select").first
        select.select_option(label=estado_filtro)
        page.wait_for_load_state("domcontentloaded", timeout=60000)

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

    def buscar_avanzada(self, status: str = "Published", tope: int = 1000) -> list[dict]:
        """Descubre licitaciones vía la pantalla PÚBLICA de Búsqueda avanzada
        (no requiere login) -- a diferencia de ``list_oportunidades`` (feed
        autenticado, personalizado por empresa según sus rubros RPE
        registrados), esta trae TODO lo publicado en el portal, sin filtrar
        por categoría. El propio análisis con IA (semáforo de cumplimiento +
        productos/servicios) es lo que ayuda al usuario a decidir "aplica o
        no" -- no un filtro previo aquí.

        Verificado en vivo el 2026-07-24: el link "(Advanced search)" abre un
        formulario con un solo botón "Go" relevante para este caso (Status);
        los resultados se paginan con un link "More Items" al pie de la tabla
        que se hace clic repetidamente hasta agotarse o llegar a ``tope``.
        """
        logger.info("lic.scraper.buscar_avanzada: iniciando (status=%s, tope=%d)", status, tope)
        page = self._page
        page.goto(self.BUSQUEDA_AVANZADA_URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_load_state("domcontentloaded", timeout=60000)

        page.get_by_role("link", name="(Advanced search)").click()
        page.wait_for_load_state("domcontentloaded", timeout=60000)
        # El combobox de Status no tiene un accessible name propio en el HTML real del
        # portal (ver snapshot capturado 2026-07-24) -- se selecciona por posición dentro
        # de la fila "Status" en vez de por rol/nombre.
        status_row = page.locator("tr", has=page.locator("td", has_text="Status"))
        if status_row.count():
            status_row.locator("select").first.select_option(label=status)
        page.get_by_role("button", name="Go").click()
        page.wait_for_load_state("domcontentloaded", timeout=60000)

        resultados: list[dict] = []
        vistos: set[str] = set()
        while len(resultados) < tope:
            filas = page.locator("table tr").filter(has=page.locator("a", has_text="Detail"))
            count = filas.count()
            nuevas = 0
            for i in range(count):
                html = filas.nth(i).evaluate("el => el.outerHTML")
                try:
                    data = parse_advanced_search_row_html(html)
                except ValueError:
                    continue
                if data["referencia"] in vistos:
                    continue
                vistos.add(data["referencia"])
                resultados.append(data)
                nuevas += 1
                if len(resultados) >= tope:
                    break

            more_link = page.get_by_role("link", name="More Items")
            if len(resultados) >= tope or more_link.count() == 0 or nuevas == 0:
                # nuevas == 0: la última pasada de "More Items" no agregó filas nuevas
                # (fin real de resultados), evita loop infinito si el link queda visible
                # pero ya no carga nada más.
                break
            more_link.click()
            page.wait_for_load_state("domcontentloaded", timeout=60000)

        logger.info(
            "lic.scraper.buscar_avanzada: %d oportunidades encontradas (status=%s)",
            len(resultados), status,
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
        # domcontentloaded (no networkidle): ver comentario en login() — el
        # widget de chat del portal impide que la red quede realmente idle.
        page.goto(OPORTUNIDADES_URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_load_state("domcontentloaded", timeout=60000)

        # Igual que list_oportunidades: sin seleccionar "Todos" la vista por
        # defecto del portal puede no incluir todas las oportunidades y una
        # referencia real terminaría reportándose como "no encontrada".
        select = page.locator("select").first
        select.select_option(label="Todos")
        page.wait_for_load_state("domcontentloaded", timeout=60000)

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

        # target_row.click() dispara una actualización AJAX parcial de la
        # página (un getAction() de Ariba), no una navegación completa — por
        # eso NO se usa wait_for_load_state aquí (ese evento nunca llega para
        # una actualización parcial). En vez de eso se espera directamente a
        # que el enlace que realmente necesitamos aparezca en el DOM.
        target_row.click()
        context = page.context
        cn_link = page.locator("a[href*='RedirectToContractNoticeInNewWindow']").first
        try:
            cn_link.wait_for(state="visible", timeout=15000)
        except PlaywrightTimeoutError:
            pass
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
            cn_page.wait_for_load_state("domcontentloaded", timeout=60000)

            # La pestaña "4. Documentos" a veces requiere un clic explícito
            # para que la tabla se renderice/quede visible; si el enlace no
            # aparece a tiempo seguimos con lo que ya haya en el DOM (algunas
            # vistas la muestran expandida por defecto).
            try:
                cn_page.locator("a[href='#ContractDocuments']").first.click(timeout=5000)
                cn_page.wait_for_load_state("domcontentloaded", timeout=60000)
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
            detalle = self._extraer_detalle_aviso_contrato(cn_page, referencia)
            return {"documentos": resultados, "detalle": detalle}
        finally:
            cn_page.close()

    @staticmethod
    def _extraer_detalle_aviso_contrato(cn_page, referencia: str) -> dict:
        """Lee del Aviso de Contrato (misma pestaña ya abierta para los
        documentos) datos que el portal ya muestra directamente, sin
        necesidad de IA: la descripción COMPLETA del proceso (el feed de
        Oportunidades la trunca a ~100 caracteres via CSS ellipsis, ver
        ``parse_oportunidad_row_html``), la unidad de requisición, y el
        presupuesto estimado. Selectores verificados en vivo el 2026-07-23
        contra CONADIS-DAF-CD-2026-0042 -- "Lugar de entrega" NO apareció en
        ese proceso (varía según el tipo de proceso/plantilla Ariba), así que
        no se intenta extraer acá; queda para una mejora futura si hace
        falta. Cualquier campo no encontrado queda en ``None`` sin abortar
        los demás ni la descarga de documentos que ya se completó."""
        detalle: dict[str, str | None] = {
            "descripcion_completa": None, "unidad_requisicion": None, "presupuesto_estimado": None,
        }
        try:
            loc = cn_page.locator("#divDescriptionDiv_spnDescription").first
            if loc.count() > 0:
                detalle["descripcion_completa"] = loc.inner_text().strip() or None
        except Exception:  # noqa: BLE001 - campo opcional, no debe tumbar el resto
            logger.warning("lic.scraper: no se pudo leer descripción completa (referencia=%s)", referencia)

        try:
            loc = cn_page.locator(
                "#fdsRequestSummaryInfoP2Gen_tblDetail_trRow6_tdCell2_spnBusinessOperationName"
            ).first
            if loc.count() > 0:
                detalle["unidad_requisicion"] = loc.inner_text().strip() or None
        except Exception:  # noqa: BLE001
            logger.warning("lic.scraper: no se pudo leer unidad de requisición (referencia=%s)", referencia)

        try:
            # La moneda (id "...Currency") puede ser un <input> tipo VortalTextBox
            # en vez de texto plano en algunas plantillas Ariba -- se lee con
            # una función que sirve para ambos casos (value si es input,
            # texto visible si no) en vez de asumir inner_text() ciegamente.
            def _leer_valor(selector: str) -> str:
                loc = cn_page.locator(selector).first
                if loc.count() == 0:
                    return ""
                return (loc.evaluate(
                    "el => (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') "
                    "? el.value : el.textContent"
                ) or "").strip()

            valor = _leer_valor("#incSigefInfoViewIncludecbxTotalPriceListValueValue")
            moneda = _leer_valor("#incSigefInfoViewIncludetxtTotalPriceListValueCurrency")
            if valor:
                detalle["presupuesto_estimado"] = f"{valor} {moneda}".strip()
        except Exception:  # noqa: BLE001
            logger.warning("lic.scraper: no se pudo leer presupuesto estimado (referencia=%s)", referencia)

        return detalle

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
