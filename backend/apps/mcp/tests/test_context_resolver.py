import pytest

from apps.mcp.context_resolver import resolve_context
from apps.mcp.envelope import MCPError
from apps.mcp.tokens import TokenContext


def _tok(**kw):
    base = dict(
        token_id="t1", usuario="JCABREU",
        no_cia=None, bloquear_cia=False,
        punto=None, bloquear_punto=False,
        fecha_expira=None,
    )
    base.update(kw)
    return TokenContext(**base)


ACCESS = {
    "01": ["01", "02"],
    "02": ["01"],
}


def test_locked_cia_uses_token_value():
    ctx = _tok(no_cia="01", bloquear_cia=True, punto="01", bloquear_punto=True)
    out = resolve_context(ctx, arg_no_cia=None, arg_punto=None, access=ACCESS)
    assert out == ("01", "01")


def test_locked_cia_rejects_override():
    ctx = _tok(no_cia="01", bloquear_cia=True)
    with pytest.raises(MCPError) as exc:
        resolve_context(ctx, arg_no_cia="02", arg_punto=None, access=ACCESS)
    assert exc.value.code == "VALIDATION_ERROR"
    assert exc.value.detail["campo"] == "no_cia"


def test_arg_overrides_token_default():
    ctx = _tok(no_cia="01", bloquear_cia=False, punto="01", bloquear_punto=False)
    out = resolve_context(ctx, arg_no_cia="02", arg_punto="01", access=ACCESS)
    assert out == ("02", "01")


def test_token_default_used_when_no_arg():
    ctx = _tok(no_cia="01", punto="02")
    out = resolve_context(ctx, arg_no_cia=None, arg_punto=None, access=ACCESS)
    assert out == ("01", "02")


def test_single_access_used_as_default():
    ctx = _tok()
    out = resolve_context(ctx, arg_no_cia=None, arg_punto=None, access={"03": ["09"]})
    assert out == ("03", "09")


def test_missing_context_raises_with_options():
    ctx = _tok()
    with pytest.raises(MCPError) as exc:
        resolve_context(ctx, arg_no_cia=None, arg_punto=None, access=ACCESS)
    assert exc.value.code == "MISSING_CONTEXT"
    assert exc.value.detail["campo_faltante"] == "no_cia"
    assert "01" in [e["no_cia"] for e in exc.value.detail["empresas_disponibles"]]


def test_arg_cia_not_accessible_fails():
    ctx = _tok()
    with pytest.raises(MCPError) as exc:
        resolve_context(ctx, arg_no_cia="99", arg_punto=None, access=ACCESS)
    assert exc.value.code == "PERMISSION_DENIED"
