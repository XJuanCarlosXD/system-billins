# LIC — Descubrimiento amplio, catálogo de documentos y detalle en página completa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar el descubrimiento de licitaciones del módulo LIC vía la Búsqueda avanzada pública del portal DGCP (con paginación real), agregar un catálogo administrable de tipos de documento de empresa con una vista dedicada de subida en Configuración, extender el análisis con IA para listar productos/servicios pedidos y documentos faltantes (solo señalar, sin generar), y reemplazar el modal de detalle de una oportunidad por una página completa con orden fijo (descripción → requisitos → productos → documentos) y botones de descarga reales.

**Architecture:** Backend Django "vistas planas" (sin DRF, mismo estilo que el resto de `apps/lic`) + repositorio Oracle (`apps/legacy/repositories/lic_repo.py`, patrón secuencia+trigger). Frontend React + TanStack Router (rutas por archivo) + TanStack Query, mismos hooks/convenciones ya usados en `features/lic/api.ts`. Sin dependencias nuevas.

**Tech Stack:** Django 5.1, oracledb (thick mode), Playwright (sync API), pytest + pytest-django, React 19, TanStack Router/Query, shadcn/ui, Anthropic SDK (`apps.lic.services.analisis_licitacion`).

---

## Antes de empezar

Todas las migraciones SQL de este plan se ejecutan a mano contra Oracle (mismo patrón que
`apps/lic/sql/001_create_tlic.sql` / `002_requisitos_empresa.sql`), no hay migraciones Django. Se
corren con `sqlplus` o vía `docker compose exec backend python manage.py dbshell` en la VM
(`10.0.0.99`), y **antes** de correr el código Python que depende de la tabla/columna nueva.

Todo backend se sube a la VM y se prueba con `docker compose exec -T backend python manage.py test
apps.lic` + smoke HTTP (`django.test.Client`), siguiendo `sigaft-deploy-vm`. El frontend se prueba
con `tsc --noEmit` local antes de cada commit; el deploy real es push a `main` → Netlify.

---

## Parte A — Scraper: descubrimiento vía Búsqueda avanzada pública

### Task 1: Parseo puro de filas de la Búsqueda avanzada

**Files:**
- Modify: `backend/apps/lic/services/scraper.py`
- Test: `backend/apps/lic/tests/test_scraper_advanced_search_parse.py` (crear)

- [ ] **Step 1: Escribir el test con un fixture de HTML real**

El HTML de una fila de la tabla de resultados de `ContractNoticeManagement/Index` (capturado en
la exploración en vivo del 2026-07-24) tiene esta forma (columnas: Contracting Authority,
Reference, Description, Official Publish Date, Replies Deadline, Base Price, Status, Detail):

```python
# backend/apps/lic/tests/test_scraper_advanced_search_parse.py
from apps.lic.services.scraper import parse_advanced_search_row_html

FILA_HTML = """
<tr>
  <td>Instituto Nacional de formación Técnico Profesional</td>
  <td>INFOTEP-DAF-CD-2026-0889</td>
  <td>&#8220;Adquisición de equipos de enfermería para uso en Nueva Escuela Hotel Guarocuya&#34;</td>
  <td>24/07/2026 11:35 (UTC -4 hours)</td>
  <td>24/07/2026 11:40 (UTC -4 hours)</td>
  <td>150,000 Dominican Pesos</td>
  <td>Published</td>
  <td><a>Detail</a></td>
</tr>
"""


def test_parse_advanced_search_row_html_extrae_todos_los_campos():
    data = parse_advanced_search_row_html(FILA_HTML)
    assert data == {
        "entidad": "Instituto Nacional de formación Técnico Profesional",
        "referencia": "INFOTEP-DAF-CD-2026-0889",
        "titulo": "“Adquisición de equipos de enfermería para uso en Nueva Escuela Hotel Guarocuya\"",
        "fecha_publicacion": "2026-07-24 11:35",
        "fecha_limite": "2026-07-24 11:40",
        "presupuesto_estimado": "150,000 Dominican Pesos",
        "estado_portal": "Published",
    }


def test_parse_advanced_search_row_html_fecha_vacia_da_none():
    html = FILA_HTML.replace("24/07/2026 11:40 (UTC -4 hours)", "")
    data = parse_advanced_search_row_html(html)
    assert data["fecha_limite"] is None
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_scraper_advanced_search_parse -v 2`
Expected: FAIL con `ImportError: cannot import name 'parse_advanced_search_row_html'`

- [ ] **Step 3: Implementar `parse_advanced_search_row_html` en `scraper.py`**

Agregar junto a `parse_documento_row_html` (después de la línea 99, antes de `class LoginError`):

