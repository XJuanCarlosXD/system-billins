from apps.lic.services.scraper import parse_documento_row_html, parse_oportunidad_row_html

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


# Fila real capturada en vivo el 2026-07-22 de la tabla #grdGridDocumentList_tbl
# ("Documentos del Proceso") en el Aviso de Contrato de la oportunidad
# AGN-DAF-CM-2025-0038 (con las credenciales de abregonza).
SAMPLE_DOCUMENTO_ROW_HTML = '''
<tr id="grdGridDocumentList_tr0" class="gridLineLight"><td id="grdGridDocumentList_tdCheck" class="GridSelectionCell"><input id="grdGridDocumentList_chkCheck_0" onclick="javascript:$('#grdGridDocumentList_chkCheck_0_hdn').val(this.checked);;" type="checkbox"><input id="grdGridDocumentList_chkCheck_0_hdn" name="grdGridDocumentList_chkCheck" type="hidden" value="false"><input id="grdGridDocumentList_tdCheck_0_chkCheck_hdfRowValue" name="grdGridDocumentList_hdfRowValue" type="hidden" value="11362792"></td><td id="grdGridDocumentListtd_thColumnDocumentName"><span id="tdColumnDocumentNameP2Gen_spnDocumentName_0" class="VortalSpan">1 - Solicitud de Compras - copia.pdf</span></td><td id="grdGridDocumentListtd_thColumnDocumentDescription"><span id="tdColumnDocumentDescriptionP2Gen_spnDocumentDescription_0" class="VortalSpan">1 - Solicitud de Compras - copia.pdf</span></td><td id="grdGridDocumentListtd_thColumnDocumentIsPaid" style="display:none"></td><td id="grdGridDocumentListtd_thColumnDocumentType"><span id="spnColumnDocumentTypeSpan_0" class="VortalSpan">Solicitud Compra o Contratación</span></td><td id="grdGridDocumentListtd_thColumnDownloadDocument"><a id="lnkDownloadLinkP3Gen_0" title="Descargar" onclick="javascript:getAction('/DO1BusinessLine/Tendering/ContractNoticeView/DownloadFile' + '?' + 'documentId=' + '11362792' + '&amp;mkey=133cca02_285b_4f8a_8c31_83b76d62a81f',true);" name="lnkDownloadLinkP3Gen_0" href="javascript:void(0);">Descargar</a></td><td id="grdGridDocumentListtd_thColumnDetailDocument"><a id="lnkDetailLinkP3Gen_0" title="Detalle" onclick="javascript:$.popupWindow({windowURL: '/DO1BusinessLine/Documents/DocumentDisplay/Index' + '?' + 'id=' + '11362792' + '&amp;' + 'inCommunity=' + 'True' + '&amp;' + 'showEdit=' + 'False' + '&amp;' + 'processCodeBuyer=' + 'DO1.PPI.6282723' + '&amp;' + 'processCodeSupplier=' + '' + '&amp;asPopupView=true&amp;CallBackUrl=/DO1BusinessLine/Tendering/ContractNoticeView/RefreshContracts?mkey=133cca02_285b_4f8a_8c31_83b76d62a81f', scrollbars: 1, fullscreen: 0, resizable: 1, windowName: 'DisplayDocuemnt', centerScreen:1}); " name="lnkDetailLinkP3Gen_0" href="javascript:void(0);">Detalle</a></td></tr>
'''


def test_parse_documento_row_extracts_nombre_tipo_y_document_id():
    result = parse_documento_row_html(SAMPLE_DOCUMENTO_ROW_HTML)
    assert result == {
        "nombre_archivo": "1 - Solicitud de Compras - copia.pdf",
        "tipo_documento": "Solicitud Compra o Contratación",
        "document_id": "11362792",
    }
