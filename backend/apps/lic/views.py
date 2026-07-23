"""Vistas planas (sin DRF), mismo estilo que apps/fe/views.py."""
import json
import logging
import threading
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.fe import crypto
from apps.legacy.repositories import lic_repo
from apps.lic.models import ScrapeJob
from apps.lic.services import pdf_rubros
from apps.lic.services.orchestrator import ejecutar_scrape
from apps.lic.services.scraper import LicitacionesScraper, LoginError

logger = logging.getLogger(__name__)

# Umbral de antigüedad para la guardia de concurrencia de scrape_view: un ScrapeJob
# "corriendo" más viejo que esto se trata como abandonado/huérfano en vez de bloquear
# nuevos intentos. El contenedor backend corre `uvicorn --reload`, así que un deploy
# rutinario (o cualquier reinicio) mientras un scrape está a mitad de camino manda
# SIGTERM/SIGKILL al worker y el hilo muere sin llegar al bloque que marca
# estado="error" -- sin este umbral esa fila quedaría bloqueando ese alcance para
# siempre. 60 minutos es un techo generoso: un scrape completo para todas las
# empresas no debería legítimamente tardar tanto.
SCRAPE_JOB_STALE_MINUTES = 60


def _err(msg: str, status: int = 400) -> JsonResponse:
    return JsonResponse({"error": msg}, status=status)


def _parse_json_body(request):
    """Parsea el body JSON de la request. Retorna (data, None) o (None, JsonResponse-error)."""
    try:
        return json.loads(request.body or b"{}"), None
    except json.JSONDecodeError:
        return None, _err("JSON inválido")


def _ejecutar_scrape_seguro(job: ScrapeJob, empresas: list[str]) -> None:
    """Wrapper de `ejecutar_scrape` usado como target del hilo de fondo de scrape_view.

    Mismo problema que resuelve el comando `scrape_licitaciones` (Task 8): si
    `ejecutar_scrape` deja escapar una excepción no prevista, su bloque final que fija
    `job.resumen/estado/terminado_en` nunca corre y el ScrapeJob queda atascado en
    "corriendo" para siempre -- lo cual, combinado con la guardia de concurrencia de
    `scrape_view`, bloquearía permanentemente cualquier intento futuro de scrape para
    esa empresa/alcance. A diferencia del comando de cron, este helper corre en un
    hilo daemon en segundo plano: un `raise` aquí no llegaría a ningún manejador útil
    (el hilo simplemente termina y nadie se entera), así que se registra la excepción
    vía logging en vez de relanzarla.
    """
    try:
        ejecutar_scrape(job, empresas)
    except Exception:  # noqa: BLE001
        logger.exception("ejecutar_scrape falló inesperadamente para el job %s", job.id)
        job.estado = "error"
        job.terminado_en = timezone.now()
        job.save()


@login_required
@csrf_exempt
@require_http_methods(["GET", "POST"])
def credenciales_view(request):
    if request.method == "GET":
        return JsonResponse({"credenciales": lic_repo.list_credenciales()})

    data, err = _parse_json_body(request)
    if err:
        return err
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
    data, err = _parse_json_body(request)
    if err:
        return err
    no_cia = data.get("no_cia")
    credencial = lic_repo.get_credencial_con_password(no_cia)
    if not credencial:
        return _err("No hay credencial configurada para esta empresa", status=404)

    try:
        password = crypto.decrypt(credencial["password_cifrado"])
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
    if ruta_archivo.exists():
        # Evita pisar un archivo cuyo nombre coincide con uno ya subido para esta
        # empresa -- un TLIC_RUBRO_PDF anterior todavía puede apuntar a esa ruta.
        disambiguador = timezone.now().strftime("%Y%m%d%H%M%S%f")
        ruta_archivo = destino / f"{ruta_archivo.stem}_{disambiguador}{ruta_archivo.suffix}"
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
        # 400, no 500: la causa típica es un PDF inválido/escaneado sin OCR provisto
        # por el usuario, no una falla del servidor.
        return _err(f"Error al extraer rubros: {exc}", status=400)

    return JsonResponse({"rubros": lic_repo.list_rubros(no_cia)})


@login_required
@require_http_methods(["GET"])
def oportunidades_view(request):
    no_cia = request.GET.get("no_cia")
    estado = request.GET.get("estado")
    if not no_cia:
        return _err("no_cia es requerido")
    # TODO: paginate if volume grows
    return JsonResponse({"oportunidades": lic_repo.list_oportunidades(no_cia, estado)})


@login_required
@require_http_methods(["GET"])
def documentos_view(request, oportunidad_id: int):
    return JsonResponse({"documentos": lic_repo.list_documentos(oportunidad_id)})


@login_required
@csrf_exempt
@require_http_methods(["POST"])
def scrape_view(request):
    data, err = _parse_json_body(request)
    if err:
        return err
    no_cia = data.get("no_cia")

    # Guardia de concurrencia: un ScrapeJob "corriendo" para TODAS las empresas
    # (no_cia=None) se solapa con cualquier empresa específica, y viceversa un
    # disparo para "todas" se solapa con cualquier corrida específica ya activa.
    # Sin esto, un "Buscar ahora" manual disparado mientras el cron diario (u otro
    # manual) ya está corriendo para la misma empresa haría login duplicado contra
    # el portal y escribiría sobre las mismas filas de Oracle a la vez.
    #
    # Se excluyen los jobs "corriendo" más viejos que SCRAPE_JOB_STALE_MINUTES: el
    # contenedor corre `uvicorn --reload`, así que un deploy (o cualquier reinicio)
    # a mitad de un scrape mata el hilo sin que llegue a marcar estado="error" --
    # sin este corte, esa fila huérfana bloquearía ese alcance para siempre.
    cutoff = timezone.now() - timedelta(minutes=SCRAPE_JOB_STALE_MINUTES)
    jobs_activos = ScrapeJob.objects.filter(estado="corriendo", iniciado_en__gte=cutoff)
    if no_cia:
        job_en_curso = jobs_activos.filter(Q(no_cia=no_cia) | Q(no_cia=None)).first()
    else:
        job_en_curso = jobs_activos.first()

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
    thread = threading.Thread(target=_ejecutar_scrape_seguro, args=(job, empresas), daemon=True)
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
