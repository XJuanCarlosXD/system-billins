from types import SimpleNamespace

from rest_framework.test import APIClient

from apps.reportes import repo


class _FakeOutVar:
    """Simula el objeto que devuelve oracledb `cur.var(...)`: expone
    `getvalue()` como lo hace el driver real tras un RETURNING ... INTO."""

    def __init__(self, value):
        self._value = value

    def getvalue(self):
        return [self._value]


class FakeCursor:
    def __init__(self):
        self.executed: list[tuple[str, list]] = []
        self.committed = False
        self._next_id = 777

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return None

    def var(self, _typ):
        return _FakeOutVar(self._next_id)

    def execute(self, sql, params=None):
        self.executed.append((sql, list(params or [])))

    @property
    def connection(self):
        def _commit():
            self.committed = True
        return SimpleNamespace(commit=_commit)


def test_log_error_inserta_fila(monkeypatch):
    cur = FakeCursor()
    monkeypatch.setattr("apps.legacy.client.cursor", lambda: cur)
    error_id = repo.log_error(
        usuario="JCABREU", modulo="FAT", url="/fat/nueva-factura",
        status_http=500, mensaje="Internal Server Error", detalle="Traceback...",
    )
    assert error_id == 777
    inserts = [sql for sql, _ in cur.executed if "INSERT INTO ABREGONZA.TSYS_ERROR_LOG" in sql]
    assert len(inserts) == 1


def test_log_error_endpoint_siempre_devuelve_201_aunque_falle_el_insert(monkeypatch, mock_user):
    monkeypatch.setattr(repo, "log_error_ticket", lambda **kw: (_ for _ in ()).throw(RuntimeError("db down")))
    client = APIClient()
    client.force_authenticate(mock_user)
    resp = client.post("/api/reportes/error-log/", {
        "mensaje": "Network Error", "url": "/cxp/documentos", "status_http": 0, "modulo": "CXP",
    }, format="json")
    # Best-effort: nunca debe romper la experiencia del usuario por un log que falla.
    assert resp.status_code == 201


def test_log_error_endpoint_ok(monkeypatch, mock_user):
    monkeypatch.setattr(repo, "log_error_ticket", lambda **kw: {"error_id": 42, "reporte_id": "r-1"})
    client = APIClient()
    client.force_authenticate(mock_user)
    resp = client.post("/api/reportes/error-log/", {
        "mensaje": "404 not found", "url": "/inv/productos", "status_http": 404, "modulo": "INV",
    }, format="json")
    assert resp.status_code == 201
    assert resp.json() == {"error_id": 42, "reporte_id": "r-1"}


def test_log_error_ticket_crea_reporte_vinculado(monkeypatch):
    monkeypatch.setattr(repo, "log_error", lambda **kw: 99)
    calls = {}

    def fake_create_reporte(**kw):
        calls.update(kw)
        return "reporte-abc"

    monkeypatch.setattr(repo, "create_reporte", fake_create_reporte)
    result = repo.log_error_ticket(
        usuario="JCABREU", modulo="CXP", url="/cxp/proveedores",
        status_http=500, mensaje="ORA-01400: cannot insert NULL", detalle="Traceback...",
    )
    assert result == {"error_id": 99, "reporte_id": "reporte-abc"}
    assert calls["error_log_id"] == 99
    assert calls["usuario"] == "JCABREU"
    assert "Error automático" in calls["titulo"]


def test_create_reporte_vincula_error_log_id(monkeypatch):
    calls = {}

    def fake_vincular(error_log_id, reporte_id):
        calls["error_log_id"] = error_log_id
        calls["reporte_id"] = reporte_id

    monkeypatch.setattr(repo, "vincular_reporte", fake_vincular)
    monkeypatch.setattr(repo, "_validar_imagenes", lambda imgs: [])

    class FakeCur:
        def __enter__(self): return self
        def __exit__(self, *a): return None
        def execute(self, sql, params=None): pass
        @property
        def connection(self):
            return SimpleNamespace(commit=lambda: None)

    monkeypatch.setattr("apps.legacy.client.cursor", lambda: FakeCur())

    repo.create_reporte(
        usuario="JCABREU", modulo="FAT", titulo="Error automático: 500",
        descripcion="detalle", imagenes=[], error_log_id=42,
    )
    assert calls["error_log_id"] == 42
