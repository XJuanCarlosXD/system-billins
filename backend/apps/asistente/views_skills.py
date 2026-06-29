from rest_framework.response import Response
from rest_framework.views import APIView


class SkillsListView(APIView):
    """GET (list frontmatter) + POST (create, solo DBA) /api/asistente/skills/

    Stub. Implementacion real en Task 14 (Step 6).
    """

    def get(self, request):
        return Response({"detail": "not_implemented"}, status=501)

    def post(self, request):
        return Response({"detail": "not_implemented"}, status=501)


class SkillDetailView(APIView):
    """GET / PUT / DELETE /api/asistente/skills/<name>/

    Stub. Implementacion real en Task 14 (Step 6). Gate DBA en mutaciones.
    """

    def get(self, request, name):
        return Response(
            {"detail": "not_implemented", "name": name},
            status=501,
        )

    def put(self, request, name):
        return Response(
            {"detail": "not_implemented", "name": name},
            status=501,
        )

    def delete(self, request, name):
        return Response(
            {"detail": "not_implemented", "name": name},
            status=501,
        )
