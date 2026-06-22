from unittest.mock import patch

from apps.mcp.audit import log_usage


def test_log_usage_inserts_row():
    with patch("apps.mcp.audit.oracle.execute") as exe:
        log_usage(
            token_id="t1", tool="fat_listar_facturas",
            params_hash="abc", ip="1.2.3.4",
            ok=True, error_code=None, duration_ms=42,
        )
        assert exe.called
        sql, params = exe.call_args[0]
        assert "INSERT INTO ABREGONZA.TMCP_TOKEN_USO" in sql
        assert params[0] == "t1"
        assert params[1] == "fat_listar_facturas"
        assert params[2] == "abc"
        assert params[4] == "S"
