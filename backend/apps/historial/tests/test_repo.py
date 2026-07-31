from types import SimpleNamespace

from apps.historial import repo


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
        self._next_id = 501

    def var(self, _typ):
        return _FakeOutVar(self._next_id)

    def execute(self, sql, params=None):
        self.executed.append((sql, list(params or [])))

    @property
    def connection(self):
        def _commit():
            self.committed = True
        return SimpleNamespace(commit=_commit)


def test_log_evento_crear_inserta_cabecera_sin_detalle():
    cur = FakeCursor()
    repo.log_evento(
        cur, usuario="jcabreu", no_cia="01", punto="01", modulo="FAT",
        tipo_documento="FT", no_documento="0001234", accion="CREAR",
    )
    inserts = [sql for sql, _ in cur.executed if "INSERT INTO ABREGONZA.TSYS_BITACORA" in sql]
    assert len(inserts) == 1
    assert "TSYS_BITACORA_DETALLE" not in inserts[0]
    # log_evento NO hace commit: es responsabilidad del caller (misma transacción).
    assert cur.committed is False


def test_log_evento_usuario_se_normaliza_a_mayusculas():
    cur = FakeCursor()
    repo.log_evento(
        cur, usuario="jcabreu", no_cia="01", punto="01", modulo="FAT",
        tipo_documento="FT", no_documento="0001234", accion="CREAR",
    )
    _, params = cur.executed[0]
    assert "JCABREU" in params


def test_log_evento_editar_con_cambios_inserta_detalle_por_campo():
    cur = FakeCursor()
    repo.log_evento(
        cur, usuario="JCABREU", no_cia="01", punto="01", modulo="CXP",
        tipo_documento="FP", no_documento="0008347", accion="EDITAR",
        cambios=[
            {"campo": "ncf", "etiqueta": "NCF", "valor_anterior": "123", "valor_nuevo": "456"},
        ],
    )
    detalle_inserts = [sql for sql, _ in cur.executed if "INSERT INTO ABREGONZA.TSYS_BITACORA_DETALLE" in sql]
    assert len(detalle_inserts) == 1


def test_log_evento_editar_sin_cambios_no_inserta_nada():
    cur = FakeCursor()
    repo.log_evento(
        cur, usuario="JCABREU", no_cia="01", punto="01", modulo="CXP",
        tipo_documento="FP", no_documento="0008347", accion="EDITAR",
        cambios=[],
    )
    assert cur.executed == []


def test_log_evento_anular_persiste_motivo():
    cur = FakeCursor()
    repo.log_evento(
        cur, usuario="JCABREU", no_cia="01", punto="01", modulo="FAT",
        tipo_documento="FT", no_documento="0001234", accion="ANULAR",
        motivo="Factura duplicada",
    )
    _, params = cur.executed[0]
    assert "Factura duplicada" in params


def test_descripcion_crear():
    assert repo._descripcion("JCABREU", "CREAR", "FT", "0001234", 0) == \
        "JCABREU creó FT-0001234"


def test_descripcion_editar_con_n_campos():
    assert repo._descripcion("JCABREU", "EDITAR", "FP", "0008347", 3) == \
        "JCABREU editó FP-0008347 (3 campos)"


def test_descripcion_anular():
    assert repo._descripcion("JCABREU", "ANULAR", "FT", "0001234", 0) == \
        "JCABREU anuló FT-0001234"
