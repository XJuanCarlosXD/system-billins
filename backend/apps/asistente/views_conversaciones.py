"""GET/POST /api/asistente/conversaciones/  +  GET/DELETE detail."""

import json
import uuid

from django.conf import settings
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.legacy import client


def _u(request) -> str:
    return (request.user.username or "").upper()


class ConversacionesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Oracle 11g no soporta FETCH FIRST -> envolver con ROWNUM.
        rows = client.fetch_dicts(
            "SELECT * FROM ("
            "  SELECT CONV_ID, TITULO, MODEL, SKILL_ACTIVA, "
            "         NO_CIA, PUNTO, FECHA_CREACION, FECHA_ULTIMO, "
            "         TOKENS_IN_TOT, TOKENS_OUT_TOT, COSTO_USD, ARCHIVADA "
            "  FROM ABREGONZA.TCHAT_CONVERSACION "
            "  WHERE UPPER(USUARIO) = :1 AND NVL(ARCHIVADA,'N') = 'N' "
            "  ORDER BY FECHA_ULTIMO DESC"
            ") WHERE ROWNUM <= 50",
            [_u(request)],
        )
        return Response({"items": rows})

    def post(self, request):
        body = request.data or {}
        conv_id = str(uuid.uuid4())
        no_cia = body.get("no_cia") or ""
        punto = body.get("punto") or ""
        titulo = (body.get("titulo") or "Nueva conversacion")[:200]
        # Modelo fijo: siempre el default del servidor (Haiku). El body ya
        # no puede variar el modelo.
        model = getattr(
            settings, "ASISTENTE_DEFAULT_MODEL", "claude-haiku-4-5"
        )

        with client.cursor() as cur:
            cur.execute(
                "INSERT INTO ABREGONZA.TCHAT_CONVERSACION "
                "(CONV_ID, USUARIO, NO_CIA, PUNTO, TITULO, MODEL, "
                " FECHA_CREACION, FECHA_ULTIMO, ARCHIVADA, "
                " TOKENS_IN_TOT, TOKENS_OUT_TOT, COSTO_USD) "
                "VALUES (:1, :2, :3, :4, :5, :6, SYSDATE, SYSDATE, "
                "        'N', 0, 0, 0)",
                [conv_id, _u(request), no_cia, punto, titulo, model],
            )
            cur.connection.commit()

        return Response(
            {"conv_id": conv_id, "titulo": titulo, "model": model},
            status=201,
        )


class ConversacionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, conv_id):
        head = client.fetch_dicts(
            "SELECT CONV_ID, USUARIO, TITULO, MODEL, SKILL_ACTIVA, "
            "       NO_CIA, PUNTO, FECHA_CREACION, FECHA_ULTIMO, "
            "       TOKENS_IN_TOT, TOKENS_OUT_TOT, COSTO_USD "
            "FROM ABREGONZA.TCHAT_CONVERSACION "
            "WHERE CONV_ID = :1 AND UPPER(USUARIO) = :2",
            [conv_id, _u(request)],
        )
        if not head:
            return Response({"detail": "not_found"}, status=404)

        # CLOBs leidos dentro del cursor: fuera la conexion ya volvio al pool
        # y lob.read() lanza DPY-1001.
        rows = []
        with client.cursor() as cur:
            cur.execute(
                "SELECT MENSAJE_ID, SEQ, ROLE, CONTENIDO, TOOL_CALLS_JSON, "
                "       TOOL_CALL_ID, TOKENS_IN, TOKENS_OUT, COSTO_USD, "
                "       FECHA_CREACION "
                "FROM ABREGONZA.TCHAT_MENSAJE "
                "WHERE CONV_ID = :1 ORDER BY SEQ",
                [conv_id],
            )
            cols = [c[0].lower() for c in cur.description]
            for row in cur.fetchall():
                r = dict(zip(cols, row))
                if hasattr(r.get("contenido"), "read"):
                    r["contenido"] = r["contenido"].read()
                if hasattr(r.get("tool_calls_json"), "read"):
                    r["tool_calls_json"] = r["tool_calls_json"].read()
                rows.append(r)
        messages = []
        for r in rows:
            contenido = r.get("contenido")
            tcj = r.get("tool_calls_json")
            messages.append({
                "mensaje_id": r["mensaje_id"],
                "seq": int(r["seq"]),
                "role": r["role"],
                "contenido": str(contenido) if contenido else "",
                "tool_calls": (
                    json.loads(str(tcj)) if tcj else None
                ),
                "tool_call_id": r.get("tool_call_id"),
                "tokens_in": int(r.get("tokens_in") or 0),
                "tokens_out": int(r.get("tokens_out") or 0),
                "fecha": r.get("fecha_creacion"),
            })
        return Response({"conversacion": head[0], "messages": messages})

    def delete(self, request, conv_id):
        with client.cursor() as cur:
            cur.execute(
                "UPDATE ABREGONZA.TCHAT_CONVERSACION "
                "SET ARCHIVADA = 'S', FECHA_ULTIMO = SYSDATE "
                "WHERE CONV_ID = :1 AND UPPER(USUARIO) = :2",
                [conv_id, _u(request)],
            )
            cur.connection.commit()
        return Response({"ok": True})

    def patch(self, request, conv_id):
        body = request.data or {}
        fields = []
        params = []
        if "titulo" in body:
            fields.append("TITULO = :{}".format(len(params) + 1))
            params.append(str(body["titulo"])[:200])
        if "skill_activa" in body:
            val = body["skill_activa"]
            fields.append("SKILL_ACTIVA = :{}".format(len(params) + 1))
            params.append(str(val)[:64] if val else None)
        if not fields:
            return Response({"detail": "no_fields"}, status=400)
        fields.append("FECHA_ULTIMO = SYSDATE")
        params.append(conv_id)
        params.append(_u(request))
        with client.cursor() as cur:
            cur.execute(
                "UPDATE ABREGONZA.TCHAT_CONVERSACION SET "
                + ", ".join(fields)
                + " WHERE CONV_ID = :{} AND UPPER(USUARIO) = :{}".format(
                    len(params) - 1, len(params)
                ),
                params,
            )
            if cur.rowcount == 0:
                return Response({"detail": "not_found"}, status=404)
            cur.connection.commit()
        return Response({"ok": True})
