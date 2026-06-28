from unittest.mock import patch

import pytest

from apps.mcp.auth import authenticate_bearer, AuthError
from apps.mcp.tokens import TokenContext


def _ctx():
    return TokenContext(
        token_id="t1", usuario="JCABREU",
        no_cia="01", bloquear_cia=False,
        punto="01", bloquear_punto=False,
        fecha_expira=None,
    )


def test_authenticate_returns_context_for_valid_bearer():
    with patch("apps.mcp.auth.lookup_token", return_value=_ctx()) as lk, \
         patch("apps.mcp.auth.touch_token") as touch:
        ctx = authenticate_bearer("Bearer mcp_abcdefgh_" + "X" * 32, ip="1.2.3.4")
    assert ctx.token_id == "t1"
    lk.assert_called_once()
    touch.assert_called_once_with("t1", "1.2.3.4")


def test_missing_header_raises():
    with pytest.raises(AuthError) as exc:
        authenticate_bearer(None, ip=None)
    assert exc.value.code == "MISSING_AUTH"


def test_wrong_scheme_raises():
    with pytest.raises(AuthError) as exc:
        authenticate_bearer("Basic abc", ip=None)
    assert exc.value.code == "MISSING_AUTH"


def test_invalid_token_raises():
    with patch("apps.mcp.auth.lookup_token", return_value=None):
        with pytest.raises(AuthError) as exc:
            authenticate_bearer("Bearer mcp_zzzzzzzz_" + "Y" * 32, ip=None)
    assert exc.value.code == "INVALID_TOKEN"
