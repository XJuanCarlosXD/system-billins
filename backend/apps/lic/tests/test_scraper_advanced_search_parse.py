from apps.lic.services.scraper import (
    _normalizar_modalidad_entrega,
    parse_advanced_search_row_html,
    parse_productos_aviso_contrato_html,
)

FILA_HTML = """
<tr id="tblMainTable_..._grdResultList_tr0" class="gridLineLight">
  <td><span title="REPÚBLICA DOMINICANA">DO</span></td>
  <td>Instituto Nacional de formación Técnico Profesional</td>
  <td>INFOTEP-DAF-CD-2026-0889</td>
  <td>&#8220;Adquisición de equipos de enfermería para uso en Nueva Escuela Hotel Guarocuya&#34;</td>
  <td></td>
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


# Fixture basado en el HTML real capturado en vivo el 2026-07-24 contra
# AGN-DAF-CM-2025-0038 (pestaña "2. Artículos y Preguntas", widget FlatTree de
# Ariba) -- simplificado, sin los ids/atributos irrelevantes para el parseo.
TABLA_PRODUCTOS_HTML = """
<div class="FlatTree">
<table class="Flt">
  <tr class="FltTr QuestionnaireLine DivisionLine">
    <td class="FltRootContentTd"><span class="VortalSpan">Cuestionario</span></td>
  </tr>
  <tr class="FltTr QuestionnaireLine QuestionLine ComplexQuestionLine">
    <td class="FltContentTd">
      <table class="LineDescription"><tr>
        <td class="MainLineContentCell"><span class="VortalSpan">Acondicionadores de aires</span></td>
      </tr></table>
    </td>
  </tr>
  <tr class="FltTr QuestionnaireLine QuestionLine">
    <td class="FltContentTd">
      <table class="LineDescription"><tr>
        <td class="MainLineContentCell"><span class="VortalSpan">Servicio de instalación</span></td>
      </tr></table>
    </td>
  </tr>
</table>
</div>
"""


def test_parse_productos_aviso_contrato_html_extrae_filas():
    productos = parse_productos_aviso_contrato_html(TABLA_PRODUCTOS_HTML)
    assert productos == [
        {"descripcion": "Acondicionadores de aires", "cantidad": None},
        {"descripcion": "Servicio de instalación", "cantidad": None},
    ]


def test_parse_productos_aviso_contrato_html_ignora_filas_de_agrupacion():
    productos = parse_productos_aviso_contrato_html(TABLA_PRODUCTOS_HTML)
    assert not any(p["descripcion"] == "Cuestionario" for p in productos)


def test_parse_productos_aviso_contrato_html_sin_filas_da_lista_vacia():
    assert parse_productos_aviso_contrato_html("<div class='FlatTree'></div>") == []


def test_normalizar_modalidad_entrega_fisica():
    assert _normalizar_modalidad_entrega("Entrega física obligatoria") == "fisica"
    assert _normalizar_modalidad_entrega("Solo papel") == "fisica"


def test_normalizar_modalidad_entrega_virtual():
    assert _normalizar_modalidad_entrega("Entrega virtual (portal)") == "virtual"
    assert _normalizar_modalidad_entrega("Plataforma") == "virtual"


def test_normalizar_modalidad_entrega_ambas():
    assert _normalizar_modalidad_entrega("Física o virtual, a elección del oferente") == "ambas"
    # Texto real verificado en vivo el 2026-07-24 (AGN-DAF-CM-2025-0038,
    # #...spnDeliveryConditions): "Plataforma" = virtual, "papel" = física.
    assert _normalizar_modalidad_entrega("Plataforma y papel") == "ambas"


def test_normalizar_modalidad_entrega_desconocida_da_none():
    assert _normalizar_modalidad_entrega("") is None
    assert _normalizar_modalidad_entrega(None) is None
