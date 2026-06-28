"""Sliding-window in-memory rate limiter (process-local). 60 calls/min default."""
import time
from collections import deque
from threading import Lock
from typing import Callable, Optional


class RateLimiter:
    def __init__(self, limit_per_min: int = 60, _now: Optional[Callable] = None):
        self.limit = limit_per_min
        self._now = _now or time.time
        self._windows: dict = {}
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        now = self._now()
        cutoff = now - 60.0
        with self._lock:
            q = self._windows.setdefault(key, deque())
            while q and q[0] < cutoff:
                q.popleft()
            if len(q) >= self.limit:
                return False
            q.append(now)
            return True


_global: Optional[RateLimiter] = None


def get_limiter() -> RateLimiter:
    global _global
    if _global is None:
        from django.conf import settings
        _global = RateLimiter(limit_per_min=getattr(settings, "MCP_RATELIMIT_PER_MIN", 60))
    return _global
