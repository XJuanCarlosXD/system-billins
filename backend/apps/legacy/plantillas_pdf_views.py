"""Endpoints REST para plantillas PDF editables.

Rutas:
  GET    /api/settings/plantillas-pdf/?no_cia=01
  GET    /api/settings/plantillas-pdf/<codigo_doc>/?no_cia=01
  PUT    /api/settings/plantillas-pdf/<codigo_doc>/
  DELETE /api/settings/plantillas-pdf/<codigo_doc>/       -> restaurar default
  GET    /api/settings/plantillas-pdf/<codigo_doc>/historial/
  POST   /api/settings/plantillas-pdf/<codigo_doc>/rollback/?version=N
"""
from __future__ import annotations

import json

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.legacy.repositories import plantillas_pdf_repo


@login_required
@require_http_methods(["GET"])
def plantillas_list(request):
    no_cia = request.GET.get('no_cia', '01')
    return JsonResponse({'results': plantillas_pdf_repo.list_plantillas(no_cia)})


@login_required
@csrf_exempt
@require_http_methods(["GET", "PUT", "DELETE"])
def plantilla_detail(request, codigo_doc: str):
    no_cia = request.GET.get('no_cia') or (
        json.loads(request.body or b'{}').get('no_cia') if request.method == 'PUT' else None
    ) or '01'

    if request.method == 'GET':
        p = plantillas_pdf_repo.get_plantilla(no_cia, codigo_doc)
        if p is None:
            return JsonResponse({'no_cia': no_cia, 'codigo_doc': codigo_doc,
                                 'nombre': codigo_doc, 'definicion_json': None,
                                 'page_size': 'A4', 'page_orientation': 'P',
                                 'activo': True, 'version': 0,
                                 'fecha_mod': None, 'usuario_mod': '',
                                 'personalizada': False})
        p['personalizada'] = p.get('definicion_json') is not None
        return JsonResponse(p)

    if request.method == 'PUT':
        try:
            payload = json.loads(request.body or b'{}')
        except json.JSONDecodeError:
            return JsonResponse({'error': 'JSON inválido'}, status=400)
        nombre = (payload.get('nombre') or codigo_doc).strip()
        definicion_json = payload.get('definicion_json')
        if isinstance(definicion_json, (dict, list)):
            definicion_json = json.dumps(definicion_json, ensure_ascii=False)
        page_size = (payload.get('page_size') or 'A4').upper()
        page_orientation = (payload.get('page_orientation') or 'P').upper()
        activo = bool(payload.get('activo', True))
        usuario = (request.user.username or '')[:30]
        p = plantillas_pdf_repo.upsert_plantilla(
            no_cia=no_cia, codigo_doc=codigo_doc, nombre=nombre,
            definicion_json=definicion_json,
            page_size=page_size, page_orientation=page_orientation,
            activo=activo, usuario=usuario)
        p['personalizada'] = p.get('definicion_json') is not None
        return JsonResponse(p)

    if request.method == 'DELETE':
        usuario = (request.user.username or '')[:30]
        p = plantillas_pdf_repo.restore_default(no_cia, codigo_doc, usuario=usuario)
        if p is None:
            return JsonResponse({'error': 'no existía plantilla personalizada'}, status=404)
        p['personalizada'] = p.get('definicion_json') is not None
        return JsonResponse(p)


@login_required
@require_http_methods(["GET"])
def plantilla_historial(request, codigo_doc: str):
    no_cia = request.GET.get('no_cia', '01')
    return JsonResponse({'results': plantillas_pdf_repo.list_historial(no_cia, codigo_doc)})


@login_required
@csrf_exempt
@require_http_methods(["POST"])
def plantilla_rollback(request, codigo_doc: str):
    no_cia = request.GET.get('no_cia', '01')
    try:
        version = int(request.GET.get('version') or '0')
    except ValueError:
        return JsonResponse({'error': 'version inválida'}, status=400)
    if version <= 0:
        return JsonResponse({'error': 'version requerida'}, status=400)
    usuario = (request.user.username or '')[:30]
    p = plantillas_pdf_repo.rollback_to(no_cia, codigo_doc, version, usuario=usuario)
    if p is None:
        return JsonResponse({'error': 'versión no encontrada'}, status=404)
    p['personalizada'] = p.get('definicion_json') is not None
    return JsonResponse(p)
