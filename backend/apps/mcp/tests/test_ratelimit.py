import time

from apps.mcp.ratelimit import RateLimiter


def test_allows_under_limit():
    rl = RateLimiter(limit_per_min=3, _now=lambda: 1000.0)
    assert rl.allow("t1") is True
    assert rl.allow("t1") is True
    assert rl.allow("t1") is True


def test_blocks_over_limit():
    rl = RateLimiter(limit_per_min=2, _now=lambda: 1000.0)
    rl.allow("t1"); rl.allow("t1")
    assert rl.allow("t1") is False


def test_resets_after_window():
    clock = {"t": 1000.0}
    rl = RateLimiter(limit_per_min=2, _now=lambda: clock["t"])
    rl.allow("t1"); rl.allow("t1")
    assert rl.allow("t1") is False
    clock["t"] = 1061.0
    assert rl.allow("t1") is True


def test_per_token_isolated():
    rl = RateLimiter(limit_per_min=1, _now=lambda: 1000.0)
    assert rl.allow("a")
    assert rl.allow("b")
    assert not rl.allow("a")
    assert not rl.allow("b")
