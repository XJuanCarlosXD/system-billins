"""Middlewares del proyecto."""


class ApiCsrfExemptMiddleware:
    """Exime de la verificación CSRF a todos los endpoints /api/.

    El frontend corre en un dominio distinto al backend (Netlify vs hopto.org),
    por lo que la cookie ``csrftoken`` no es legible desde ``document.cookie``
    y todo POST/PATCH/DELETE moría con 403 "CSRF verification failed" en las
    vistas que no tenían ``@csrf_exempt`` (p.ej. inv_movimientos) y en todas
    las APIView de DRF (SessionAuthentication.enforce_csrf).

    Poner ANTES de ``django.middleware.csrf.CsrfViewMiddleware``. El flag
    ``_dont_enforce_csrf_checks`` lo respetan tanto CsrfViewMiddleware como el
    CSRFCheck interno de DRF.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/api/'):
            request._dont_enforce_csrf_checks = True
        return self.get_response(request)
