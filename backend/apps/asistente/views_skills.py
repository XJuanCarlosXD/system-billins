"""Endpoints REST para skills del asistente.

GET  /api/asistente/skills/           — lista filtrada por modulos del user.
POST /api/asistente/skills/           — crea SKILL.md (solo DBA).
GET  /api/asistente/skills/<name>/    — frontmatter + body completo (gateado).
PUT  /api/asistente/skills/<name>/    — actualiza body (solo DBA).
DELETE /api/asistente/skills/<name>/  — elimina el directorio (solo DBA).
"""

from __future__ import annotations

import asyncio
import os
import re
import shutil

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.asistente.tools import skills as skills_mod


_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9\-_]{0,63}$")


def _is_dba(user) -> bool:
    from apps.legacy.repositories import users_repo

    username = getattr(user, "username", "") or ""
    return bool(users_repo.is_dba(username))


def _safe_name(name: str) -> bool:
    return bool(_NAME_RE.match(name or ""))


class SkillsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        res = asyncio.run(skills_mod._skill_listar(user=request.user))
        return Response(res)

    def post(self, request):
        if not _is_dba(request.user):
            return Response({"detail": "forbidden"}, status=403)

        name = (request.data.get("name") or "").strip()
        body = request.data.get("body") or ""
        if not _safe_name(name):
            return Response(
                {"detail": "invalid_name",
                 "hint": "use [a-z0-9-_], max 64 chars, lowercase"},
                status=400,
            )
        target_dir = os.path.join(skills_mod.SKILLS_DIR, name)
        if os.path.exists(target_dir):
            return Response({"detail": "exists", "name": name}, status=409)
        os.makedirs(target_dir, exist_ok=True)
        with open(
            os.path.join(target_dir, "SKILL.md"), "w", encoding="utf-8",
        ) as fh:
            fh.write(body)
        return Response({"ok": True, "name": name}, status=201)


class SkillDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, name):
        if not _safe_name(name):
            return Response({"detail": "invalid_name"}, status=400)
        sk = skills_mod.read_skill_file(name)
        if not sk:
            return Response({"detail": "not_found"}, status=404)
        return Response({
            "name": sk["name"],
            "description": sk["description"],
            "modules_required": sk["modules_required"],
            "tools_used": sk["tools_used"],
            "body": sk["body"],
            "frontmatter": sk["frontmatter"],
        })

    def put(self, request, name):
        if not _is_dba(request.user):
            return Response({"detail": "forbidden"}, status=403)
        if not _safe_name(name):
            return Response({"detail": "invalid_name"}, status=400)
        body = request.data.get("body")
        if body is None:
            return Response({"detail": "body_required"}, status=400)
        target_dir = os.path.join(skills_mod.SKILLS_DIR, name)
        if not os.path.isdir(target_dir):
            return Response({"detail": "not_found"}, status=404)
        with open(
            os.path.join(target_dir, "SKILL.md"), "w", encoding="utf-8",
        ) as fh:
            fh.write(body)
        return Response({"ok": True, "name": name})

    def delete(self, request, name):
        if not _is_dba(request.user):
            return Response({"detail": "forbidden"}, status=403)
        if not _safe_name(name):
            return Response({"detail": "invalid_name"}, status=400)
        target_dir = os.path.join(skills_mod.SKILLS_DIR, name)
        if not os.path.isdir(target_dir):
            return Response({"detail": "not_found"}, status=404)
        shutil.rmtree(target_dir)
        return Response({"ok": True, "name": name})
