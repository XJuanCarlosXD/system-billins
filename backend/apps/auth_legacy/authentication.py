"""Auth class para DRF que no exige CSRF token.

Aplica a APIs SPA donde la sesión va por cookie HttpOnly + SameSite=Lax.
La protección CSRF se delega al SameSite del navegador.
"""
from rest_framework.authentication import SessionAuthentication


class CsrfExemptSessionAuthentication(SessionAuthentication):
    def enforce_csrf(self, request):
        # No-op: confiamos en SameSite=Lax + Origin trust list (CORS_ALLOWED_ORIGINS).
        return
