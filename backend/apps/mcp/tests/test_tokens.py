import hashlib
import re

import pytest

from apps.mcp import tokens


def test_generate_token_format():
    plaintext, prefijo = tokens.generate_token_plaintext()
    assert re.fullmatch(r"mcp_[a-zA-Z0-9]{8}_[a-zA-Z0-9]{32}", plaintext)
    assert plaintext.startswith(f"mcp_{prefijo}_")
    assert len(prefijo) == 8


def test_hash_token_is_sha256_hex():
    h = tokens.hash_token("mcp_abcdefgh_" + "X" * 32)
    assert re.fullmatch(r"[0-9a-f]{64}", h)
    expected = hashlib.sha256(("mcp_abcdefgh_" + "X" * 32).encode()).hexdigest()
    assert h == expected


def test_extract_prefix():
    assert tokens.extract_prefix("mcp_abcdefgh_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz") == "abcdefgh"


def test_extract_prefix_invalid_returns_none():
    assert tokens.extract_prefix("not-a-token") is None
    assert tokens.extract_prefix("") is None
