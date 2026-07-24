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
