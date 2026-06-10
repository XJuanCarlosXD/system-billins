"""Mantenimiento de manuales (MAN) — vistas HTTP."""
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from apps.legacy.repositories import man_repo


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def man_manuales(request):
    return JsonResponse(man_repo.list_manuales(), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def man_csc(request):
    return JsonResponse(man_repo.list_csc(), safe=False)
