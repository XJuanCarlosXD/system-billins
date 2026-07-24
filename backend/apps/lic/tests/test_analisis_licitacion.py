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