```python
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
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_scraper_advanced_search_parse -v 2`
Expected: `OK` (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/apps/lic/services/scraper.py backend/apps/lic/tests/test_scraper_advanced_search_parse.py
git commit -m "feat(lic): parseo de filas de la Busqueda avanzada publica del portal DGCP"
```

### Task 2: Método `buscar_avanzada` en `LicitacionesScraper`

**Files:**
- Modify: `backend/apps/lic/services/scraper.py`

No hay test automatizado para este método (mismo criterio que el resto de la clase: la
automatización de navegador real no se presta a pruebas unitarias significativas — se verifica en
vivo en el Task 4). Es una única función determinista y bien acotada, así que se implementa
directo con verificación manual.

- [ ] **Step 1: Agregar la constante de URL y el método**

Agregar junto a `OPORTUNIDADES_URL` (línea 16-19):

```python
BUSQUEDA_AVANZADA_URL = (
    "https://comunidad.comprasdominicana.gob.do/Public/Tendering/"
    "ContractNoticeManagement/Index"
)
```

Agregar como método de `LicitacionesScraper`, después de `list_oportunidades` (después de la
línea 184):

```python
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
        page.get_by_role("combobox").filter(has_text="Status").select_option(label=status) \
            if page.locator("select#Status").count() else None
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
```

- [ ] **Step 2: Verificación estática**

Run: `docker compose exec -T backend python -c "from apps.lic.services.scraper import LicitacionesScraper; print('import ok')"`
Expected: `import ok` (sin excepciones de sintaxis/import)

- [ ] **Step 3: Commit**

```bash
git add backend/apps/lic/services/scraper.py
git commit -m "feat(lic): metodo buscar_avanzada contra la Busqueda avanzada publica del portal"
```

### Task 3: Orquestador — descubrir vía búsqueda avanzada antes del login por empresa

**Files:**
- Modify: `backend/apps/lic/services/orchestrator.py`
- Test: `backend/apps/lic/tests/test_orchestrator.py`

- [ ] **Step 1: Escribir el test para el nuevo paso**

Agregar al final de `test_orchestrator.py`:

```python
@pytest.mark.django_db
def test_ejecutar_scrape_descubre_via_busqueda_avanzada_antes_del_login_por_empresa():
    """La busqueda avanzada publica corre UNA vez por corrida (no depende de
    credenciales) y hace upsert para cada empresa activa antes de procesar
    login/documentos por empresa."""
    job = ScrapeJob.objects.create(trigger="manual", no_cia=None)
    credencial = {"no_cia": "01", "usuario_portal": "abregonza", "password_cifrado": "x"}

    with patch("apps.lic.services.orchestrator.lic_repo") as repo, \
         patch("apps.lic.services.orchestrator.crypto") as crypto, \
         patch("apps.lic.services.orchestrator.LicitacionesScraper") as ScraperCls:
        repo.get_credencial_con_password.return_value = credencial
        crypto.decrypt.return_value = "plain-password"
        repo.upsert_oportunidad.return_value = (1, True)
        repo.tiene_documentos.return_value = True  # ya tiene documentos, no reintenta descarga
        scraper_instance = MagicMock()
        scraper_instance.buscar_avanzada.return_value = [
            {"referencia": "PUB-1", "entidad": "Ministerio X", "titulo": "algo",
             "estado_portal": "Published", "fecha_publicacion": "2026-07-24 09:00",
             "fecha_limite": "2026-07-30 09:00", "presupuesto_estimado": "100,000 Dominican Pesos"}
        ]
        scraper_instance.list_oportunidades.return_value = []
        ScraperCls.return_value.__enter__.return_value = scraper_instance

        ejecutar_scrape(job, empresas=["01"])

    scraper_instance.buscar_avanzada.assert_called_once_with(status="Published", tope=1000)
    repo.upsert_oportunidad.assert_any_call("01", scraper_instance.buscar_avanzada.return_value[0])
    job.refresh_from_db()
    assert job.resumen["errores"] == []


@pytest.mark.django_db
def test_ejecutar_scrape_continua_si_busqueda_avanzada_falla():
    """Un fallo en la busqueda avanzada publica (portal caido, cambio de layout) no debe
    tumbar el resto de la corrida -- se registra como error aislado y se sigue con el
    feed autenticado normal."""
    job = ScrapeJob.objects.create(trigger="manual", no_cia="01")
    credencial = {"no_cia": "01", "usuario_portal": "abregonza", "password_cifrado": "x"}

    with patch("apps.lic.services.orchestrator.lic_repo") as repo, \
         patch("apps.lic.services.orchestrator.crypto") as crypto, \
         patch("apps.lic.services.orchestrator.LicitacionesScraper") as ScraperCls:
        repo.get_credencial_con_password.return_value = credencial
        crypto.decrypt.return_value = "plain-password"
        scraper_instance = MagicMock()
        scraper_instance.buscar_avanzada.side_effect = RuntimeError("selector no encontrado")
        scraper_instance.list_oportunidades.return_value = []
        ScraperCls.return_value.__enter__.return_value = scraper_instance

        ejecutar_scrape(job, empresas=["01"])

    job.refresh_from_db()
    assert job.estado == "completado_con_errores"
    errores = job.resumen["errores"]
    assert any(
        e["contexto"] == "busqueda_avanzada" and e["mensaje"] == "selector no encontrado"
        for e in errores
    )
```

- [ ] **Step 2: Correr los tests nuevos y confirmar que fallan**

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_orchestrator.test_ejecutar_scrape_descubre_via_busqueda_avanzada_antes_del_login_por_empresa apps.lic.tests.test_orchestrator.test_ejecutar_scrape_continua_si_busqueda_avanzada_falla -v 2`
Expected: FAIL — `AssertionError: Expected 'buscar_avanzada' to have been called once` (el método no se llama todavía)

- [ ] **Step 3: Implementar el paso en `ejecutar_scrape`**

Reemplazar el cuerpo de `ejecutar_scrape` (líneas 17-67) por:

```python
def ejecutar_scrape(job: ScrapeJob, empresas: list[str]) -> None:
    resumen = {
        "oportunidades_nuevas": 0,
        "documentos_descargados": 0,
        "empresas_procesadas": [],
        "errores": [],
    }

    _descubrir_via_busqueda_avanzada(empresas, resumen)

    for no_cia in empresas:
        credencial = lic_repo.get_credencial_con_password(no_cia)
        if not credencial:
            _agregar_error(resumen, no_cia, "sin credencial configurada", contexto="credencial")
            continue

        try:
            password = crypto.decrypt(credencial["password_cifrado"])
            with LicitacionesScraper() as scraper:
                scraper.login(credencial["usuario_portal"], password)
                lic_repo.marcar_login_resultado(no_cia, ok=True)
                oportunidades = scraper.list_oportunidades()
                for data in oportunidades:
                    oportunidad_id, es_nueva = lic_repo.upsert_oportunidad(no_cia, data)
                    if not es_nueva and lic_repo.tiene_documentos(oportunidad_id):
                        continue
                    if es_nueva:
                        resumen["oportunidades_nuevas"] += 1
                    _descargar_y_guardar_documentos(
                        scraper, no_cia, data["referencia"], oportunidad_id, resumen
                    )
                    _analizar_y_registrar(no_cia, data["referencia"], oportunidad_id, resumen)
            resumen["empresas_procesadas"].append(no_cia)
        except LoginError as exc:
            lic_repo.marcar_login_resultado(no_cia, ok=False, mensaje_error=str(exc))
            _agregar_error(resumen, no_cia, str(exc), contexto="login")
        except Exception as exc:  # noqa: BLE001 - se registra y se sigue con las demás empresas
            _agregar_error(resumen, no_cia, str(exc), contexto="empresa")

    job.resumen = resumen
    job.estado = "completado_con_errores" if resumen["errores"] else "completado"
    job.terminado_en = timezone.now()
    job.save()


def _descubrir_via_busqueda_avanzada(empresas: list[str], resumen: dict) -> None:
    """Corre UNA sola vez por corrida (no depende de credenciales -- la Búsqueda
    avanzada es pública) y hace upsert de las oportunidades encontradas para
    CADA empresa de ``empresas``: las licitaciones públicas aplican por igual a
    todas las empresas del grupo, el filtrado por aplicabilidad real lo hace el
    análisis de IA por empresa más adelante, no el descubrimiento. Un fallo acá
    (portal caído, cambio de layout) se registra como error aislado y NO
    bloquea el resto de la corrida -- el feed autenticado por empresa sigue
    corriendo igual como respaldo."""
    try:
        with LicitacionesScraper() as scraper:
            oportunidades = scraper.buscar_avanzada(status="Published", tope=1000)
    except Exception as exc:  # noqa: BLE001 - fallo aislado, no debe tumbar la corrida
        _agregar_error(resumen, "*", str(exc), contexto="busqueda_avanzada")
        return

    for no_cia in empresas:
        for data in oportunidades:
            lic_repo.upsert_oportunidad(no_cia, data)
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_orchestrator -v 2`
Expected: `OK` (todos los tests del archivo, incluyendo los 2 nuevos y los preexistentes)

- [ ] **Step 5: Commit**

```bash
git add backend/apps/lic/services/orchestrator.py backend/apps/lic/tests/test_orchestrator.py
git commit -m "feat(lic): descubrir licitaciones via Busqueda avanzada publica antes del login por empresa"
```

### Task 4: Verificación en vivo del flujo completo de descubrimiento

**Files:** ninguno (verificación manual, sin cambios de código)

- [ ] **Step 1: Subir el backend actualizado a la VM**

Seguir `sigaft-deploy-vm`: subir `scraper.py` y `orchestrator.py` con `pscp`, reiniciar el backend.

```bash
docker compose restart backend
```

- [ ] **Step 2: Disparar "Buscar ahora" para la empresa 01 desde el frontend** (o directo con curl)

```bash
curl -sk -X POST https://grupo-abregonza.hopto.org:8443/api/lic/scrape/ \
  -H "Content-Type: application/json" -b cookies.txt -d '{"no_cia": "01"}'
```

- [ ] **Step 3: Confirmar en el log del contenedor que `buscar_avanzada` corrió y trajo resultados**

Run: `docker compose logs backend --since 5m | grep "lic.scraper.buscar_avanzada"`
Expected: una línea `iniciando` y una `N oportunidades encontradas` con N mayor al conteo previo
en `TLIC_OPORTUNIDAD` para la empresa 01 (confirmar contando filas antes/después con
`SELECT COUNT(*) FROM FAT.TLIC_OPORTUNIDAD WHERE no_cia = '01'`).

- [ ] **Step 4: Si algún selector no coincide con el portal real, ajustar `scraper.py` y repetir Steps 1-3**

No hay commit propio en esta tarea salvo que Step 4 requiera un ajuste — en ese caso, commitear
igual que las tareas anteriores con mensaje `fix(lic): ajustar selector de Busqueda avanzada
segun prueba en vivo`.

---

## Parte B — Configuración › Licitación: catálogo de tipos de documento + vista dedicada

### Task 5: Migración SQL — catálogo de tipos de documento

**Files:**
- Create: `backend/apps/lic/sql/003_tipo_documento.sql`

- [ ] **Step 1: Escribir el DDL**

```sql
-- Fase: catalogo administrable de tipos de documento de empresa (Configuracion > Licitacion).
-- Ejecutar manualmente, mismo patron que 001_create_tlic.sql / 002_requisitos_empresa.sql.

CREATE TABLE FAT.TLIC_TIPO_DOCUMENTO (
    ID     NUMBER PRIMARY KEY,
    CODIGO VARCHAR2(30) NOT NULL,
    NOMBRE VARCHAR2(200) NOT NULL,
    ACTIVO VARCHAR2(1) DEFAULT 'S' NOT NULL,
    CONSTRAINT UQ_TLIC_TIPO_DOCUMENTO_COD UNIQUE (CODIGO),
    CONSTRAINT CK_TLIC_TIPO_DOCUMENTO_ACTIVO CHECK (ACTIVO IN ('S', 'N'))
);
/

CREATE SEQUENCE FAT.SEQ_TLIC_TIPO_DOCUMENTO;
/

CREATE OR REPLACE TRIGGER FAT.TRG_TLIC_TIPO_DOCUMENTO_ID
BEFORE INSERT ON FAT.TLIC_TIPO_DOCUMENTO
FOR EACH ROW
WHEN (NEW.ID IS NULL)
BEGIN
    :NEW.ID := FAT.SEQ_TLIC_TIPO_DOCUMENTO.NEXTVAL;
END;
/

INSERT INTO FAT.TLIC_TIPO_DOCUMENTO (CODIGO, NOMBRE) VALUES ('DGI', 'Constancia de Impuestos DGI al día');
INSERT INTO FAT.TLIC_TIPO_DOCUMENTO (CODIGO, NOMBRE) VALUES ('TSS', 'Constancia TSS al día');
INSERT INTO FAT.TLIC_TIPO_DOCUMENTO (CODIGO, NOMBRE) VALUES ('RNC', 'Documento RNC');
INSERT INTO FAT.TLIC_TIPO_DOCUMENTO (CODIGO, NOMBRE) VALUES ('ACTAS', 'Actas');
INSERT INTO FAT.TLIC_TIPO_DOCUMENTO (CODIGO, NOMBRE) VALUES ('REGMERC', 'Registro Mercantil');
COMMIT;
/

ALTER TABLE FAT.TLIC_DOCUMENTO_EMPRESA ADD TIPO_DOCUMENTO_ID NUMBER;
/

ALTER TABLE FAT.TLIC_DOCUMENTO_EMPRESA ADD CONSTRAINT FK_TLIC_DOCEMP_TIPODOC
    FOREIGN KEY (TIPO_DOCUMENTO_ID) REFERENCES FAT.TLIC_TIPO_DOCUMENTO(ID);
/
```

- [ ] **Step 2: Ejecutar contra Oracle en la VM**

```bash
docker compose exec -T backend python manage.py dbshell < backend/apps/lic/sql/003_tipo_documento.sql
```

Expected: sin errores ORA-*; confirmar con
`SELECT codigo, nombre FROM FAT.TLIC_TIPO_DOCUMENTO ORDER BY id;` → 5 filas.

- [ ] **Step 3: Commit**

```bash
git add backend/apps/lic/sql/003_tipo_documento.sql
git commit -m "feat(lic): tabla TLIC_TIPO_DOCUMENTO y FK en TLIC_DOCUMENTO_EMPRESA"
```

### Task 6: `lic_repo.py` — CRUD del catálogo de tipos de documento

**Files:**
- Modify: `backend/apps/legacy/repositories/lic_repo.py`
- Test: `backend/apps/lic/tests/test_lic_repo_tipo_documento.py` (crear)

- [ ] **Step 1: Escribir los tests**

```python
# backend/apps/lic/tests/test_lic_repo_tipo_documento.py
import pytest
from apps.legacy.repositories import lic_repo


@pytest.mark.django_db
def test_crear_y_listar_tipo_documento():
    tipo_id = lic_repo.crear_tipo_documento("TEST1", "Documento de prueba")
    tipos = lic_repo.list_tipos_documento()
    assert any(t["id"] == tipo_id and t["codigo"] == "TEST1" and t["activo"] == "S" for t in tipos)


@pytest.mark.django_db
def test_list_tipos_documento_excluye_inactivos_por_defecto():
    tipo_id = lic_repo.crear_tipo_documento("TEST2", "Otro de prueba")
    lic_repo.actualizar_tipo_documento(tipo_id, activo="N")
    activos = lic_repo.list_tipos_documento()
    todos = lic_repo.list_tipos_documento(solo_activos=False)
    assert not any(t["id"] == tipo_id for t in activos)
    assert any(t["id"] == tipo_id and t["activo"] == "N" for t in todos)
```

- [ ] **Step 2: Correr y confirmar que fallan**

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_lic_repo_tipo_documento -v 2`
Expected: FAIL — `AttributeError: module 'apps.legacy.repositories.lic_repo' has no attribute 'crear_tipo_documento'`

- [ ] **Step 3: Implementar en `lic_repo.py`**

Agregar al final del archivo:

```python
# --- Catalogo de tipos de documento (Configuracion > Licitacion) ---

def crear_tipo_documento(codigo: str, nombre: str) -> int:
    with client.cursor() as cur:
        out_id = cur.var(oracledb.NUMBER)
        cur.execute(
            "INSERT INTO FAT.TLIC_TIPO_DOCUMENTO (codigo, nombre) VALUES (:1, :2) "
            "RETURNING id INTO :3",
            [codigo, nombre, out_id],
        )
        cur.connection.commit()
        return int(out_id.getvalue()[0])


def list_tipos_documento(solo_activos: bool = True) -> list[dict]:
    sql = "SELECT id, codigo, nombre, activo FROM FAT.TLIC_TIPO_DOCUMENTO"
    if solo_activos:
        sql += " WHERE activo = 'S'"
    sql += " ORDER BY nombre"
    return client.fetch_dicts(sql, [])


def actualizar_tipo_documento(tipo_id: int, nombre: str | None = None, activo: str | None = None) -> None:
    sets = []
    params: dict = {"id": tipo_id}
    if nombre is not None:
        sets.append("nombre = :nombre")
        params["nombre"] = nombre
    if activo is not None:
        sets.append("activo = :activo")
        params["activo"] = activo
    if not sets:
        return
    with client.cursor() as cur:
        cur.execute(f"UPDATE FAT.TLIC_TIPO_DOCUMENTO SET {', '.join(sets)} WHERE id = :id", params)
        cur.connection.commit()
```

- [ ] **Step 4: Correr y confirmar que pasan**

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_lic_repo_tipo_documento -v 2`
Expected: `OK` (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/apps/legacy/repositories/lic_repo.py backend/apps/lic/tests/test_lic_repo_tipo_documento.py
git commit -m "feat(lic): CRUD del catalogo TLIC_TIPO_DOCUMENTO en lic_repo"
```

### Task 7: `lic_repo.py` — documentos de empresa con tipo tipado + descarga

**Files:**
- Modify: `backend/apps/legacy/repositories/lic_repo.py:297-337`
- Test: `backend/apps/lic/tests/test_lic_repo_tipo_documento.py`

- [ ] **Step 1: Escribir el test**

Agregar a `test_lic_repo_tipo_documento.py`:

```python
@pytest.mark.django_db
def test_guardar_documento_empresa_con_tipo_documento_id():
    tipo_id = lic_repo.crear_tipo_documento("TEST3", "Tipo para matching")
    doc_id = lic_repo.guardar_documento_empresa(
        "01", "01", "archivo.pdf", "/x/archivo.pdf", None, None, tipo_documento_id=tipo_id
    )
    docs = lic_repo.list_documentos_empresa("01")
    doc = next(d for d in docs if d["id"] == doc_id)
    assert doc["tipo_documento_id"] == tipo_id
    assert doc["tipo_documento_nombre"] == "Tipo para matching"
```

- [ ] **Step 2: Correr y confirmar que falla**

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_lic_repo_tipo_documento.test_guardar_documento_empresa_con_tipo_documento_id -v 2`
Expected: FAIL — `TypeError: guardar_documento_empresa() got an unexpected keyword argument 'tipo_documento_id'`

- [ ] **Step 3: Modificar `guardar_documento_empresa` y `list_documentos_empresa`**

Reemplazar líneas 297-329 de `lic_repo.py`:

```python
def guardar_documento_empresa(
    no_cia: str, punto: str | None, nombre_archivo: str, ruta_archivo: str,
    descripcion: str | None, fecha_vencimiento: str | None,
    tipo_documento_id: int | None = None,
) -> int:
    with client.cursor() as cur:
        out_id = cur.var(oracledb.NUMBER)
        cur.execute(
            "INSERT INTO FAT.TLIC_DOCUMENTO_EMPRESA "
            "(no_cia, punto, nombre_archivo, ruta_archivo, descripcion, fecha_vencimiento, "
            "tipo_documento_id) "
            "VALUES (:no_cia, :punto, :nombre, :ruta, :descripcion, "
            "TO_DATE(:fecha_vencimiento, 'YYYY-MM-DD'), :tipo_documento_id) RETURNING id INTO :out_id",
            {
                "no_cia": no_cia, "punto": punto, "nombre": nombre_archivo,
                "ruta": ruta_archivo, "descripcion": descripcion,
                "fecha_vencimiento": fecha_vencimiento, "tipo_documento_id": tipo_documento_id,
                "out_id": out_id,
            },
        )
        cur.connection.commit()
        return int(out_id.getvalue()[0])


def list_documentos_empresa(no_cia: str) -> list[dict]:
    # vencido se calcula en SQL (no en Python) para que quede consistente
    # sin importar la zona horaria del proceso que lo consuma.
    return client.fetch_dicts(
        "SELECT d.id, d.no_cia, d.punto, d.nombre_archivo, d.ruta_archivo, d.descripcion, "
        "d.fecha_vencimiento, d.tipo_documento_id, t.nombre AS tipo_documento_nombre, "
        "CASE WHEN d.fecha_vencimiento IS NOT NULL AND d.fecha_vencimiento < TRUNC(SYSDATE) "
        "     THEN 1 ELSE 0 END AS vencido, "
        "d.subido_en "
        "FROM FAT.TLIC_DOCUMENTO_EMPRESA d "
        "LEFT JOIN FAT.TLIC_TIPO_DOCUMENTO t ON t.id = d.tipo_documento_id "
        "WHERE d.no_cia = :1 ORDER BY d.nombre_archivo",
        [no_cia],
    )
```

- [ ] **Step 4: Actualizar `documentos_empresa_view` en `views.py` para aceptar `tipo_documento_id`**

Modificar `backend/apps/lic/views.py:280-301` (dentro de `documentos_empresa_view`):

```python
    no_cia = request.POST.get("no_cia")
    archivo = request.FILES.get("archivo")
    if not no_cia or not archivo:
        return _err("no_cia y archivo son requeridos")
    punto = request.POST.get("punto") or None
    descripcion = request.POST.get("descripcion") or None
    fecha_vencimiento = request.POST.get("fecha_vencimiento") or None
    tipo_documento_id_raw = request.POST.get("tipo_documento_id")
    tipo_documento_id = int(tipo_documento_id_raw) if tipo_documento_id_raw else None

    destino = Path(settings.MEDIA_ROOT) / "lic" / no_cia / "documentos-empresa"
    destino.mkdir(parents=True, exist_ok=True)
    ruta_archivo = destino / archivo.name
    if ruta_archivo.exists():
        disambiguador = timezone.now().strftime("%Y%m%d%H%M%S%f")
        ruta_archivo = ruta_archivo.with_stem(f"{ruta_archivo.stem}__{disambiguador}")
    with open(ruta_archivo, "wb") as f:
        for chunk in archivo.chunks():
            f.write(chunk)

    lic_repo.guardar_documento_empresa(
        no_cia, punto, archivo.name, str(ruta_archivo), descripcion, fecha_vencimiento,
        tipo_documento_id=tipo_documento_id,
    )
    return JsonResponse({"documentos": lic_repo.list_documentos_empresa(no_cia)}, status=201)
```

- [ ] **Step 5: Correr todos los tests de `lic_repo` y confirmar que pasan**

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_lic_repo_tipo_documento -v 2`
Expected: `OK` (3 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/apps/legacy/repositories/lic_repo.py backend/apps/lic/views.py backend/apps/lic/tests/test_lic_repo_tipo_documento.py
git commit -m "feat(lic): documentos de empresa con tipo_documento_id tipado"
```

### Task 8: Endpoints — CRUD de tipos de documento + descarga de documento de empresa

**Files:**
- Modify: `backend/apps/lic/views.py`
- Modify: `backend/apps/lic/urls.py`
- Test: `backend/apps/lic/tests/test_views_tipo_documento.py` (crear)

- [ ] **Step 1: Escribir los tests de smoke HTTP**

```python
# backend/apps/lic/tests/test_views_tipo_documento.py
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.legacy.repositories import lic_repo


@pytest.fixture
def cliente_autenticado(db):
    User = get_user_model()
    user = User.objects.create_user(username="tester", password="x")
    client = Client()
    client.force_login(user)
    return client


@pytest.mark.django_db
def test_get_tipos_documento_devuelve_catalogo(cliente_autenticado):
    lic_repo.crear_tipo_documento("SMOKE1", "Tipo de prueba smoke")
    resp = cliente_autenticado.get("/api/lic/tipos-documento/")
    assert resp.status_code == 200
    assert any(t["codigo"] == "SMOKE1" for t in resp.json()["tipos"])


@pytest.mark.django_db
def test_post_tipos_documento_crea_uno_nuevo(cliente_autenticado):
    resp = cliente_autenticado.post(
        "/api/lic/tipos-documento/",
        data={"codigo": "SMOKE2", "nombre": "Otro tipo smoke"},
        content_type="application/json",
    )
    assert resp.status_code == 201
    assert resp.json()["tipo"]["codigo"] == "SMOKE2"


@pytest.mark.django_db
def test_patch_tipo_documento_desactiva(cliente_autenticado):
    tipo_id = lic_repo.crear_tipo_documento("SMOKE3", "Tipo a desactivar")
    resp = cliente_autenticado.patch(
        f"/api/lic/tipos-documento/{tipo_id}/",
        data={"activo": "N"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    activos = lic_repo.list_tipos_documento()
    assert not any(t["id"] == tipo_id for t in activos)


@pytest.mark.django_db
def test_descargar_documento_empresa_devuelve_404_si_no_existe(cliente_autenticado):
    resp = cliente_autenticado.get("/api/lic/documentos-empresa/999999/descargar/")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_descargar_documento_empresa_sirve_el_archivo(cliente_autenticado, tmp_path):
    archivo = tmp_path / "prueba.pdf"
    archivo.write_bytes(b"%PDF-1.4 contenido de prueba")
    doc_id = lic_repo.guardar_documento_empresa(
        "01", None, "prueba.pdf", str(archivo), None, None
    )
    resp = cliente_autenticado.get(f"/api/lic/documentos-empresa/{doc_id}/descargar/")
    assert resp.status_code == 200
    assert b"".join(resp.streaming_content) == b"%PDF-1.4 contenido de prueba"
```

- [ ] **Step 2: Correr y confirmar que fallan**

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_views_tipo_documento -v 2`
Expected: FAIL — 404/`Resolver404` para las rutas nuevas (no existen todavía)

- [ ] **Step 3: Implementar las vistas en `views.py`**

Agregar el import al inicio del archivo (junto a los demás imports de `django.http`):

```python
from django.http import FileResponse, Http404, JsonResponse
```

(reemplaza la línea `from django.http import JsonResponse` existente)

Agregar al final del archivo:

```python
@login_required
@csrf_exempt
@require_http_methods(["GET", "POST"])
def tipos_documento_view(request):
    if request.method == "GET":
        return JsonResponse({"tipos": lic_repo.list_tipos_documento(solo_activos=False)})

    data, err = _parse_json_body(request)
    if err:
        return err
    codigo = data.get("codigo")
    nombre = data.get("nombre")
    if not codigo or not nombre:
        return _err("codigo y nombre son requeridos")
    tipo_id = lic_repo.crear_tipo_documento(codigo, nombre)
    return JsonResponse(
        {"tipo": {"id": tipo_id, "codigo": codigo, "nombre": nombre, "activo": "S"}},
        status=201,
    )


@login_required
@csrf_exempt
@require_http_methods(["PATCH"])
def tipo_documento_detail_view(request, tipo_id: int):
    data, err = _parse_json_body(request)
    if err:
        return err
    lic_repo.actualizar_tipo_documento(
        tipo_id, nombre=data.get("nombre"), activo=data.get("activo")
    )
    return JsonResponse({"tipos": lic_repo.list_tipos_documento(solo_activos=False)})


@login_required
@require_http_methods(["GET"])
def documento_empresa_descargar_view(request, documento_empresa_id: int):
    documento = lic_repo.get_documento_empresa(documento_empresa_id)
    if not documento or not Path(documento["ruta_archivo"]).exists():
        raise Http404("Documento no encontrado")
    return FileResponse(
        open(documento["ruta_archivo"], "rb"),
        as_attachment=True,
        filename=documento["nombre_archivo"],
    )
```

- [ ] **Step 4: Registrar las rutas en `urls.py`**

Reemplazar el contenido de `backend/apps/lic/urls.py`:

```python
from django.urls import path

from apps.lic import views

urlpatterns = [
    path("credenciales/", views.credenciales_view),
    path("credenciales/probar-conexion/", views.probar_conexion_view),
    path("rubros-pdf/", views.rubros_pdf_view),
    path("oportunidades/", views.oportunidades_view),
    path("oportunidades/<int:oportunidad_id>/documentos/", views.documentos_view),
    path("documentos/<int:documento_id>/resumen/", views.resumen_documento_view),
    path("documentos-empresa/", views.documentos_empresa_view),
    path("documentos-empresa/<int:documento_empresa_id>/descargar/", views.documento_empresa_descargar_view),
    path("tipos-documento/", views.tipos_documento_view),
    path("tipos-documento/<int:tipo_id>/", views.tipo_documento_detail_view),
    path("oportunidades/<int:oportunidad_id>/analizar/", views.analizar_oportunidad_view),
    path("oportunidades/<int:oportunidad_id>/requisitos/", views.requisitos_view),
    path("scrape/", views.scrape_view),
    path("scrape/<int:job_id>/", views.scrape_job_view),
]
```

- [ ] **Step 5: Correr los tests y confirmar que pasan**

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_views_tipo_documento -v 2`
Expected: `OK` (5 tests)

- [ ] **Step 6: Correr toda la suite de `apps.lic` para confirmar que nada se rompió**

Run: `docker compose exec -T backend python manage.py test apps.lic -v 2`
Expected: `OK`

- [ ] **Step 7: Commit**

```bash
git add backend/apps/lic/views.py backend/apps/lic/urls.py backend/apps/lic/tests/test_views_tipo_documento.py
git commit -m "feat(lic): endpoints de tipos de documento y descarga de documentos de empresa"
```

### Task 9: Frontend `api.ts` — tipos, hooks del catálogo y descarga

**Files:**
- Modify: `frontend/src/features/lic/api.ts`

- [ ] **Step 1: Extender el tipo `DocumentoEmpresa` y agregar `TipoDocumento`**

Reemplazar la interfaz `DocumentoEmpresa` (líneas 84-94):

```typescript
export interface TipoDocumento {
  id: number
  codigo: string
  nombre: string
  activo: 'S' | 'N'
}

export interface DocumentoEmpresa {
  id: number
  no_cia: string
  punto: string | null
  nombre_archivo: string
  ruta_archivo: string
  descripcion: string | null
  fecha_vencimiento: string | null
  tipo_documento_id: number | null
  tipo_documento_nombre: string | null
  vencido: 0 | 1
  subido_en: string
}
```

- [ ] **Step 2: Agregar los hooks del catálogo y actualizar `useSubirDocumentoEmpresa`**

Agregar después de `useDocumentosEmpresa` (después de la línea 299), y reemplazar
`useSubirDocumentoEmpresa` (líneas 301-326):

```typescript
export function useTiposDocumento() {
  return useQuery({
    queryKey: ['lic-tipos-documento'],
    queryFn: () => licRequest<{ tipos: TipoDocumento[] }>('/lic/tipos-documento/'),
  })
}

export function useCrearTipoDocumento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { codigo: string; nombre: string }) =>
      licRequest<{ tipo: TipoDocumento }>('/lic/tipos-documento/', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lic-tipos-documento'] }),
  })
}

export function useActualizarTipoDocumento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { id: number; nombre?: string; activo?: 'S' | 'N' }) =>
      licRequest<{ tipos: TipoDocumento[] }>(`/lic/tipos-documento/${payload.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lic-tipos-documento'] }),
  })
}

