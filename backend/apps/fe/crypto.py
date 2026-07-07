"""Cifrado simétrico del password del certificado digital.

Deriva una clave Fernet estable desde settings.SECRET_KEY para no
introducir secretos nuevos en el despliegue.
"""
from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet
from django.conf import settings


def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()
