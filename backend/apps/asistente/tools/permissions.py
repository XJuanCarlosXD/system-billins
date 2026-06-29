"""Permission gates del asistente.

Capa 1 (registry): se aplica en tools.registry.list_for_user a partir de
`get_user_module_flags(user)`.

Capas 2-4 (no_cia / punto / USUARIOD) se aplican en agent_loop.dispatch_tool
para cada llamada concreta.
"""

from __future__ import annotations


def _username(user) -> str:
    """Devuelve el USUARIO legacy (mayusculas) sea cual sea el objeto user."""
    if user is None:
        return ""
    name = getattr(user, "username", None) or str(user)
    return name.upper()


def get_user_module_flags(user) -> dict[str, str]:
    """{modulo: 'S'} para los modulos en los que el usuario tiene al menos
    un (no_cia, punto) con `activo='S'`. Modulos sin acceso: ausentes.

    Reusa `apps.legacy.repositories.permissions_repo.list_user_modules`.
    """
    from apps.legacy.repositories import permissions_repo

    rows = permissions_repo.list_user_modules(_username(user))
    flags: dict[str, str] = {}
    for r in rows:
        if r.get("activo"):
            flags[r["modulo"]] = "S"
    return flags


def user_has_cia(user, no_cia: str) -> bool:
    """True si el usuario tiene algun modulo activo en `no_cia`."""
    if not no_cia:
        return True
    from apps.legacy.repositories import permissions_repo

    rows = permissions_repo.list_user_modules(_username(user))
    return any(r["no_cia"] == no_cia and r.get("activo") for r in rows)


def user_has_punto(user, no_cia: str, punto: str) -> bool:
    """True si el usuario tiene algun modulo activo en (no_cia, punto)."""
    if not (no_cia and punto):
        return True
    from apps.legacy.repositories import permissions_repo

    rows = permissions_repo.list_user_modules(_username(user))
    return any(
        r["no_cia"] == no_cia and r["punto"] == punto and r.get("activo")
        for r in rows
    )


def user_can_doc(
    user, modulo: str, no_cia: str, punto: str, tipo_docu: str, accion: str = "lectura"
) -> bool:
    """USUARIOD gate: el usuario tiene asignado el tipo de documento en el
    modulo + (no_cia, punto). `accion` se ignora por ahora (TODO finer-grained).
    """
    if not (modulo and no_cia and punto and tipo_docu):
        return True
    from apps.legacy.repositories import permissions_repo

    try:
        rows = permissions_repo.list_user_doc_perms(
            _username(user), modulo, no_cia, punto
        )
    except Exception:
        return False
    return any((r.get("tipo_docu") or "").upper() == tipo_docu.upper() for r in rows)