export function useSubirDocumentoEmpresa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      no_cia: string
      punto?: string
      archivo: File
      descripcion?: string
      fecha_vencimiento?: string
      tipo_documento_id?: number
    }) => {
      const form = new FormData()
      form.append('no_cia', payload.no_cia)
      if (payload.punto) form.append('punto', payload.punto)
      form.append('archivo', payload.archivo)
      if (payload.descripcion) form.append('descripcion', payload.descripcion)
      if (payload.fecha_vencimiento)
        form.append('fecha_vencimiento', payload.fecha_vencimiento)
      if (payload.tipo_documento_id)
        form.append('tipo_documento_id', String(payload.tipo_documento_id))
      return licRequest<{ documentos: DocumentoEmpresa[] }>(
        '/lic/documentos-empresa/',
        { method: 'POST', body: form }
      )
    },
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: ['lic-documentos-empresa', variables.no_cia] }),
  })
}

export function documentoEmpresaDescargarUrl(documentoEmpresaId: number): string {
  return `${API_BASE}/lic/documentos-empresa/${documentoEmpresaId}/descargar/`
}
```

- [ ] **Step 3: Verificación de tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores nuevos relacionados a `lic/api.ts` (puede haber errores preexistentes en
otros archivos que no tocamos — solo confirmar que no aparecen nuevos en este archivo).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/lic/api.ts
git commit -m "feat(lic): hooks de catalogo de tipos de documento y descarga en el frontend"
```

### Task 10: Frontend — vista "Tipos de documento" (CRUD)

**Files:**
- Create: `frontend/src/features/lic/lic-tipos-documento.tsx`
- Create: `frontend/src/routes/_authenticated/lic/config/tipos-documento.tsx`
- Modify: `frontend/src/components/layout/data/sidebar-data.ts:326-330`

- [ ] **Step 1: Crear el componente CRUD**

```typescript
// frontend/src/features/lic/lic-tipos-documento.tsx
// CRUD del catalogo de tipos de documento de empresa (Configuracion > Licitacion) --
// permite agregar tipos nuevos a futuro sin tocar codigo (ej. "Certificado de No Deuda").
import { useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type TipoDocumento,
  useActualizarTipoDocumento,
  useCrearTipoDocumento,
  useTiposDocumento,
} from './api'

export function LicTiposDocumento() {
  const { data, isLoading } = useTiposDocumento()
  const crear = useCrearTipoDocumento()
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')

  const handleCrear = () => {
    if (!codigo.trim() || !nombre.trim()) {
      toast.error('Código y nombre son requeridos')
      return
    }
    crear.mutate(
      { codigo: codigo.trim().toUpperCase(), nombre: nombre.trim() },
      {
        onSuccess: () => {
          toast.success(`Tipo de documento "${nombre.trim()}" creado`)
          setCodigo('')
          setNombre('')
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  const tipos = data?.tipos ?? []

  return (
    <div className='space-y-4'>
      <div>
        <h3 className='text-base font-semibold'>Tipos de documento</h3>
        <p className='text-sm text-muted-foreground'>
          Catálogo de tipos de documento que se pueden subir para una empresa (RNC,
          constancias, actas, etc.). Agregue uno nuevo aquí antes de que aparezca como
          opción al subir un documento.
        </p>
      </div>

      <div className='flex flex-wrap items-end gap-3'>
        <div>
          <Label className='text-xs'>Código</Label>
          <Input
            placeholder='EJ. NODEUDA'
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className='h-9 w-40'
            maxLength={30}
          />
        </div>
        <div className='grow max-w-sm'>
          <Label className='text-xs'>Nombre</Label>
          <Input
            placeholder='Ej. Certificado de No Deuda'
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className='h-9'
            maxLength={200}
          />
        </div>
        <Button size='sm' className='gap-1.5' disabled={crear.isPending} onClick={handleCrear}>
          <Plus className='h-4 w-4' />
          {crear.isPending ? 'Creando…' : 'Nuevo tipo'}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className='h-40 w-full' />
      ) : (
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className='w-28'>Estado</TableHead>
                <TableHead className='w-32 text-right'>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tipos.map((t) => (
                <TipoDocumentoRow key={t.id} tipo={t} />
              ))}
              {tipos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className='text-center text-muted-foreground py-6'>
                    No hay tipos de documento todavía.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function TipoDocumentoRow({ tipo }: { tipo: TipoDocumento }) {
  const actualizar = useActualizarTipoDocumento()

  return (
    <TableRow>
      <TableCell className='font-mono text-xs'>{tipo.codigo}</TableCell>
      <TableCell className='text-sm'>{tipo.nombre}</TableCell>
      <TableCell>
        <Badge variant={tipo.activo === 'S' ? 'default' : 'outline'}>
          {tipo.activo === 'S' ? 'Activo' : 'Inactivo'}
        </Badge>
      </TableCell>
      <TableCell className='text-right'>
        <Button
          size='sm'
          variant='ghost'
          disabled={actualizar.isPending}
          onClick={() =>
            actualizar.mutate(
              { id: tipo.id, activo: tipo.activo === 'S' ? 'N' : 'S' },
              { onError: (e) => toast.error(e.message) }
            )
          }
        >
          {tipo.activo === 'S' ? 'Desactivar' : 'Activar'}
        </Button>
      </TableCell>
    </TableRow>
  )
}
```

- [ ] **Step 2: Crear la ruta**

```typescript
// frontend/src/routes/_authenticated/lic/config/tipos-documento.tsx
import { createFileRoute } from '@tanstack/react-router'
import { LicTiposDocumento } from '@/features/lic/lic-tipos-documento'

export const Route = createFileRoute('/_authenticated/lic/config/tipos-documento')({
  component: LicTiposDocumento,
})
```

- [ ] **Step 3: Agregar la entrada de sidebar**

Modificar `frontend/src/components/layout/data/sidebar-data.ts:326-330`:

```typescript
            {
              title: 'Configuración',
              items: [
                { title: 'Empresas y Rubros RPE', url: '/lic/config' },
                { title: 'Tipos de documento', url: '/lic/config/tipos-documento' },
              ],
            },
```

- [ ] **Step 4: Verificación**

Run: `cd frontend && npx tsc --noEmit && npm run dev` (levantar y navegar manualmente a
`/lic/config/tipos-documento`, crear un tipo, desactivarlo, confirmar que el badge cambia).
Expected: sin errores de tipos; la vista carga y el flujo de crear/desactivar funciona.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/lic/lic-tipos-documento.tsx frontend/src/routes/_authenticated/lic/config/tipos-documento.tsx frontend/src/components/layout/data/sidebar-data.ts
git commit -m "feat(lic): vista CRUD de tipos de documento en Configuracion"
```

### Task 11: Frontend — vista dedicada "Documentos de la empresa" (drag & drop)

**Files:**
- Create: `frontend/src/features/lic/lic-documentos-empresa.tsx`
- Create: `frontend/src/routes/_authenticated/lic/config/documentos.tsx`
- Modify: `frontend/src/features/lic/lic-config.tsx` (quitar `DocumentosEmpresaSection` embebida)
- Modify: `frontend/src/components/layout/data/sidebar-data.ts` (ya editado en Task 10, agregar
  una línea más)

- [ ] **Step 1: Crear el componente de la vista dedicada**

```typescript
// frontend/src/features/lic/lic-documentos-empresa.tsx
// Vista dedicada de documentos de empresa (Configuracion > Licitacion) -- reemplaza la
// seccion embebida por empresa en lic-config.tsx: selector de empresa arriba, boton
// "Nuevo documento" con zona de arrastrar-y-soltar + tipo de documento del catalogo, y
// tabla con badge Vigente/Vencido + descarga.
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Download, Plus, Upload } from 'lucide-react'
import { useCompany } from '@/hooks/use-company'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type DocumentoEmpresa,
  documentoEmpresaDescargarUrl,
  useDocumentosEmpresa,
  useSubirDocumentoEmpresa,
  useTiposDocumento,
} from './api'

function fmtDate(s: string | null): string {
  return s ? String(s).slice(0, 10) : ''
}

