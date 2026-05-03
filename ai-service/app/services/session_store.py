from __future__ import annotations

import threading
import time
from typing import Dict, Optional

from app.models.session_schema import DiagnosisSession


class SessionStore:
    """Thread-safe in-memory session store with TTL eviction.

    Suitable for first iteration.  Swap to Redis / DB persistence
    when sessions need to survive process restarts.
    """

    def __init__(self, ttl_seconds: float = 3600.0, max_sessions: int = 10_000) -> None:
        self._sessions: Dict[str, DiagnosisSession] = {}
        self._timestamps: Dict[str, float] = {}
        self._lock = threading.Lock()
        self._ttl = ttl_seconds
        self._max = max_sessions

    def get(self, session_id: str) -> Optional[DiagnosisSession]:
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                return None
            ts = self._timestamps.get(session_id, 0)
            if time.monotonic() - ts > self._ttl:
                self._sessions.pop(session_id, None)
                self._timestamps.pop(session_id, None)
                return None
            return session.model_copy(deep=True)

    def put(self, session: DiagnosisSession) -> None:
        with self._lock:
            if len(self._sessions) >= self._max and session.session_id not in self._sessions:
                self._evict_oldest()
            self._sessions[session.session_id] = session.model_copy(deep=True)
            self._timestamps[session.session_id] = time.monotonic()

    def delete(self, session_id: str) -> bool:
        with self._lock:
            removed = self._sessions.pop(session_id, None)
            self._timestamps.pop(session_id, None)
            return removed is not None

    def _evict_oldest(self) -> None:
        if not self._timestamps:
            return
        oldest_key = min(self._timestamps, key=self._timestamps.get)
        self._sessions.pop(oldest_key, None)
        self._timestamps.pop(oldest_key, None)


diagnosis_session_store = SessionStore()
