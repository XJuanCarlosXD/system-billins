"""Vistas planas (sin DRF), mismo estilo que apps/fe/views.py."""
import json
import threading
from pathlib import Path

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.fe import crypto
from apps.legacy.repositories import lic_repo
from apps.lic.models import ScrapeJob
from apps.lic.services import pdf_rubros
from apps.lic.services.orchestrator import ejecutar_scrape


def _err(msg: str, status: int = 400) -> JsonResponse:
    return JsonResponse({"error": msg}, status=status)


@login_required
@csrf_exempt
@require_http_methods(["GET", "POST"])
def credenciales_view(request):
    if request.method == "GET":
        return JsonResponse({"credenciales": lic_repo.list_credenciales()})

    data = json.loads(request.body or b"{}")
    no_cia = data.get("no_cia")
    usuario = data.get("usuario_portal")
    password = data.get("password")
    if not no_cia or not usuario or not password:
        return _err("no_cia, usuario_portal y password son requeridos")
    lic_repo.upsert_credencial(no_cia, usuario, crypto.encrypt(password))
    return JsonResponse({"credencial": lic_repo.get_credencial(no_cia)})


@login_required
@csrf_exempt
@require_http_methods(["POST"])
def probar_conexion_view(request):
    from apps.lic.services.scraper import LicitacionesScraper, LoginError

    data = json.loads(request.body or b"{}")
    no_cia = data.get("no_cia")
    credencial = lic_repo.get_credencial_con_password(no_cia)
    if not credencial:
        return _err("No hay credencial configurada para esta empresa", status=404)

    password = crypto.decrypt(credencial["password_cifrado"])
    try:
        with LicitacionesScraper() as scraper:
            scraper.login(credencial["usuario_portal"], password)
        lic_repo.marcar_login_resultado(no_cia, ok=True)
        return JsonResponse({"ok": True})
    except LoginError as exc:
        lic_repo.marcar_login_resultado(no_cia, ok=False, mensaje_error=str(exc))
        return _err(str(exc), status=401)


@login_required
@csrf_exempt
@require_http_methods(["GET", "POST"])
def rubros_pdf_view(request):
    if request.method == "GET":
        no_cia = request.GET.get("no_cia")
        if not no_cia:
            return _err("no_cia es requerido")
        return JsonResponse({"rubros": lic_repo.list_rubros(no_cia)})

    no_cia = request.POST.get("no_cia")
    archivo = request.FILES.get("archivo")
    if not no_cia or not archivo:
        return _err("no_cia y archivo son requeridos")

    destino = Path(settings.MEDIA_ROOT) / "lic" / no_cia / "rubros"
    destino.mkdir(parents=True, exist_ok=True)
    ruta_archivo = destino / archivo.name
    with open(ruta_archivo, "wb") as f:
        for chunk in archivo.chunks():
            f.write(chunk)

    rubro_pdf_id = lic_repo.guardar_rubro_pdf(no_cia, archivo.name, str(ruta_archivo))
    try:
        texto = pdf_rubros.extraer_texto_pdf(str(ruta_archivo))
        rubros = pdf_rubros.structurar_rubros_desde_texto(texto)
        lic_repo.guardar_rubros(rubro_pdf_id, rubros)
        lic_repo.marcar_extraccion_rubros(rubro_pdf_id, "hecho")
    except Exception as exc:  # noqa: BLE001
        lic_repo.marcar_extraccion_rubros(rubro_pdf_id, "error", str(exc))
        return _err(f"Error al extraer rubros: {exc}", status=500)

    return JsonResponse({"rubros": lic_repo.list_rubros(no_cia)})


@login_required
@require_http_methods(["GET"])
def oportunidades_view(request):
    no_cia = request.GET.get("no_cia")
    estado = request.GET.get("estado")
    if not no_cia:
        return _err("no_cia es requerido")
    return JsonResponse({"oportunidades": lic_repo.list_oportunidades(no_cia, estado)})


@login_required
@require_http_methods(["GET"])
def documentos_view(request, oportunidad_id: int):
    return JsonResponse({"documentos": lic_repo.list_documentos(oportunidad_id)})


@login_required
@csrf_exempt
@require_http_methods(["POST"])
def scrape_view(request):
    data = json.loads(request.body or b"{}")
    no_cia = data.get("no_cia")

    # Guardia de concurrencia: un ScrapeJob "corriendo" para TODAS las empresas
    # (no_cia=None) se solapa con cualquier empresa específica, y viceversa un
    # disparo para "todas" se solapa con cualquier corrida específica ya activa.
    # Sin esto, un "Buscar ahora" manual disparado mientras el cron diario (u otro
    # manual) ya está corriendo para la misma empresa haría login duplicado contra
    # el portal y escribiría sobre las mismas filas de Oracle a la vez.
    if no_cia:
        job_en_curso = (
            ScrapeJob.objects.filter(estado="corriendo")
            .filter(Q(no_cia=no_cia) | Q(no_cia=None))
            .first()
        )
    else:
        job_en_curso = ScrapeJob.objects.filter(estado="corriendo").first()

    if job_en_curso:
        return JsonResponse(
            {
                "error": "Ya hay una corrida de scraping en curso que cubre esta empresa",
                "job_id": job_en_curso.id,
            },
            status=409,
        )

    empresas = [no_cia] if no_cia else [
        c["no_cia"] for c in lic_repo.list_credenciales() if c["estado"] == "activo"
    ]
    if not empresas:
        return _err("No hay empresas con credencial activa")

    job = ScrapeJob.objects.create(trigger="manual", no_cia=no_cia)
    thread = threading.Thread(target=ejecutar_scrape, args=(job, empresas), daemon=True)
    thread.start()
    return JsonResponse({"job_id": job.id})


@login_required
@require_http_methods(["GET"])
def scrape_job_view(request, job_id: int):
    try:
        job = ScrapeJob.objects.get(id=job_id)
    except ScrapeJob.DoesNotExist:
        return _err("Job no encontrado", status=404)
    return JsonResponse({
        "id": job.id,
        "estado": job.estado,
        "iniciado_en": job.iniciado_en.isoformat(),
        "terminado_en": job.terminado_en.isoformat() if job.terminado_en else None,
        "resumen": job.resumen,
    })