export function LicDocumentosEmpresa() {
  const { selectedCompany } = useCompany()
  const [dialogAbierto, setDialogAbierto] = useState(false)
  const { data, isLoading } = useDocumentosEmpresa(selectedCompany)

  const documentos = data?.documentos ?? []

  return (
    <div className='space-y-4'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h3 className='text-base font-semibold'>Documentos de la empresa {selectedCompany}</h3>
          <p className='text-sm text-muted-foreground'>
            RNC, constancias, actas y demás documentos usados para evaluar automáticamente si
            la empresa cumple los requisitos de cada licitación.
          </p>
        </div>
        <Button size='sm' className='gap-1.5 shrink-0' onClick={() => setDialogAbierto(true)}>
          <Plus className='h-4 w-4' />
          Nuevo documento
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className='h-40 w-full' />
      ) : documentos.length === 0 ? (
        <p className='text-sm text-muted-foreground py-4'>
          Aún no se han subido documentos para esta empresa.
        </p>
      ) : (
        <div className='rounded-md border overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Archivo</TableHead>
                <TableHead className='w-20'>Punto</TableHead>
                <TableHead className='w-40'>Vencimiento</TableHead>
                <TableHead className='w-16 text-right'>Descargar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documentos.map((d) => (
                <DocumentoRow key={d.id} documento={d} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <NuevoDocumentoDialog
        noCia={selectedCompany}
        open={dialogAbierto}
        onOpenChange={setDialogAbierto}
      />
    </div>
  )
}

function DocumentoRow({ documento: d }: { documento: DocumentoEmpresa }) {
  return (
    <TableRow>
      <TableCell className='text-sm'>{d.tipo_documento_nombre ?? d.descripcion ?? 'Sin tipo'}</TableCell>
      <TableCell className='text-sm truncate max-w-xs'>{d.nombre_archivo}</TableCell>
      <TableCell className='text-sm'>{d.punto ?? '—'}</TableCell>
      <TableCell>
        {d.fecha_vencimiento ? (
          <Badge variant={d.vencido ? 'destructive' : 'outline'}>
            {d.vencido ? 'Vencido' : 'Vigente'} · {fmtDate(d.fecha_vencimiento)}
          </Badge>
        ) : (
          <span className='text-xs text-muted-foreground'>Sin vencimiento</span>
        )}
      </TableCell>
      <TableCell className='text-right'>
        <Button size='sm' variant='ghost' asChild title='Descargar'>
          <a href={documentoEmpresaDescargarUrl(d.id)} target='_blank' rel='noreferrer'>
            <Download className='h-4 w-4' />
          </a>
        </Button>
      </TableCell>
    </TableRow>
  )
}

function NuevoDocumentoDialog({
  noCia,
  open,
  onOpenChange,
}: {
  noCia: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { data: tiposData } = useTiposDocumento()
  const subir = useSubirDocumentoEmpresa()
  const fileRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [tipoDocumentoId, setTipoDocumentoId] = useState<string>('')
  const [punto, setPunto] = useState('')
  const [fechaVencimiento, setFechaVencimiento] = useState('')

  const tipos = (tiposData?.tipos ?? []).filter((t) => t.activo === 'S')

  const reset = () => {
    setArchivo(null)
    setTipoDocumentoId('')
    setPunto('')
    setFechaVencimiento('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSubir = () => {
    if (!archivo) {
      toast.error('Seleccione un archivo')
      return
    }
    subir.mutate(
      {
        no_cia: noCia,
        archivo,
        punto: punto || undefined,
        fecha_vencimiento: fechaVencimiento || undefined,
        tipo_documento_id: tipoDocumentoId ? Number(tipoDocumentoId) : undefined,
      },
      {
        onSuccess: () => {
          toast.success('Documento guardado')
          reset()
          onOpenChange(false)
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>Nuevo documento</DialogTitle>
          <DialogDescription>
            Para la empresa {noCia}. Arrastre el archivo o selecciónelo manualmente.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3'>
          <div
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault()
              setArrastrando(false)
              const f = e.dataTransfer.files?.[0]
              if (f) setArchivo(f)
            }}
            onClick={() => fileRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
              arrastrando ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
          >
            <Upload className='h-6 w-6 text-muted-foreground' />
            <p className='text-sm text-muted-foreground'>
              {archivo ? archivo.name : 'Arrastre un archivo aquí o haga clic para seleccionar'}
            </p>
            <input
              ref={fileRef}
              type='file'
              className='hidden'
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
          </div>

          <div>
            <Label className='text-xs'>Tipo de documento</Label>
            <Select value={tipoDocumentoId} onValueChange={setTipoDocumentoId}>
              <SelectTrigger className='h-9'>
                <SelectValue placeholder='Seleccione un tipo' />
              </SelectTrigger>
              <SelectContent>
                {tipos.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='flex gap-3'>
            <div>
              <Label className='text-xs'>Punto (opcional)</Label>
              <Input
                value={punto}
                onChange={(e) => setPunto(e.target.value)}
                className='h-9 w-24'
                maxLength={2}
              />
            </div>
            <div className='grow'>
              <Label className='text-xs'>Fecha de vencimiento</Label>
              <Input
                type='date'
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                className='h-9'
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant='ghost' onClick={() => onOpenChange(false)} disabled={subir.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubir} disabled={subir.isPending}>
            {subir.isPending ? 'Subiendo…' : 'Subir documento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Crear la ruta**

```typescript
// frontend/src/routes/_authenticated/lic/config/documentos.tsx
import { createFileRoute } from '@tanstack/react-router'
import { LicDocumentosEmpresa } from '@/features/lic/lic-documentos-empresa'

export const Route = createFileRoute('/_authenticated/lic/config/documentos')({
  component: LicDocumentosEmpresa,
})
```

- [ ] **Step 3: Quitar `DocumentosEmpresaSection` de `lic-config.tsx`**

En `frontend/src/features/lic/lic-config.tsx`:
- Borrar la línea `<DocumentosEmpresaSection noCia={no_cia} />` (línea 280, dentro de `EmpresaCard`).
- Borrar toda la función `DocumentosEmpresaSection` (líneas 286-395).
- Borrar toda la función `DocumentoEmpresaRow` (líneas 397-421, ya no se usa desde acá — el
  reemplazo vive en `lic-documentos-empresa.tsx`).
- Quitar los imports que queden sin uso tras el borrado (`useDocumentosEmpresa`,
  `useSubirDocumentoEmpresa`, `DocumentoEmpresa`, `Upload` si ya no se usa en el resto del
  archivo — verificar con el paso de tsc en el Step 5).
- Agregar debajo de la descripción del header de `LicConfig` (después de la línea 92) un enlace:

```typescript
        <p className='text-sm text-muted-foreground'>
          Credenciales de acceso al portal de Compras y Contrataciones (DGCP) por
          empresa, usadas por la búsqueda automática de licitaciones, y el PDF de
          rubros RPE que clasifica las oportunidades encontradas. Los documentos propios
          de la empresa (RNC, constancias, etc.) se administran en{' '}
          <Link to='/lic/config/documentos' className='underline'>
            Documentos de la empresa
          </Link>
          .
        </p>
```

(agregar `import { Link } from '@tanstack/react-router'` al inicio del archivo)

- [ ] **Step 4: Agregar la entrada de sidebar (junto a la de Task 10)**

`frontend/src/components/layout/data/sidebar-data.ts:326-331` queda:

```typescript
            {
              title: 'Configuración',
              items: [
                { title: 'Empresas y Rubros RPE', url: '/lic/config' },
                { title: 'Documentos de la empresa', url: '/lic/config/documentos' },
                { title: 'Tipos de documento', url: '/lic/config/tipos-documento' },
              ],
            },
```

- [ ] **Step 5: Verificación**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores. Revisar manualmente que no queden imports huérfanos en `lic-config.tsx`
(el propio `tsc --noEmit` con `noUnusedLocals` activo, si está configurado así en
`tsconfig.app.json`, ya lo marcaría como error).

Levantar `npm run dev`, navegar a `/lic/config/documentos`, subir un documento de prueba
arrastrándolo, confirmar que aparece en la tabla con badge Vigente/Vencido correcto y que el
botón de descarga baja el archivo.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/lic/lic-documentos-empresa.tsx frontend/src/routes/_authenticated/lic/config/documentos.tsx frontend/src/features/lic/lic-config.tsx frontend/src/components/layout/data/sidebar-data.ts
git commit -m "feat(lic): vista dedicada de documentos de empresa con arrastrar-y-soltar"
```

---

## Parte C — Documentos faltantes (código) + productos del scraper + IA solo para precio

> **Corrección 2026-07-24 (segunda vuelta):** el usuario aclaró que los productos/servicios de
> una licitación YA están en el portal como dato estructurado (igual que descripción/unidad/
> presupuesto, que ya se scrapean sin IA) — el scraper debe extraerlos por código, no la IA. Las
> comparaciones contra documentos de empresa siguen siendo código puro (`documentos_faltantes()`,
> sin cambios de fondo). El único uso de IA que agrega esta parte es una recomendación de precio
> en la página de detalle, y solo después de que una búsqueda de código (Task 16) ya encontró el
> historial — la IA nunca busca ni compara por su cuenta, solo redacta la recomendación con los
> datos que se le entregan.

### Task 12: Migración SQL — productos y documentos faltantes

**Files:**
- Create: `backend/apps/lic/sql/004_productos_documentos_faltantes.sql`

- [ ] **Step 1: Escribir el DDL**

```sql
-- Fase: productos/servicios extraidos de la licitacion + resumen de documentos faltantes.
-- Ejecutar manualmente, mismo patron que los archivos SQL anteriores de apps/lic.

CREATE TABLE FAT.TLIC_PRODUCTO (
    ID             NUMBER PRIMARY KEY,
    OPORTUNIDAD_ID NUMBER NOT NULL,
    DESCRIPCION    VARCHAR2(500) NOT NULL,
    CANTIDAD       VARCHAR2(50),
    ACTUALIZADO_EN TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT FK_TLIC_PRODUCTO_OPP FOREIGN KEY (OPORTUNIDAD_ID)
        REFERENCES FAT.TLIC_OPORTUNIDAD(ID) ON DELETE CASCADE
);
/

CREATE INDEX FAT.IX_TLIC_PRODUCTO_OPP ON FAT.TLIC_PRODUCTO (OPORTUNIDAD_ID);
/

CREATE SEQUENCE FAT.SEQ_TLIC_PRODUCTO;
/

CREATE OR REPLACE TRIGGER FAT.TRG_TLIC_PRODUCTO_ID
BEFORE INSERT ON FAT.TLIC_PRODUCTO
FOR EACH ROW
WHEN (NEW.ID IS NULL)
BEGIN
    :NEW.ID := FAT.SEQ_TLIC_PRODUCTO.NEXTVAL;
END;
/

-- JSON serializado de [{"tipo_documento": "...", "motivo": "no subido"|"vencido"}] --
-- derivado (se recalcula en cada analisis), no se justifica tabla hija para esto.
ALTER TABLE FAT.TLIC_OPORTUNIDAD ADD DOCUMENTOS_FALTANTES VARCHAR2(2000);
/
```

- [ ] **Step 2: Ejecutar contra Oracle en la VM**

```bash
docker compose exec -T backend python manage.py dbshell < backend/apps/lic/sql/004_productos_documentos_faltantes.sql
```

Expected: sin errores ORA-*.

- [ ] **Step 3: Commit**

```bash
git add backend/apps/lic/sql/004_productos_documentos_faltantes.sql
git commit -m "feat(lic): tabla TLIC_PRODUCTO y columna DOCUMENTOS_FALTANTES"
```

### Task 13: `lic_repo.py` — productos y documentos faltantes

**Files:**
- Modify: `backend/apps/legacy/repositories/lic_repo.py`
- Test: `backend/apps/lic/tests/test_lic_repo_productos.py` (crear)

- [ ] **Step 1: Escribir los tests**

```python
# backend/apps/lic/tests/test_lic_repo_productos.py
import json

import pytest
from apps.legacy.repositories import lic_repo


@pytest.mark.django_db
def _crear_oportunidad(no_cia="01", referencia="REF-PROD-1"):
    oportunidad_id, _ = lic_repo.upsert_oportunidad(no_cia, {"referencia": referencia, "titulo": "algo"})
    return oportunidad_id


@pytest.mark.django_db
def test_reemplazar_productos_borra_e_inserta():
    oportunidad_id = _crear_oportunidad()
    lic_repo.reemplazar_productos(oportunidad_id, [{"descripcion": "100 laptops", "cantidad": "100"}])
    assert [p["descripcion"] for p in lic_repo.list_productos(oportunidad_id)] == ["100 laptops"]

    lic_repo.reemplazar_productos(oportunidad_id, [{"descripcion": "50 impresoras", "cantidad": "50"}])
    assert [p["descripcion"] for p in lic_repo.list_productos(oportunidad_id)] == ["50 impresoras"]


@pytest.mark.django_db
def test_guardar_analisis_oportunidad_con_documentos_faltantes():
    oportunidad_id = _crear_oportunidad(referencia="REF-PROD-2")
    faltantes = [{"tipo_documento": "Registro Mercantil", "motivo": "no subido"}]
    lic_repo.guardar_analisis_oportunidad(
        oportunidad_id, "resumen", "amarillo", "recomendacion",
        documentos_faltantes=faltantes,
    )
    oportunidad = lic_repo.get_oportunidad_completa(oportunidad_id)
    assert json.loads(oportunidad["documentos_faltantes"]) == faltantes
```

- [ ] **Step 2: Correr y confirmar que fallan**

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_lic_repo_productos -v 2`
Expected: FAIL — `AttributeError: ... has no attribute 'reemplazar_productos'`

- [ ] **Step 3: Implementar en `lic_repo.py`**

Modificar `guardar_analisis_oportunidad` (líneas 342-352):

```python
def guardar_analisis_oportunidad(
    oportunidad_id: int, resumen_ia: str, estado_cumplimiento: str,
    recomendacion_ia: str | None, documentos_faltantes: list[dict] | None = None,
) -> None:
    with client.cursor() as cur:
        cur.execute(
            "UPDATE FAT.TLIC_OPORTUNIDAD SET resumen_ia = :1, estado_cumplimiento = :2, "
            "recomendacion_ia = :3, documentos_faltantes = :4 WHERE id = :5",
            [
                resumen_ia, estado_cumplimiento, recomendacion_ia,
                json.dumps(documentos_faltantes or [], ensure_ascii=False)[:2000],
                oportunidad_id,
            ],
        )
        cur.connection.commit()
```

Agregar `import json` al inicio del archivo (después de `import oracledb`).

Agregar al final del archivo:

```python
def get_oportunidad_completa(oportunidad_id: int) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT id, no_cia, referencia, titulo, resumen_ia, estado_cumplimiento, "
        "recomendacion_ia, documentos_faltantes "
        "FROM FAT.TLIC_OPORTUNIDAD WHERE id = :1",
        [oportunidad_id],
    )
    return rows[0] if rows else None


def reemplazar_productos(oportunidad_id: int, productos: list[dict]) -> None:
    """Poblada por el SCRAPER (Parte A/orchestrator), no por IA -- cada corrida que
    releé el Aviso de Contrato es una foto nueva completa, mismo patron que
    reemplazar_requisitos."""
    with client.cursor() as cur:
        cur.execute("DELETE FROM FAT.TLIC_PRODUCTO WHERE oportunidad_id = :1", [oportunidad_id])
        for p in productos:
            cur.execute(
                "INSERT INTO FAT.TLIC_PRODUCTO (oportunidad_id, descripcion, cantidad) "
                "VALUES (:1, :2, :3)",
                [oportunidad_id, p["descripcion"], p.get("cantidad")],
            )
        cur.connection.commit()


def list_productos(oportunidad_id: int) -> list[dict]:
    return client.fetch_dicts(
        "SELECT id, descripcion, cantidad, actualizado_en FROM FAT.TLIC_PRODUCTO "
        "WHERE oportunidad_id = :1 ORDER BY id",
        [oportunidad_id],
    )
```

- [ ] **Step 4: Correr y confirmar que pasan**

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_lic_repo_productos -v 2`
Expected: `OK` (2 tests)

- [ ] **Step 5: Correr toda la suite de `apps.lic` (confirmar que `guardar_analisis_oportunidad` con la firma nueva no rompió llamadores existentes)**

Run: `docker compose exec -T backend python manage.py test apps.lic -v 2`
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/apps/legacy/repositories/lic_repo.py backend/apps/lic/tests/test_lic_repo_productos.py
git commit -m "feat(lic): productos por oportunidad y documentos_faltantes en lic_repo"
```

### Task 14: `analisis_licitacion.py` — `documentos_faltantes()` (solo código, sin IA)

Esta tarea YA NO agrega productos al prompt de la IA (corrección 2026-07-24) — solo agrega la
función pura `documentos_faltantes()`. El prompt de `analizar_licitacion` no se toca.

**Files:**
- Modify: `backend/apps/lic/services/analisis_licitacion.py`
- Test: `backend/apps/lic/tests/test_analisis_licitacion.py` (verificar si ya existe; si no, crear)

- [ ] **Step 1: Verificar si ya existe un archivo de tests para este módulo**

Run: `find backend/apps/lic/tests -iname "*analisis*"`

Si existe, agregar los tests de este task a ese archivo; si no, crear
`backend/apps/lic/tests/test_analisis_licitacion.py` con el contenido del Step 2 completo
(incluyendo imports).

- [ ] **Step 2: Escribir el test de `documentos_faltantes`**

```python
from apps.lic.services.analisis_licitacion import documentos_faltantes


def test_documentos_faltantes_detecta_no_subido_y_vencido():
    requisitos = [
        {"descripcion": "Registro Mercantil vigente", "estado": "no_cumple", "documento_empresa_id": None},
        {"descripcion": "RNC vigente", "estado": "parcial", "documento_empresa_id": 5},
        {"descripcion": "Experiencia mínima 2 años", "estado": "cumple", "documento_empresa_id": None},
    ]
    tipos_catalogo = [
        {"id": 1, "nombre": "Registro Mercantil"},
        {"id": 2, "nombre": "RNC"},
    ]
    documentos_empresa = [
        {"id": 5, "tipo_documento_id": 2, "vencido": True},
    ]

    faltantes = documentos_faltantes(requisitos, tipos_catalogo, documentos_empresa)

    assert {"tipo_documento": "Registro Mercantil", "motivo": "no subido"} in faltantes
    assert {"tipo_documento": "RNC", "motivo": "vencido"} in faltantes
    assert len(faltantes) == 2  # el requisito 'cumple' no genera entrada


def test_documentos_faltantes_vacio_si_todo_cumple():
    requisitos = [{"descripcion": "RNC vigente", "estado": "cumple", "documento_empresa_id": 1}]
    tipos_catalogo = [{"id": 2, "nombre": "RNC"}]
    documentos_empresa = [{"id": 1, "tipo_documento_id": 2, "vencido": False}]
    assert documentos_faltantes(requisitos, tipos_catalogo, documentos_empresa) == []
```

- [ ] **Step 3: Correr y confirmar que falla**

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_analisis_licitacion -v 2`
Expected: FAIL — `ImportError: cannot import name 'documentos_faltantes'`

- [ ] **Step 4: Implementar `documentos_faltantes` y extender el prompt en `analisis_licitacion.py`**

Agregar al final del archivo (después de `analizar_licitacion`, antes de
`ejecutar_analisis_oportunidad`):

```python
def documentos_faltantes(
    requisitos: list[dict], tipos_catalogo: list[dict], documentos_empresa: list[dict],
) -> list[dict]:
    """Post-procesamiento puro (sin llamada a IA): para cada tipo de documento del
    catálogo que aparezca mencionado por nombre en algún requisito evaluado como
    'no_cumple' o 'parcial', arma una entrada {"tipo_documento", "motivo"} -- "no
    subido" si ningún documento de empresa de ese tipo existe, "vencido" si existe
    pero está marcado vencido. Solo señala; no genera ni redacta nada."""
    documentos_por_tipo_id = {d["id"]: d for d in documentos_empresa}
    tipo_id_a_nombre = {t["id"]: t["nombre"] for t in tipos_catalogo}

    faltantes: list[dict] = []
    vistos: set[str] = set()
    for r in requisitos:
        if r["estado"] not in ("no_cumple", "parcial"):
            continue
        descripcion_baja = r["descripcion"].lower()
        for tipo in tipos_catalogo:
            if tipo["nombre"].lower() not in descripcion_baja:
                continue
            if tipo["nombre"] in vistos:
                continue
            doc_id = r.get("documento_empresa_id")
            doc = documentos_por_tipo_id.get(doc_id) if doc_id else None
            if doc is None:
                motivo = "no subido"
            elif doc.get("vencido"):
                motivo = "vencido"
            else:
                continue  # tiene documento vigente de ese tipo, pero el requisito
                          # sigue 'parcial' por otra razón no relacionada al tipo
            vistos.add(tipo["nombre"])
            faltantes.append({"tipo_documento": tipo["nombre"], "motivo": motivo})
    return faltantes
```

El prompt de `analizar_licitacion` (líneas 78-96) y el parseo de su respuesta (líneas 107-132)
**no se modifican** en esta tarea — siguen exactamente como están hoy (resumen + requisitos +
estado_cumplimiento + recomendación, sin productos).

- [ ] **Step 5: Correr y confirmar que pasan**

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_analisis_licitacion -v 2`
Expected: `OK` (2 tests nuevos, más los que ya existieran en ese archivo)

- [ ] **Step 6: Commit**

```bash
git add backend/apps/lic/services/analisis_licitacion.py backend/apps/lic/tests/test_analisis_licitacion.py
git commit -m "feat(lic): productos/servicios en el analisis IA + funcion pura documentos_faltantes"
```

### Task 15: Scraper extrae productos del Aviso de Contrato (código, sin IA) + conectar `documentos_faltantes`

**Files:**
- Modify: `backend/apps/lic/services/scraper.py` (`_extraer_detalle_aviso_contrato`)
- Modify: `backend/apps/lic/services/orchestrator.py` (`_descargar_y_guardar_documentos`,
  `_analizar_y_registrar`)
- Modify: `backend/apps/lic/services/analisis_licitacion.py:135-189` (`ejecutar_analisis_oportunidad`)
- Test: `backend/apps/lic/tests/test_orchestrator.py`

- [ ] **Step 1: Escribir el test de extracción de productos (parseo puro)**

Agregar a `backend/apps/lic/tests/test_scraper_advanced_search_parse.py` (mismo archivo del
Task 1, mismo estilo de fixture):

```python
from apps.lic.services.scraper import parse_productos_aviso_contrato_html

TABLA_PRODUCTOS_HTML = """
<table id="grdLineItemsListP2Gen">
  <tr><td><span id="spnItemDescription_1">100 laptops core i5</span></td>
       <td><span id="spnItemQuantity_1">100</span></td></tr>
  <tr><td><span id="spnItemDescription_2">Servicio de instalación</span></td>
       <td><span id="spnItemQuantity_2">1</span></td></tr>
</table>
"""


def test_parse_productos_aviso_contrato_html_extrae_filas():
    productos = parse_productos_aviso_contrato_html(TABLA_PRODUCTOS_HTML)
    assert productos == [
        {"descripcion": "100 laptops core i5", "cantidad": "100"},
        {"descripcion": "Servicio de instalación", "cantidad": "1"},
    ]


def test_parse_productos_aviso_contrato_html_tabla_vacia_da_lista_vacia():
    assert parse_productos_aviso_contrato_html("<table id='grdLineItemsListP2Gen'></table>") == []
```

**Nota importante para quien ejecute esta tarea:** el selector `#grdLineItemsListP2Gen` /
`spnItemDescription_`/`spnItemQuantity_` es un **best-effort** basado en el patrón ya confirmado
en vivo para la tabla de documentos (`#grdGridDocumentList_tbl`, ver `parse_documento_row_html`)
— la sección real de ítems/rubros solicitados del Aviso de Contrato **no se verificó en vivo**
para esta tarea (se confirmó por descripción del usuario que la información existe en la página,
pero no el selector exacto). Antes de dar este paso por completo: abrir en vivo el Aviso de
Contrato de una oportunidad real con documentos/ítems (usar las credenciales de
`TLIC_CREDENCIAL`, mismo flujo que `download_documentos`), inspeccionar el DOM real de la
sección de ítems solicitados, y ajustar `parse_productos_aviso_contrato_html` (selectores) y
este fixture de test para que coincidan con la estructura real encontrada — documentando el
selector real en el mensaje de commit. Si esa sección resulta no existir como tabla estructurada
para algunos tipos de proceso, el campo queda como lista vacía (no aborta nada más), igual que
los demás campos opcionales de `_extraer_detalle_aviso_contrato`.

- [ ] **Step 2: Correr y confirmar que falla**

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_scraper_advanced_search_parse.test_parse_productos_aviso_contrato_html_extrae_filas -v 2`
Expected: FAIL — `ImportError: cannot import name 'parse_productos_aviso_contrato_html'`

- [ ] **Step 3: Implementar `parse_productos_aviso_contrato_html` en `scraper.py`**

Agregar junto a `parse_documento_row_html` (después de la línea 99):

```python
def parse_productos_aviso_contrato_html(tabla_html: str) -> list[dict]:
    """Parsea la tabla de items/rubros solicitados del Aviso de Contrato -- dato
    estructurado que el portal ya expone directamente (igual que la
    descripción completa/unidad de requisición/presupuesto que lee
    ``_extraer_detalle_aviso_contrato``), por eso se extrae por código y NO
    con IA. Selector confirmado en vivo el <FECHA DE LA VERIFICACION>: ver
    nota en el plan sobre el selector real usado."""
    soup = BeautifulSoup(tabla_html, "html.parser")
    filas = soup.select("tr")
    productos = []
    for fila in filas:
        desc_el = fila.select_one("span[id*='spnItemDescription_']")
        cant_el = fila.select_one("span[id*='spnItemQuantity_']")
        if desc_el is None:
            continue
        productos.append({
            "descripcion": desc_el.get_text(strip=True),
            "cantidad": cant_el.get_text(strip=True) if cant_el else None,
        })
    return productos
```

Agregar el nuevo campo a `_extraer_detalle_aviso_contrato` (dentro del bloque `detalle = {...}` y
su lectura), agregando `"productos": []` al dict inicial y, junto a los demás bloques
`try/except` de ese método:

```python
        try:
            tabla = cn_page.locator("#grdLineItemsListP2Gen").first
            if tabla.count() > 0:
                html_tabla = tabla.evaluate("el => el.outerHTML")
                detalle["productos"] = parse_productos_aviso_contrato_html(html_tabla)
        except Exception:  # noqa: BLE001 - campo opcional, no debe tumbar el resto
            logger.warning("lic.scraper: no se pudo leer productos/items (referencia=%s)", referencia)
```

- [ ] **Step 4: Correr y confirmar que pasa**

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_scraper_advanced_search_parse -v 2`
Expected: `OK`

- [ ] **Step 5: Orquestador — guardar los productos extraídos**

Escribir el test en `test_orchestrator.py`:

```python
@pytest.mark.django_db
def test_ejecutar_scrape_guarda_productos_extraidos_por_el_scraper():
    job = ScrapeJob.objects.create(trigger="manual", no_cia="01")
    credencial = {"no_cia": "01", "usuario_portal": "abregonza", "password_cifrado": "x"}

    with patch("apps.lic.services.orchestrator.lic_repo") as repo, \
         patch("apps.lic.services.orchestrator.crypto") as crypto, \
         patch("apps.lic.services.orchestrator.LicitacionesScraper") as ScraperCls:
        repo.get_credencial_con_password.return_value = credencial
        crypto.decrypt.return_value = "plain-password"
        repo.upsert_oportunidad.return_value = (1, True)
        scraper_instance = MagicMock()
        scraper_instance.buscar_avanzada.return_value = []
        scraper_instance.list_oportunidades.return_value = [{"referencia": "REF-1", "titulo": "algo"}]
        scraper_instance.download_documentos.return_value = {
            "documentos": [],
            "detalle": {"productos": [{"descripcion": "100 laptops", "cantidad": "100"}]},
        }
        ScraperCls.return_value.__enter__.return_value = scraper_instance

        ejecutar_scrape(job, empresas=["01"])

    repo.reemplazar_productos.assert_called_once_with(
        1, [{"descripcion": "100 laptops", "cantidad": "100"}]
    )
```

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_orchestrator.test_ejecutar_scrape_guarda_productos_extraidos_por_el_scraper -v 2`
Expected: FAIL — `AssertionError: Expected 'reemplazar_productos' to have been called once. Called 0 times.`

Modificar `_descargar_y_guardar_documentos` en `orchestrator.py` (donde ya se llama
`lic_repo.actualizar_detalle_oportunidad(oportunidad_id, detalle)`):

```python
    documentos = resultado["documentos"]
    detalle = resultado["detalle"]
    if any(v for k, v in detalle.items() if k != "productos"):
        lic_repo.actualizar_detalle_oportunidad(oportunidad_id, detalle)
    if detalle.get("productos"):
        lic_repo.reemplazar_productos(oportunidad_id, detalle["productos"])
```

(reemplaza las líneas existentes `if any(detalle.values()): lic_repo.actualizar_detalle_
oportunidad(oportunidad_id, detalle)`)

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_orchestrator -v 2`
Expected: `OK` (todos, incluyendo los preexistentes y los de los Tasks 3 y 15)

- [ ] **Step 6: Conectar `documentos_faltantes` en `ejecutar_analisis_oportunidad`** (sin tocar productos)

Reemplazar únicamente la llamada a `guardar_analisis_oportunidad` dentro de
`ejecutar_analisis_oportunidad` (líneas 182-185 del archivo original, antes de
`reemplazar_requisitos`):

```python
    resultado = analizar_licitacion(oportunidad["titulo"] or "", textos_licitacion, documentos_empresa)

    lic_repo.guardar_analisis_oportunidad(
        oportunidad_id, resultado["resumen"], resultado["estado_cumplimiento"],
        resultado["recomendacion"],
        documentos_faltantes=documentos_faltantes(
            resultado["requisitos"],
            lic_repo.list_tipos_documento(),
            lic_repo.list_documentos_empresa(oportunidad["no_cia"]),
        ),
    )
    lic_repo.reemplazar_requisitos(oportunidad_id, resultado["requisitos"])
    resultado["requisitos"] = lic_repo.list_requisitos(oportunidad_id)
    return resultado
```

Esta función **no** toca `TLIC_PRODUCTO` ni devuelve `productos` -- eso ya lo puebla el scraper
(Step 5 de esta misma tarea), independientemente de si el análisis IA se corrió o no.

- [ ] **Step 7: Correr toda la suite de `apps.lic`**

Run: `docker compose exec -T backend python manage.py test apps.lic -v 2`
Expected: `OK`

- [ ] **Step 8: Commit**

```bash
git add backend/apps/lic/services/scraper.py backend/apps/lic/services/orchestrator.py backend/apps/lic/services/analisis_licitacion.py backend/apps/lic/tests/test_scraper_advanced_search_parse.py backend/apps/lic/tests/test_orchestrator.py
git commit -m "feat(lic): scraper extrae productos del Aviso de Contrato (sin IA) + conectar documentos_faltantes"
```

### Task 16: Endpoint de productos, descarga, y precio (búsqueda por código + recomendación IA)

**Files:**
- Modify: `backend/apps/lic/views.py`
- Modify: `backend/apps/lic/urls.py`
- Test: `backend/apps/lic/tests/test_views_tipo_documento.py` (o un nuevo
  `test_views_productos.py`, siguiendo el mismo patrón de `cliente_autenticado`)

- [ ] **Step 1: Escribir el test de smoke**

```python
# backend/apps/lic/tests/test_views_productos.py
import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.legacy.repositories import lic_repo


@pytest.fixture
def cliente_autenticado(db):
    User = get_user_model()
    user = User.objects.create_user(username="tester2", password="x")
    client = Client()
    client.force_login(user)
    return client


@pytest.mark.django_db
def test_get_productos_de_oportunidad(cliente_autenticado):
    oportunidad_id, _ = lic_repo.upsert_oportunidad("01", {"referencia": "REF-VIEW-1", "titulo": "x"})
    lic_repo.reemplazar_productos(oportunidad_id, [{"descripcion": "50 sillas"}])
    resp = cliente_autenticado.get(f"/api/lic/oportunidades/{oportunidad_id}/productos/")
    assert resp.status_code == 200
    assert resp.json()["productos"][0]["descripcion"] == "50 sillas"
```

- [ ] **Step 2: Correr y confirmar que falla**

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_views_productos -v 2`
Expected: FAIL — 404 (la ruta no existe)

- [ ] **Step 3: Agregar la vista y la ruta**

Agregar en `views.py`, después de `requisitos_view` (después de la línea 324):

```python
@login_required
@require_http_methods(["GET"])
def productos_view(request, oportunidad_id: int):
    return JsonResponse({"productos": lic_repo.list_productos(oportunidad_id)})


@login_required
@require_http_methods(["GET"])
def documento_descargar_view(request, documento_id: int):
    documento = lic_repo.get_documento(documento_id)
    if not documento or not Path(documento["ruta_archivo"]).exists():
        raise Http404("Documento no encontrado")
    return FileResponse(
        open(documento["ruta_archivo"], "rb"),
        as_attachment=True,
        filename=documento["nombre_archivo"],
    )
```

Agregar a `urls.py` (después de `oportunidades/<int:oportunidad_id>/requisitos/`):

```python
    path("oportunidades/<int:oportunidad_id>/productos/", views.productos_view),
    path("documentos/<int:documento_id>/descargar/", views.documento_descargar_view),
```

(la vista `documento_descargar_view` cubre de una vez la descarga de documentos de la
**licitación**, requerida por la Parte D — evita duplicar el endpoint más adelante).

- [ ] **Step 4: Correr y confirmar que pasan**

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_views_productos -v 2`
Expected: `OK`

- [ ] **Step 5: Correr toda la suite de `apps.lic`**

Run: `docker compose exec -T backend python manage.py test apps.lic -v 2`
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/apps/lic/views.py backend/apps/lic/urls.py backend/apps/lic/tests/test_views_productos.py
git commit -m "feat(lic): endpoint de productos y descarga de documentos de la licitacion"
```

- [ ] **Step 7: `lic_repo.buscar_precio_historico` — búsqueda por código (sin IA)**

Escribir el test en `test_lic_repo_productos.py`:

```python
@pytest.mark.django_db
def test_buscar_precio_historico_encuentra_por_descripcion_similar():
    # Setup minimo: una factura con un detalle cuyo producto coincide por LIKE.
    # Usa las tablas reales FAT.TFAT_FACTURA / FAT.TFAT_FACTURAL -- si el entorno de
    # pruebas no tiene datos de FAT, insertar filas de fixture directas con client.cursor()
    # antes de llamar buscar_precio_historico, y limpiarlas al final del test.
    from apps.legacy import client
    with client.cursor() as cur:
        cur.execute(
            "INSERT INTO FAT.TFAT_FACTURA (no_cia, punto, tipo_factura, no_factura, "
            "no_cliente, fecha) VALUES ('01', '01', 'FT', '9999999', '1', SYSDATE)"
        )
        cur.execute(
            "INSERT INTO FAT.TFAT_FACTURAL (no_cia, punto, tipo_factura, no_factura, "
            "no_produ, descripcion, precio, cantidad) VALUES "
            "('01', '01', 'FT', '9999999', 'LAPTOP01', 'Laptop core i5 16GB', 45000, 1)"
        )
        cur.connection.commit()

    resultados = lic_repo.buscar_precio_historico("01", "laptop core i5")

    assert any(r["descripcion"] == "Laptop core i5 16GB" and float(r["precio"]) == 45000 for r in resultados)

    with client.cursor() as cur:
        cur.execute(
            "DELETE FROM FAT.TFAT_FACTURAL WHERE no_cia='01' AND no_factura='9999999'"
        )
        cur.execute(
            "DELETE FROM FAT.TFAT_FACTURA WHERE no_cia='01' AND no_factura='9999999'"
        )
        cur.connection.commit()
```

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_lic_repo_productos.test_buscar_precio_historico_encuentra_por_descripcion_similar -v 2`
Expected: FAIL — `AttributeError: ... has no attribute 'buscar_precio_historico'`

Implementar en `lic_repo.py` (al final del archivo):

```python
def buscar_precio_historico(no_cia: str, texto_producto: str) -> list[dict]:
    """Busqueda de CODIGO (LIKE, sin IA) del precio mas reciente al que se
    factuo/cotizo algo con nombre parecido -- join FAT.TFAT_FACTURAL +
    FAT.TFAT_FACTURA por (no_cia, punto, tipo_factura, no_factura), igual
    patron de join que el resto de fat_repo. No intenta fuzzy matching
    avanzado: un LIKE simple sobre la descripcion es suficiente para dar a la
    IA (Task de apps.lic.services.recomendar_precio) contexto real en vez de
    nada -- mejorar el matching queda fuera de alcance de este plan."""
    patron = f"%{texto_producto.strip()}%"
    return client.fetch_dicts(
        "SELECT fl.no_produ, fl.descripcion, fl.precio, f.fecha "
        "FROM FAT.TFAT_FACTURAL fl "
        "JOIN FAT.TFAT_FACTURA f ON f.no_cia = fl.no_cia AND f.punto = fl.punto "
        "  AND f.tipo_factura = fl.tipo_factura AND f.no_factura = fl.no_factura "
        "WHERE fl.no_cia = :1 AND UPPER(fl.descripcion) LIKE UPPER(:2) "
        "ORDER BY f.fecha DESC",
        [no_cia, patron],
    )
```

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_lic_repo_productos.test_buscar_precio_historico_encuentra_por_descripcion_similar -v 2`
Expected: `OK`

- [ ] **Step 8: `apps/lic/services/recomendar_precio.py` — la IA solo recomienda con datos ya encontrados**

Escribir el test en `backend/apps/lic/tests/test_recomendar_precio.py` (crear):

```python
from unittest.mock import patch

from apps.lic.services.recomendar_precio import recomendar_precio


def test_recomendar_precio_usa_solo_el_historial_entregado():
    historial = [{"no_produ": "LAPTOP01", "descripcion": "Laptop core i5 16GB",
                  "precio": 45000, "fecha": "2026-05-10"}]
    with patch("apps.lic.services.recomendar_precio._llamar_claude") as llamar_claude:
        llamar_claude.return_value = (
            '{"precio_sugerido": "45,000 - 47,000 DOP", '
            '"justificacion": "Se cotizó un producto similar en mayo 2026 a 45,000 DOP"}'
        )
        resultado = recomendar_precio("100 laptops core i5", historial)

    assert resultado == {
        "precio_sugerido": "45,000 - 47,000 DOP",
        "justificacion": "Se cotizó un producto similar en mayo 2026 a 45,000 DOP",
    }
    # El prompt debe incluir el historial recibido, no inventar uno propio
    prompt_enviado = llamar_claude.call_args[0][0]
    assert "45000" in prompt_enviado or "45,000" in prompt_enviado


def test_recomendar_precio_sin_historial_lo_deja_explicito_en_el_prompt():
    with patch("apps.lic.services.recomendar_precio._llamar_claude") as llamar_claude:
        llamar_claude.return_value = '{"precio_sugerido": null, "justificacion": "Sin historial"}'
        resultado = recomendar_precio("producto nuevo sin historial", [])

    assert resultado["precio_sugerido"] is None
    prompt_enviado = llamar_claude.call_args[0][0]
    assert "no hay historial" in prompt_enviado.lower() or "sin historial" in prompt_enviado.lower()
```

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_recomendar_precio -v 2`
Expected: FAIL — `ModuleNotFoundError: No module named 'apps.lic.services.recomendar_precio'`

Crear `backend/apps/lic/services/recomendar_precio.py`:

```python
"""Recomendacion de precio para un producto/servicio pedido por una licitacion --
la IA NUNCA busca el historial por su cuenta, solo redacta una recomendacion a
partir del historial que ya trajo lic_repo.buscar_precio_historico (codigo, sin
IA). No repite informacion que la licitacion ya trae (la descripcion del
producto la aporta quien llama, no se le pide "extraer" nada)."""
import json
import logging

from django.conf import settings

logger = logging.getLogger(__name__)


class RecomendacionPrecioError(Exception):
    pass


def _llamar_claude(prompt: str) -> str:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    mensaje = client.messages.create(
        model=settings.ASISTENTE_DEFAULT_MODEL,
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}],
    )
    return mensaje.content[0].text


def _limpiar_fences_markdown(texto: str) -> str:
    lineas = texto.strip().split("\n")
    if lineas and lineas[0].strip().lower().startswith("```"):
        lineas = lineas[1:]
    if lineas and lineas[-1].strip() == "```":
        lineas = lineas[:-1]
    return "\n".join(lineas).strip()


def recomendar_precio(descripcion_producto: str, historial: list[dict]) -> dict:
    if historial:
        bloque_historial = "\n".join(
            f"- {h['descripcion']}: {h['precio']} (facturado/cotizado el {h['fecha']})"
            for h in historial[:10]
        )
    else:
        bloque_historial = "(no hay historial de precios previos para nada parecido en el sistema)"

    prompt = (
        "Eres un asistente que ayuda a una empresa dominicana a fijar un precio para "
        f"participar en una licitación pública. Producto/servicio pedido: \"{descripcion_producto}\".\n\n"
        f"Historial de precios ya facturados/cotizados por la empresa para productos parecidos:\n"
        f"{bloque_historial}\n\n"
        "Devuelve SOLO un objeto JSON (sin texto adicional, sin markdown):\n"
        '{"precio_sugerido": "rango o monto en DOP, o null si el historial no alcanza para '
        'sugerir nada", "justificacion": "1-2 frases explicando la sugerencia basada SOLO en '
        'el historial de arriba"}\n\n'
        "No inventes precios de mercado que no estén en el historial entregado."
    )

    respuesta = _llamar_claude(prompt)
    respuesta_limpia = _limpiar_fences_markdown(respuesta) if isinstance(respuesta, str) else respuesta
    try:
        data = json.loads(respuesta_limpia)
    except (json.JSONDecodeError, TypeError) as exc:
        logger.warning("Respuesta de Claude no es JSON valido para recomendar_precio: %r", respuesta)
        raise RecomendacionPrecioError("La IA no devolvió una respuesta utilizable") from exc

    return {
        "precio_sugerido": data.get("precio_sugerido"),
        "justificacion": str(data.get("justificacion", ""))[:1000],
    }
```

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_recomendar_precio -v 2`
Expected: `OK`

- [ ] **Step 9: Endpoint `POST /api/lic/productos/<id>/recomendar-precio/`**

Escribir el test en `test_views_productos.py`:

```python
@pytest.mark.django_db
def test_recomendar_precio_producto(cliente_autenticado):
    oportunidad_id, _ = lic_repo.upsert_oportunidad("01", {"referencia": "REF-VIEW-2", "titulo": "x"})
    lic_repo.reemplazar_productos(oportunidad_id, [{"descripcion": "100 laptops", "cantidad": "100"}])
    producto = lic_repo.list_productos(oportunidad_id)[0]

    with patch("apps.lic.views.lic_repo.buscar_precio_historico") as buscar, \
         patch("apps.lic.views.recomendar_precio") as recomendar:
        buscar.return_value = []
        recomendar.return_value = {"precio_sugerido": None, "justificacion": "Sin historial"}
        resp = cliente_autenticado.post(f"/api/lic/productos/{producto['id']}/recomendar-precio/")

    assert resp.status_code == 200
    assert resp.json()["justificacion"] == "Sin historial"
```

(agregar `from unittest.mock import patch` a los imports del archivo de test si no está)

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_views_productos.test_recomendar_precio_producto -v 2`
Expected: FAIL — 404 (la ruta no existe)

Agregar a `lic_repo.py`:

```python
def get_producto(producto_id: int) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT id, oportunidad_id, descripcion, cantidad FROM FAT.TLIC_PRODUCTO WHERE id = :1",
        [producto_id],
    )
    return rows[0] if rows else None
```

Agregar a `views.py` (import `from apps.lic.services.recomendar_precio import recomendar_precio,
RecomendacionPrecioError` al inicio, junto a los demás imports de `apps.lic.services`):

```python
@login_required
@csrf_exempt
@require_http_methods(["POST"])
def recomendar_precio_view(request, producto_id: int):
    producto = lic_repo.get_producto(producto_id)
    if not producto:
        return _err("Producto no encontrado", status=404)

    oportunidad = lic_repo.get_oportunidad(producto["oportunidad_id"])
    historial = lic_repo.buscar_precio_historico(oportunidad["no_cia"], producto["descripcion"])
    try:
        resultado = recomendar_precio(producto["descripcion"], historial)
    except RecomendacionPrecioError as exc:
        return _err(str(exc), status=400)

    return JsonResponse({"historial": historial, **resultado})
```

Agregar a `urls.py`:

```python
    path("productos/<int:producto_id>/recomendar-precio/", views.recomendar_precio_view),
```

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_views_productos -v 2`
Expected: `OK`

- [ ] **Step 10: Correr toda la suite de `apps.lic`**

Run: `docker compose exec -T backend python manage.py test apps.lic -v 2`
Expected: `OK`

- [ ] **Step 11: Commit**

```bash
git add backend/apps/legacy/repositories/lic_repo.py backend/apps/lic/services/recomendar_precio.py backend/apps/lic/views.py backend/apps/lic/urls.py backend/apps/lic/tests/test_lic_repo_productos.py backend/apps/lic/tests/test_recomendar_precio.py backend/apps/lic/tests/test_views_productos.py
git commit -m "feat(lic): buscar precio historico por codigo + recomendacion de precio con IA"
```

---

## Parte D — Detalle como página completa

### Task 17: Frontend `api.ts` — `Producto`, `documentos_faltantes`, URL de descarga

**Files:**
- Modify: `frontend/src/features/lic/api.ts`

- [ ] **Step 1: Agregar el tipo `Producto` y `DocumentoFaltante`, extender `Oportunidad` y `AnalisisOportunidad`**

Reemplazar la interfaz `Oportunidad` (líneas 66-82):

```typescript
export interface DocumentoFaltante {
  tipo_documento: string
  motivo: 'no subido' | 'vencido'
}

export interface Oportunidad {
  id: number
  referencia: string
  tipo_proceso: string | null
  entidad: string | null
  titulo: string | null
  estado_portal: string | null
  ofertas_presentadas: number
  ofertas_creadas: number
  fecha_publicacion: string | null
  fecha_limite: string | null
  resumen_ia: string | null
  estado_cumplimiento: 'verde' | 'amarillo' | 'rojo' | null
  recomendacion_ia: string | null
  unidad_requisicion: string | null
  presupuesto_estimado: string | null
  documentos_faltantes: DocumentoFaltante[] | null
}

export interface Producto {
  id: number
  descripcion: string
  actualizado_en: string
}
```

`AnalisisOportunidad` **no cambia** respecto al código actual (sigue siendo solo resumen +
recomendación + estado_cumplimiento + requisitos) -- productos ya no viene del análisis de IA,
así que no se le agrega ese campo (corrección 2026-07-24).

Actualizar `Producto` con `cantidad`, y agregar los tipos de precio:

```typescript
export interface Producto {
  id: number
  descripcion: string
  cantidad: string | null
  actualizado_en: string
}

export interface PrecioHistorico {
  no_produ: string
  descripcion: string
  precio: number
  fecha: string
}

export interface RecomendacionPrecio {
  historial: PrecioHistorico[]
  precio_sugerido: string | null
  justificacion: string
}
```

- [ ] **Step 2: Agregar `useProductos`, `useRecomendarPrecio` y `documentoDescargarUrl`**

Agregar después de `useRequisitos` (al final del archivo):

```typescript
export function useProductos(oportunidadId: number | null) {
  return useQuery({
    queryKey: ['lic-productos', oportunidadId],
    queryFn: () =>
      licRequest<{ productos: Producto[] }>(
        `/lic/oportunidades/${oportunidadId}/productos/`
      ),
    enabled: !!oportunidadId,
  })
}

export function useRecomendarPrecio() {
  return useMutation({
    mutationFn: (productoId: number) =>
      licRequest<RecomendacionPrecio>(
        `/lic/productos/${productoId}/recomendar-precio/`,
        { method: 'POST' }
      ),
  })
}

export function documentoDescargarUrl(documentoId: number): string {
  return `${API_BASE}/lic/documentos/${documentoId}/descargar/`
}
```

El backend (Task 13) ya guarda `documentos_faltantes` como JSON string en
`TLIC_OPORTUNIDAD.DOCUMENTOS_FALTANTES`, pero `oportunidades_view`/`list_oportunidades` **no** lo
expone todavía en `GET /api/lic/oportunidades/` — se resuelve en el Task 18 (backend) antes de
que el frontend lo use.

- [ ] **Step 3: Verificación de tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: errores esperados en `lic-oportunidades.tsx` porque `AnalisisSeccion` referencia
`analizar.data?.requisitos` sin `productos` todavía — se resuelven en el Task 20. Confirmar que
no hay errores nuevos en `api.ts` en sí.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/lic/api.ts
git commit -m "feat(lic): tipos Producto/DocumentoFaltante y hook useProductos en el frontend"
```

### Task 18: Backend — exponer `documentos_faltantes` en `list_oportunidades`

**Files:**
- Modify: `backend/apps/legacy/repositories/lic_repo.py:165-187`
- Test: `backend/apps/lic/tests/test_lic_repo_productos.py`

- [ ] **Step 1: Escribir el test**

Agregar a `test_lic_repo_productos.py`:

```python
@pytest.mark.django_db
def test_list_oportunidades_incluye_documentos_faltantes_parseado():
    oportunidad_id = _crear_oportunidad(referencia="REF-PROD-3")
    faltantes = [{"tipo_documento": "RNC", "motivo": "no subido"}]
    lic_repo.guardar_analisis_oportunidad(
        oportunidad_id, "r", "rojo", None, documentos_faltantes=faltantes
    )
    oportunidades = lic_repo.list_oportunidades("01", solo_abiertas=False)
    encontrada = next(o for o in oportunidades if o["id"] == oportunidad_id)
    assert encontrada["documentos_faltantes"] == faltantes
```

- [ ] **Step 2: Correr y confirmar que falla**

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_lic_repo_productos.test_list_oportunidades_incluye_documentos_faltantes_parseado -v 2`
Expected: FAIL — `KeyError: 'documentos_faltantes'`

- [ ] **Step 3: Modificar `list_oportunidades`**

Reemplazar el cuerpo de la función (líneas 165-187):

```python
def list_oportunidades(
    no_cia: str, estado_portal: str | None = None, solo_abiertas: bool = True
) -> list[dict]:
    """Por defecto solo trae oportunidades cuya fecha limite de ofertas no ha
    pasado (las unicas en las que realmente se puede participar todavia) --
    el portal en si mantiene el historial completo desde 2020, incluyendo
    procesos ya cerrados/adjudicados hace años, que no son "oportunidades"
    reales de negocio."""
    sql = (
        "SELECT id, referencia, tipo_proceso, entidad, titulo, estado_portal, "
        "ofertas_presentadas, ofertas_creadas, fecha_publicacion, fecha_limite, "
        "resumen_ia, estado_cumplimiento, recomendacion_ia, "
        "unidad_requisicion, presupuesto_estimado, documentos_faltantes "
        "FROM FAT.TLIC_OPORTUNIDAD WHERE no_cia = :1"
    )
    params = [no_cia]
    if estado_portal:
        sql += " AND estado_portal = :2"
        params.append(estado_portal)
    if solo_abiertas:
        sql += " AND fecha_limite >= TRUNC(SYSDATE)"
    sql += " ORDER BY fecha_limite ASC"
    filas = client.fetch_dicts(sql, params)
    for fila in filas:
        crudo = fila.pop("documentos_faltantes", None)
        fila["documentos_faltantes"] = json.loads(crudo) if crudo else []
    return filas
```

- [ ] **Step 4: Correr y confirmar que pasan**

Run: `docker compose exec -T backend python manage.py test apps.lic.tests.test_lic_repo_productos -v 2`
Expected: `OK`

- [ ] **Step 5: Correr toda la suite de `apps.lic`**

Run: `docker compose exec -T backend python manage.py test apps.lic -v 2`
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/apps/legacy/repositories/lic_repo.py backend/apps/lic/tests/test_lic_repo_productos.py
git commit -m "feat(lic): exponer documentos_faltantes parseado en list_oportunidades"
```

### Task 19: Frontend — página de detalle `/lic/oportunidades/$oportunidadId`

**Files:**
- Create: `frontend/src/features/lic/lic-oportunidad-detalle.tsx`
- Create: `frontend/src/routes/_authenticated/lic/oportunidades/$oportunidadId.tsx`

- [ ] **Step 1: Crear el componente de detalle con las 4 secciones en orden**

```typescript
// frontend/src/features/lic/lic-oportunidad-detalle.tsx
// Pagina de detalle de una oportunidad (reemplaza el modal): orden fijo
// 1. Descripcion, 2. Requisitos, 3. Productos/servicios (+ documentos
// faltantes), 4. Documentos de la licitacion con descarga.
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ArrowLeft, Download, FileText, Sparkles, Wand2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type Documento,
  type DocumentoFaltante,
  type Oportunidad,
  type Producto,
  type Requisito,
  documentoDescargarUrl,
  useAnalizarOportunidad,
  useDocumentos,
  useGenerarResumenDocumento,
  useOportunidades,
  useProductos,
  useRecomendarPrecio,
  useRequisitos,
} from './api'
import { useCompany } from '@/hooks/use-company'

const CUMPLIMIENTO_INFO: Record<
  'verde' | 'amarillo' | 'rojo',
  { color: string; label: string; corto: string }
> = {
  verde: { color: 'bg-green-500', label: 'Cumple los requisitos evaluados', corto: 'Aplica' },
  amarillo: { color: 'bg-yellow-500', label: 'Cumple parcialmente', corto: 'Parcial' },
  rojo: { color: 'bg-red-500', label: 'No cumple / faltan documentos', corto: 'No aplica' },
}

const REQUISITO_ESTADO_INFO: Record<Requisito['estado'], { color: string; label: string }> = {
  cumple: { color: 'bg-green-500', label: 'Cumple' },
  parcial: { color: 'bg-yellow-500', label: 'Parcial' },
  no_cumple: { color: 'bg-red-500', label: 'No cumple' },
  sin_evaluar: { color: 'bg-muted-foreground/30', label: 'Sin evaluar' },
}

const DOC_ESTADO_VARIANT: Record<'ok' | 'error', 'default' | 'destructive'> = {
  ok: 'default',
  error: 'destructive',
}

export function LicOportunidadDetalle({ oportunidadId }: { oportunidadId: number }) {
  const { selectedCompany } = useCompany()
  const { data, isLoading } = useOportunidades(selectedCompany, undefined, true)
  const oportunidad = data?.oportunidades.find((o) => o.id === oportunidadId) ?? null

  if (isLoading) return <Skeleton className='h-96 w-full' />
  if (!oportunidad) {
    return (
      <div className='space-y-3'>
        <VolverLink />
        <p className='text-sm text-muted-foreground'>
          Oportunidad no encontrada para la empresa {selectedCompany}.
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-5'>
      <VolverLink />

      <div>
        <h3 className='font-mono text-sm text-muted-foreground'>{oportunidad.referencia}</h3>
        <h2 className='text-lg font-semibold'>{oportunidad.titulo}</h2>
        <p className='text-sm text-muted-foreground'>{oportunidad.entidad}</p>
      </div>

      <SeccionDescripcion oportunidad={oportunidad} />
      <SeccionRequisitos oportunidad={oportunidad} />
      <SeccionProductos oportunidad={oportunidad} />
      <SeccionDocumentos oportunidadId={oportunidad.id} />
    </div>
  )
}

function VolverLink() {
  return (
    <Link
      to='/lic/oportunidades'
      className='inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground'
    >
      <ArrowLeft className='h-4 w-4' />
      Volver a Oportunidades
    </Link>
  )
}

// 1. Descripcion
function SeccionDescripcion({ oportunidad }: { oportunidad: Oportunidad }) {
  const analizar = useAnalizarOportunidad()
  const resumen = analizar.data?.resumen ?? oportunidad.resumen_ia
  const recomendacion = analizar.data?.recomendacion ?? oportunidad.recomendacion_ia
  const estadoCumplimiento = analizar.data?.estado_cumplimiento ?? oportunidad.estado_cumplimiento

  return (
    <section className='space-y-3 rounded-md border p-4'>
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          {estadoCumplimiento && (
            <span
              title={CUMPLIMIENTO_INFO[estadoCumplimiento].label}
              className={`inline-block h-2.5 w-2.5 rounded-full ${CUMPLIMIENTO_INFO[estadoCumplimiento].color}`}
            />
          )}
          <h4 className='text-sm font-semibold'>1. Descripción</h4>
        </div>
        <Button
          type='button'
          size='sm'
          variant='outline'
          className='gap-1.5'
          disabled={analizar.isPending}
          onClick={() =>
            analizar.mutate(oportunidad.id, { onError: (e) => toast.error(e.message) })
          }
        >
          <Wand2 className='h-3.5 w-3.5' />
          {analizar.isPending ? 'Analizando…' : resumen ? 'Volver a analizar' : 'Analizar oportunidad'}
        </Button>
      </div>

      <div className='flex flex-wrap gap-4 text-sm'>
        {oportunidad.unidad_requisicion && (
          <span><span className='text-muted-foreground'>Unidad de requisición: </span>{oportunidad.unidad_requisicion}</span>
        )}
        {oportunidad.presupuesto_estimado && (
          <span><span className='text-muted-foreground'>Presupuesto estimado: </span>{oportunidad.presupuesto_estimado}</span>
        )}
        {oportunidad.fecha_limite && (
          <span><span className='text-muted-foreground'>Fecha límite: </span>{String(oportunidad.fecha_limite).slice(0, 10)}</span>
        )}
      </div>

      {resumen && <p className='whitespace-pre-wrap text-sm'>{resumen}</p>}
      {recomendacion && (
        <p className='rounded bg-muted/50 px-3 py-2 text-sm'>
          <span className='font-medium'>Recomendación: </span>{recomendacion}
        </p>
      )}
      {!resumen && !analizar.isPending && (
        <p className='text-xs text-muted-foreground'>
          Genera un resumen de la licitación, extrae los requisitos para participar y
          evalúa cuáles cumple la empresa según los documentos subidos en Configuración.
        </p>
      )}
    </section>
  )
}

// 2. Requisitos
function SeccionRequisitos({ oportunidad }: { oportunidad: Oportunidad }) {
  const analizar = useAnalizarOportunidad()
  const requisitosQ = useRequisitos(oportunidad.id)
  const requisitos = analizar.data?.requisitos ?? requisitosQ.data?.requisitos ?? []

  return (
    <section className='space-y-2 rounded-md border p-4'>
      <h4 className='text-sm font-semibold'>2. Requisitos</h4>
      {requisitos.length === 0 ? (
        <p className='text-sm text-muted-foreground'>
          Sin requisitos evaluados todavía. Use "Analizar oportunidad" arriba.
        </p>
      ) : (
        <div className='overflow-x-auto rounded border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-8' />
                <TableHead>Requisito</TableHead>
                <TableHead>Justificación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requisitos.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <span
                      title={REQUISITO_ESTADO_INFO[r.estado].label}
                      className={`inline-block h-2.5 w-2.5 rounded-full ${REQUISITO_ESTADO_INFO[r.estado].color}`}
                    />
                  </TableCell>
                  <TableCell className='text-sm'>{r.descripcion}</TableCell>
                  <TableCell className='text-xs text-muted-foreground'>{r.justificacion}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}

// 3. Productos/servicios (del scraper, sin IA) + recomendar precio (IA, bajo demanda) +
//    documentos faltantes (codigo puro)
function SeccionProductos({ oportunidad }: { oportunidad: Oportunidad }) {
  const productosQ = useProductos(oportunidad.id)
  const productos = productosQ.data?.productos ?? []
  const faltantes: DocumentoFaltante[] = oportunidad.documentos_faltantes ?? []

  return (
    <section className='space-y-3 rounded-md border p-4'>
      <h4 className='text-sm font-semibold'>3. Productos/servicios</h4>
      {productosQ.isLoading ? (
        <Skeleton className='h-16 w-full' />
      ) : productos.length === 0 ? (
        <p className='text-sm text-muted-foreground'>
          El scraper no encontró productos/servicios estructurados para esta licitación.
        </p>
      ) : (
        <ul className='space-y-2'>
          {productos.map((p) => (
            <ProductoItem key={p.id} producto={p} />
          ))}
        </ul>
      )}

      {faltantes.length > 0 && (
        <div className='space-y-1.5 rounded border border-destructive/30 bg-destructive/5 p-3'>
          <p className='text-sm font-medium'>Documentos faltantes</p>
          <ul className='space-y-1 text-sm'>
            {faltantes.map((f) => (
              <li key={f.tipo_documento} className='flex items-center gap-2'>
                <Badge variant='destructive' className='shrink-0'>{f.motivo}</Badge>
                {f.tipo_documento}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function ProductoItem({ producto: p }: { producto: Producto }) {
  const recomendar = useRecomendarPrecio()

  return (
    <li className='rounded border px-3 py-2 text-sm'>
      <div className='flex items-center justify-between gap-2'>
        <span>
          {p.descripcion}
          {p.cantidad && <span className='ml-1.5 text-xs text-muted-foreground'>(cant. {p.cantidad})</span>}
        </span>
        <Button
          type='button'
          size='sm'
          variant='ghost'
          className='h-7 gap-1.5 px-2 text-xs shrink-0'
          disabled={recomendar.isPending}
          onClick={() => recomendar.mutate(p.id, { onError: (e) => toast.error(e.message) })}
        >
          <Sparkles className='h-3.5 w-3.5' />
          {recomendar.isPending ? 'Buscando…' : 'Recomendar precio'}
        </Button>
      </div>
      {recomendar.data && (
        <div className='mt-2 space-y-1 rounded bg-muted/50 px-2 py-1.5 text-xs'>
          <p>
            <span className='font-medium'>Precio sugerido: </span>
            {recomendar.data.precio_sugerido ?? 'Sin suficiente historial'}
          </p>
          <p className='text-muted-foreground'>{recomendar.data.justificacion}</p>
          {recomendar.data.historial.length > 0 && (
            <ul className='text-muted-foreground'>
              {recomendar.data.historial.slice(0, 5).map((h, i) => (
                <li key={i}>
                  {h.descripcion} — {h.precio} ({String(h.fecha).slice(0, 10)})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}

// 4. Documentos de la licitacion
function SeccionDocumentos({ oportunidadId }: { oportunidadId: number }) {
  const documentosQ = useDocumentos(oportunidadId)

  return (
    <section className='space-y-2 rounded-md border p-4'>
      <h4 className='text-sm font-semibold'>4. Documentos de la licitación</h4>
      {documentosQ.isLoading ? (
        <Skeleton className='h-24 w-full' />
      ) : !documentosQ.data?.documentos.length ? (
        <p className='text-sm text-muted-foreground py-2'>
          No hay documentos descargados para esta oportunidad.
        </p>
      ) : (
        <ul className='space-y-2'>
          {documentosQ.data.documentos.map((d) => (
            <DocumentoItem key={d.id} documento={d} />
          ))}
        </ul>
      )}
    </section>
  )
}

function DocumentoItem({ documento: d }: { documento: Documento }) {
  const generarResumen = useGenerarResumenDocumento()

  return (
    <li className='rounded border px-3 py-2 text-sm'>
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2 min-w-0'>
          <FileText className='h-4 w-4 shrink-0 text-muted-foreground' />
          <span className='truncate'>{d.nombre_archivo}</span>
        </div>
        <div className='flex items-center gap-1 shrink-0'>
          <Badge variant={DOC_ESTADO_VARIANT[d.estado]}>
            {d.estado === 'ok' ? 'Descargado' : 'Error'}
          </Badge>
          {d.estado === 'ok' && (
            <Button size='sm' variant='ghost' asChild title='Descargar'>
              <a href={documentoDescargarUrl(d.id)} target='_blank' rel='noreferrer'>
                <Download className='h-4 w-4' />
              </a>
            </Button>
          )}
        </div>
      </div>
      <div className='mt-1 text-xs text-muted-foreground'>{d.tipo_documento || 'Sin tipo'}</div>
      {d.estado === 'error' && d.mensaje_error && (
        <p className='mt-1 text-xs text-destructive'>{d.mensaje_error}</p>
      )}
      {d.estado === 'ok' && (
        <div className='mt-2'>
          {d.resumen_ia ? (
            <p className='whitespace-pre-wrap rounded bg-muted/50 px-2 py-1.5 text-xs'>{d.resumen_ia}</p>
          ) : (
            <Button
              type='button'
              size='sm'
              variant='ghost'
              className='h-7 gap-1.5 px-2 text-xs'
              disabled={generarResumen.isPending}
              onClick={() =>
                generarResumen.mutate(d.id, { onError: (e) => toast.error(e.message) })
              }
            >
              <Sparkles className='h-3.5 w-3.5' />
              {generarResumen.isPending ? 'Generando resumen…' : 'Generar resumen con IA'}
            </Button>
          )}
        </div>
      )}
    </li>
  )
}
```

- [ ] **Step 2: Crear la ruta con parámetro**

```typescript
// frontend/src/routes/_authenticated/lic/oportunidades/$oportunidadId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { LicOportunidadDetalle } from '@/features/lic/lic-oportunidad-detalle'

export const Route = createFileRoute('/_authenticated/lic/oportunidades/$oportunidadId')({
  component: _Page,
})

function _Page() {
  const { oportunidadId } = Route.useParams()
  return <LicOportunidadDetalle oportunidadId={Number(oportunidadId)} />
}
```

- [ ] **Step 3: Verificación de tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores nuevos en los dos archivos creados (pueden persistir los errores
señalados en el Task 17 Step 3 hasta completar el Task 20).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/lic/lic-oportunidad-detalle.tsx frontend/src/routes/_authenticated/lic/oportunidades/\$oportunidadId.tsx
git commit -m "feat(lic): pagina de detalle de oportunidad con orden fijo de secciones"
```

### Task 20: Frontend — reemplazar el modal en `lic-oportunidades.tsx`

**Files:**
- Modify: `frontend/src/features/lic/lic-oportunidades.tsx`

- [ ] **Step 1: Quitar el estado/Dialog y navegar con `Link` en su lugar**

Reemplazar el archivo completo `frontend/src/features/lic/lic-oportunidades.tsx` con esta
versión (mismo contenido que el actual, menos: el import de `Dialog*`, el estado
`selectedOportunidad`, el bloque `<Dialog>...</Dialog>` del final, y las funciones
`AnalisisSeccion`/`DocumentoItem`/`CUMPLIMIENTO_INFO`/`REQUISITO_ESTADO_INFO`/
`DOC_ESTADO_VARIANT` que ya se movieron a `lic-oportunidad-detalle.tsx`; más: import de `Link`,
y la fila/botón "Eye" navegando en vez de abrir el modal):

```typescript
// Oportunidades descubiertas en el portal DGCP para la empresa activa: tabla filtrable
// por estado_portal + botón "Buscar ahora" que dispara un ScrapeJob y hace polling en
// vivo de su estado. Click en una fila navega al detalle en pagina completa
// (/lic/oportunidades/$oportunidadId) en vez de abrir un modal.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Eye, Loader2, Search, Settings } from 'lucide-react'
import { useCompany } from '@/hooks/use-company'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  LicApiError,
  useBuscarAhora,
  useOportunidades,
  useScrapeJobStatus,
} from './api'

const TODOS = 'Todos'

function formatDate(s: string | null): string {
  return s ? String(s).slice(0, 10) : ''
}

const CUMPLIMIENTO_INFO: Record<
  'verde' | 'amarillo' | 'rojo',
  { color: string; label: string; corto: string }
> = {
  verde: { color: 'bg-green-500', label: 'Cumple los requisitos evaluados', corto: 'Aplica' },
  amarillo: { color: 'bg-yellow-500', label: 'Cumple parcialmente', corto: 'Parcial' },
  rojo: { color: 'bg-red-500', label: 'No cumple / faltan documentos', corto: 'No aplica' },
}

function CumplimientoDot({ estado }: { estado: 'verde' | 'amarillo' | 'rojo' | null }) {
  if (!estado) {
    return (
      <span
        title='Sin analizar todavía'
        className='inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground/30'
      />
    )
  }
  const info = CUMPLIMIENTO_INFO[estado]
  return <span title={info.label} className={`inline-block h-2.5 w-2.5 rounded-full ${info.color}`} />
}

export function LicOportunidades() {
  const { selectedCompany } = useCompany()

  const [estado, setEstado] = useState(TODOS)
  const [todas, setTodas] = useState(false)
  const [job, setJob] = useState<{ jobId: number; company: string } | null>(null)

  const { data, isLoading, refetch } = useOportunidades(selectedCompany, undefined, todas)
  const buscarAhora = useBuscarAhora()
  const { data: jobStatus } = useScrapeJobStatus(job?.jobId ?? null)
  const esJobDeEstaEmpresa = job?.company === selectedCompany

  const oportunidades = data?.oportunidades ?? []

  const estadosDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const o of oportunidades) {
      if (o.estado_portal) set.add(o.estado_portal)
    }
    return Array.from(set).sort()
  }, [oportunidades])

  const rows = useMemo(
    () => (estado === TODOS ? oportunidades : oportunidades.filter((o) => o.estado_portal === estado)),
    [oportunidades, estado]
  )

  const lastHandledJobRef = useRef<number | null>(null)
  useEffect(() => {
    if (!job || !esJobDeEstaEmpresa || !jobStatus || jobStatus.estado === 'corriendo') return
    if (lastHandledJobRef.current === job.jobId) return
    lastHandledJobRef.current = job.jobId

    if (jobStatus.estado === 'completado') {
      refetch()
      toast.success(
        `Búsqueda completada: ${jobStatus.resumen.oportunidades_nuevas} oportunidad(es) nueva(s), ` +
          `${jobStatus.resumen.documentos_descargados} documento(s) descargado(s)`
      )
    } else if (jobStatus.estado === 'completado_con_errores') {
      refetch()
      toast.warning(
        `Búsqueda completada con ${jobStatus.resumen.errores.length} error(es). ` +
          `${jobStatus.resumen.oportunidades_nuevas} oportunidad(es) nueva(s).`
      )
    } else if (jobStatus.estado === 'error') {
      toast.error('La búsqueda terminó con error. Intente de nuevo más tarde.')
    }
  }, [job, esJobDeEstaEmpresa, jobStatus, refetch])

  const buscando = esJobDeEstaEmpresa && jobStatus?.estado === 'corriendo'

  const handleBuscarAhora = () => {
    const company = selectedCompany
    buscarAhora.mutate(company, {
      onSuccess: (res) => {
        setJob({ jobId: res.job_id, company })
        toast.info('Búsqueda iniciada en el portal DGCP')
      },
      onError: (e) => {
        if (e instanceof LicApiError && e.job_id) {
          setJob({ jobId: e.job_id, company })
          toast.info('Ya hay una búsqueda en curso para esta empresa. Mostrando su progreso.')
        } else {
          toast.error(e.message)
        }
      },
    })
  }

  return (
    <div className='space-y-4'>
      <div>
        <h3 className='text-base font-semibold'>Oportunidades</h3>
        <p className='text-sm text-muted-foreground'>
          Licitaciones descubiertas en el portal de Compras y Contrataciones (DGCP) para
          la empresa {selectedCompany}. Use "Buscar ahora" para forzar una corrida
          manual sin esperar al cron diario.
        </p>
      </div>

      <div className='flex flex-wrap items-end gap-3'>
        <div>
          <Label className='text-xs'>Estado en el portal</Label>
          <div className='flex flex-wrap gap-1.5'>
            <Button type='button' size='sm' variant={estado === TODOS ? 'default' : 'outline'} onClick={() => setEstado(TODOS)}>
              Todos
            </Button>
            {estadosDisponibles.map((e) => (
              <Button key={e} type='button' size='sm' variant={estado === e ? 'default' : 'outline'} onClick={() => setEstado(e)}>
                {e}
              </Button>
            ))}
          </div>
        </div>

        <Button disabled={buscando || buscarAhora.isPending} onClick={handleBuscarAhora}>
          {buscando || buscarAhora.isPending ? (
            <><Loader2 className='h-4 w-4 mr-1 animate-spin' /> Buscando…</>
          ) : (
            <><Search className='h-4 w-4 mr-1' /> Buscar ahora</>
          )}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button type='button' variant='outline' size='icon' title='Configurar búsqueda'>
              <Settings className='h-4 w-4' />
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-72 space-y-3' align='start'>
            <div>
              <p className='text-sm font-medium'>Parámetros de búsqueda</p>
              <p className='text-xs text-muted-foreground'>
                Ajustan qué se muestra de lo ya encontrado, no lo que el scraper busca en el portal.
              </p>
            </div>
            <div className='flex items-center justify-between gap-3'>
              <Label htmlFor='lic-todas' className='text-sm font-normal'>Incluir cerradas/vencidas</Label>
              <Switch id='lic-todas' checked={todas} onCheckedChange={setTodas} />
            </div>
          </PopoverContent>
        </Popover>

        <div className='ml-auto text-sm text-muted-foreground'>
          {rows.length} oportunidad{rows.length !== 1 ? 'es' : ''}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className='h-40 w-full' />
      ) : (
        <div className='rounded-md border overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-24' title='¿Aplica según el análisis de IA?'>Requisitos</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Entidad</TableHead>
                <TableHead>Título</TableHead>
                <TableHead className='w-28'>Fecha límite</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className='w-16 text-right'>Docs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => (
                <TableRow key={o.id} className='hover:bg-muted/50'>
                  <TableCell>
                    <Link to='/lic/oportunidades/$oportunidadId' params={{ oportunidadId: String(o.id) }} className='flex items-center gap-1.5 text-xs'>
                      <CumplimientoDot estado={o.estado_cumplimiento} />
                      {o.estado_cumplimiento ? CUMPLIMIENTO_INFO[o.estado_cumplimiento].corto : 'Sin analizar'}
                    </Link>
                  </TableCell>
                  <TableCell className='font-mono text-xs'>
                    <Link to='/lic/oportunidades/$oportunidadId' params={{ oportunidadId: String(o.id) }}>{o.referencia}</Link>
                  </TableCell>
                  <TableCell>{o.tipo_proceso}</TableCell>
                  <TableCell className='truncate max-w-[12rem]'>{o.entidad}</TableCell>
                  <TableCell className='truncate max-w-sm'>{o.titulo}</TableCell>
                  <TableCell>{formatDate(o.fecha_limite)}</TableCell>
                  <TableCell>
                    <Badge variant='outline'>{o.estado_portal || 'Sin estado'}</Badge>
                  </TableCell>
                  <TableCell className='text-right'>
                    <Button size='sm' variant='ghost' asChild title='Ver detalle'>
                      <Link to='/lic/oportunidades/$oportunidadId' params={{ oportunidadId: String(o.id) }}>
                        <Eye className='h-4 w-4' />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className='text-center text-muted-foreground py-6'>
                    {oportunidades.length === 0
                      ? 'No se han descubierto oportunidades para esta empresa todavía. Use "Buscar ahora" o espere al cron diario.'
                      : 'Ninguna oportunidad coincide con el estado seleccionado.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificación de tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Verificación manual en el navegador**

Run: `npm run dev`, navegar a `/lic/oportunidades`, hacer clic en una fila. Confirmar:
- Navega a `/lic/oportunidades/<id>` (no abre modal).
- El `Header` del layout LIC (título "Licitaciones (LIC)", ThemeSwitch, ProfileDropdown) sigue
  visible arriba mientras se ve el detalle.
- Las 4 secciones aparecen en orden: Descripción, Requisitos, Productos/servicios, Documentos.
- El botón de descarga de un documento de la licitación efectivamente baja el archivo.
- "Volver a Oportunidades" regresa a la lista.

Expected: los 5 puntos anteriores se cumplen.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/lic/lic-oportunidades.tsx
git commit -m "feat(lic): reemplazar modal de detalle por navegacion a pagina completa"
```

---

## Self-Review de este plan (incluye la corrección del 2026-07-24, segunda vuelta)

- **Cobertura del spec:** Parte A → Tasks 1-4 (descubrimiento vía Búsqueda avanzada). Parte B →
  Tasks 5-11 (catálogo de documentos). Parte C → Tasks 12-16, corregida: productos/servicios los
  extrae el SCRAPER por código (Task 15, dentro de `_extraer_detalle_aviso_contrato`), las
  comparaciones contra documentos siguen siendo código puro (`documentos_faltantes()`, Task 14,
  sin tocar el prompt de la IA), y el único uso de IA nuevo es recomendar precio (Task 16, Steps
  7-11) SOLO después de que una búsqueda de código (`buscar_precio_historico`) ya trajo el
  historial — la IA nunca busca ni compara por su cuenta. Parte D → Tasks 17-20, con la sección
  de productos (Task 19) leyendo de `useProductos` (scraper) en vez de `analizar.data?.productos`
  (que ya no existe), más el botón "Recomendar precio" por producto.
- **Placeholders:** ninguno, con una excepción documentada explícitamente (no un placeholder
  disimulado): el selector `#grdLineItemsListP2Gen` del Task 15 Step 1 es un best-effort no
  verificado en vivo (a diferencia del resto del scraper, que sí se verificó contra el portal
  real) — el propio Task 15 Step 1 instruye explícitamente verificarlo en vivo y ajustar antes de
  dar el paso por completo, con un criterio de fallback ya definido (lista vacía si no aplica).
  Esto es consistente con cómo ya se trató la incertidumbre del Task 2 (selectores de la Búsqueda
  avanzada) en el resto del plan.
- **Consistencia de tipos/firmas:** `guardar_analisis_oportunidad` gana el kwarg
  `documentos_faltantes` en el Task 13 y se usa con esa misma firma en el Task 15 Step 6;
  `documentos_faltantes()` recibe `(requisitos, tipos_catalogo, documentos_empresa)` igual en
  Tasks 14 y 15; `reemplazar_productos`/`list_productos` incluyen `cantidad` consistentemente
  desde el Task 12 (SQL) hasta el Task 19 (frontend); `DocumentoEmpresa.tipo_documento_id`/
  `tipo_documento_nombre` (Task 7 backend, Task 9 frontend) se usan consistentemente en
  `lic-documentos-empresa.tsx` (Task 11); `Oportunidad.documentos_faltantes` (Task 17) se llena
  en el Task 18 y se consume en el Task 19; `recomendar_precio(descripcion_producto, historial)`
  (Task 16 Step 8) se llama con esa misma firma desde `recomendar_precio_view` (Task 16 Step 9).
