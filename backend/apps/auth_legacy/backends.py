"""Auth backend Django: valida credenciales contra Oracle nativo del legado.

Si Oracle autentica al usuario, hacemos JIT provisioning del Django User
(SQLite local) para que tenga sesión / permisos Django. La password de
Django nunca guarda nada útil — siempre validamos contra Oracle.
"""
from __future__ import annotations

import logging

from django.contrib.auth.backends import BaseBackend
from django.contrib.auth.models import User

from apps.legacy import client as legacy_client
from apps.legacy.repositories import users_repo

logger = logging.getLogger(__name__)


class LegacyOracleAuthBackend(BaseBackend):
    """Autentica con `oracledb.connect(user, password)` contra Oracle 11g."""

    def authenticate(self, request, username: str | None = None, password: str | None = None, **kwargs):
        if not username or not password:
            return None
        username_norm = username.strip().upper()

        if not users_repo.exists(username_norm):
            logger.info('legacy auth: user %s does not exist in Oracle', username_norm)
            return None

        try:
            ok = legacy_client.authenticate_oracle_user(username_norm, password)
        except Exception:
            logger.exception('legacy auth: oracledb.connect raised for %s', username_norm)
            return None
        if not ok:
            logger.info('legacy auth: ORA-01017 for %s', username_norm)
            return None

        user, created = User.objects.get_or_create(
            username=username_norm,
            defaults={
                'is_staff': False,
                'is_active': True,
            },
        )
        if created:
            # password Django no usable — todo pasa por Oracle.
            user.set_unusable_password()
            user.save(update_fields=['password'])
            logger.info('legacy auth: JIT-provisioned Django user %s', username_norm)
        return user

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
