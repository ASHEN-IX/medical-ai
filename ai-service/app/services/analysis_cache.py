from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Generic, Hashable, TypeVar


T = TypeVar("T")


@dataclass(slots=True)
class _CacheEntry(Generic[T]):
    value: T
    expires_at: float


class TimedCache(Generic[T]):
    def __init__(self, ttl_seconds: float = 300.0, maxsize: int = 256) -> None:
        self.ttl_seconds = float(ttl_seconds)
        self.maxsize = int(maxsize)
        self._lock = threading.RLock()
        self._store: dict[Hashable, _CacheEntry[T]] = {}

    def get(self, key: Hashable) -> T | None:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None

            if entry.expires_at <= time.monotonic():
                self._store.pop(key, None)
                return None

            return entry.value

    def set(self, key: Hashable, value: T) -> None:
        with self._lock:
            self._prune_expired()
            if len(self._store) >= self.maxsize:
                oldest_key = next(iter(self._store), None)
                if oldest_key is not None:
                    self._store.pop(oldest_key, None)

            self._store[key] = _CacheEntry(value=value, expires_at=time.monotonic() + self.ttl_seconds)

    def _prune_expired(self) -> None:
        now = time.monotonic()
        expired = [key for key, entry in self._store.items() if entry.expires_at <= now]
        for key in expired:
            self._store.pop(key, None)
