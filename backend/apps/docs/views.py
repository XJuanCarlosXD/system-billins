"""Servidor simple de documentación interna del proyecto.

Lee los .md de backend/docs/ (carpeta versionada con el código). Cualquiera
que se añada ahí queda automáticamente disponible en /api/docs/.
"""
from __future__ import annotations

import re
from pathlib import Path

from django.conf import settings
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

DOCS_DIR = Path(settings.BASE_DIR) / 'docs'

_SLUG_RE = re.compile(r'^[A-Za-z0-9_\-\.]+$')


def _list_md_files() -> list[Path]:
    if not DOCS_DIR.exists():
        return []
    return sorted(p for p in DOCS_DIR.glob('*.md'))


def _extract_title(content: str, fallback: str) -> str:
    for line in content.splitlines():
        s = line.strip()
        if s.startswith('# '):
            return s[2:].strip()
    return fallback


def _meta_for(path: Path) -> dict:
    try:
        content = path.read_text(encoding='utf-8')
    except Exception:
        content = ''
    title = _extract_title(content, path.stem)
    return {
        'slug': path.stem,
        'filename': path.name,
        'title': title,
        'size': path.stat().st_size,
    }


def _highlight(content: str, q: str, ctx: int = 60) -> list[dict]:
    """Devuelve hasta 5 fragmentos con el match resaltado por línea."""
    if not q:
        return []
    out: list[dict] = []
    needle = q.lower()
    for i, line in enumerate(content.splitlines(), start=1):
        idx = line.lower().find(needle)
        if idx == -1:
            continue
        start = max(0, idx - ctx)
        end = min(len(line), idx + len(q) + ctx)
        snippet = ('…' if start > 0 else '') + line[start:end] + ('…' if end < len(line) else '')
        out.append({'line': i, 'snippet': snippet})
        if len(out) >= 5:
            break
    return out


class DocsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        files = _list_md_files()
        items: list[dict] = []
        for p in files:
            meta = _meta_for(p)
            if q:
                content = p.read_text(encoding='utf-8')
                if q.lower() not in content.lower() and q.lower() not in meta['title'].lower():
                    continue
                meta['matches'] = _highlight(content, q)
            items.append(meta)
        return Response({'count': len(items), 'q': q, 'items': items})


class DocDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        if not _SLUG_RE.match(slug):
            return Response({'detail': 'slug inválido'}, status=status.HTTP_400_BAD_REQUEST)
        path = DOCS_DIR / f'{slug}.md'
        if not path.exists() or not path.is_file():
            return Response({'detail': 'no existe'}, status=status.HTTP_404_NOT_FOUND)
        content = path.read_text(encoding='utf-8')
        return Response({
            **_meta_for(path),
            'content': content,
        })
