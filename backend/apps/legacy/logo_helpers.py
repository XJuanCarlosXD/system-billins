"""Helpers para resolver el logo de una empresa a un path absoluto en disco.

Logos se suben via apps.cnt.views.CiaHeaderView (POST /api/cnt/cia-header/)
y se guardan en MEDIA_ROOT/logos/<no_cia>.<ext>. Esta utilidad busca el
archivo por cualquier extension soportada y devuelve el Path o None.

Uso desde generadores reportlab:

    from apps.legacy.logo_helpers import get_logo_path
    path = get_logo_path(no_cia)
    if path:
        from reportlab.platypus import Image
        elements.append(Image(str(path), width=80, height=40, kind='proportional'))
"""
from __future__ import annotations

from pathlib import Path

from django.conf import settings


_EXTS = ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg')


def get_logo_dir() -> Path:
    return Path(getattr(settings, 'MEDIA_ROOT', '/app/media')) / 'logos'


def get_logo_path(no_cia: str) -> Path | None:
    """Devuelve el path absoluto del logo de la empresa, o None si no existe.

    Busca por cualquier extension soportada en MEDIA_ROOT/logos/<no_cia>.<ext>.
    SVG NO se incluye porque reportlab no lo soporta nativamente.
    """
    if not no_cia:
        return None
    base = get_logo_dir() / str(no_cia)
    for ext in _EXTS:
        if ext == '.svg':
            continue
        p = base.with_suffix(ext)
        if p.exists():
            return p
    return None
