from apps.lic.services.scraper import parse_oportunidad_row_html

SAMPLE_ROW_HTML = '''
<div class="ws_rc_wrapper ws_rc_wrapper_opportunity" onclick="javascript:getAction('/DO1BusinessLine/Tendering/OpportunityDossierWorkspace/SelectOpportunityDossier' + '?' + 'OpportunityDossierUId=' + 'DO1.OPDOS.5660234' + '&amp;mkey=90a02203_fe0e_4b8b_b145_7a6513e8ae4d',true);selectWSElement(this);" align="left">
  <div class="ws_rc_topLeft" style="width:60%;" align="left">
    <span class="ws_rc_reference ws_ellipsis" title="HPDEF-DAF-CM-2026-0021">HPDEF-DAF-CM-2026-0021</span>
  </div>
  <div class="ws_rc_topRight ws_ellipsis" align="left">
    <span class="ws_rc_state ws_rc_opportunityDossierActive" title="SELECCIÓN">SELECCIÓN</span>
    <span class="ws_rc_businessOperationLabel ws_ellipsis" title="Contratación Menor">Contratación Menor</span>
  </div>
  <div class="ws_rc_topLeft" style="width:80%" align="left">
    <span class="ws_rc_description ws_ellipsis" title="ADQUISICION DE AIRE ACONDICIONADO, TV E IMPRESORA">ADQUISICION DE AIRE ACONDICIONADO, TV E IMPRESORA</span>
    <span class="ws_rc_description ws_ellipsis" title="DO,  | Hospital Provincial Dr. Elio Fiallo">DO,  | Hospital Provincial Dr. Elio Fiallo</span>
  </div>
  <div class="ws_rc_replyCounter" title="Ofertas presentadas " align="left"><span class="VortalSpan">0</span></div>
  <div class="ws_rc_replyCounter ws_rc_replyCounter_opportunity" title="Ofertas creadas" align="left"><span class="VortalSpan">1</span></div>
  <div class="ws_rc_datesContainer" align="left">
    <span class="ws_rc_dateLabel">Fecha límite:</span><span class="ws_rc_date">28/07/2026 11:00&nbsp;</span>
    <span class="ws_rc_dateLabel">Publicado:</span><span class="ws_rc_date">21/07/2026 14:40</span>
  </div>
</div>
'''


def test_parse_oportunidad_row_extracts_all_fields():
    result = parse_oportunidad_row_html(SAMPLE_ROW_HTML)
    assert result == {
        "referencia": "HPDEF-DAF-CM-2026-0021",
        "opportunity_uid": "DO1.OPDOS.5660234",
        "estado_portal": "SELECCIÓN",
        "tipo_proceso": "Contratación Menor",
        "titulo": "ADQUISICION DE AIRE ACONDICIONADO, TV E IMPRESORA",
        "entidad": "Hospital Provincial Dr. Elio Fiallo",
        "ofertas_presentadas": 0,
        "ofertas_creadas": 1,
        "fecha_limite": "2026-07-28 11:00",
        "fecha_publicacion": "2026-07-21 14:40",
    }
