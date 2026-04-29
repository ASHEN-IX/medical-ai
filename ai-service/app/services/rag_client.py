from __future__ import annotations

from typing import Iterable

from app.services.analysis_cache import TimedCache
from app.services.medical_rag_service import MedicalRagService, MedicalRagServiceError, medical_rag_service


class RAGClientError(RuntimeError):
    pass


class RAGClient:
    def __init__(self, service: MedicalRagService | None = None, ttl_seconds: float = 300.0) -> None:
        self.service = service or medical_rag_service
        self._cache: TimedCache[list[str]] = TimedCache(ttl_seconds=ttl_seconds, maxsize=256)

    def retrieve_context(self, query: str, top_k: int = 3) -> list[str]:
        normalized_query = " ".join(str(query or "").split()).strip().lower()
        cache_key = (normalized_query, int(top_k))
        cached = self._cache.get(cache_key)
        if cached is not None:
            return list(cached)

        try:
            hits = self.service.retrieve(query, top_k)
        except MedicalRagServiceError as exc:
            raise RAGClientError(str(exc)) from exc

        context = [f"{hit.disease} | {hit.type} | {hit.text}" for hit in hits]
        self._cache.set(cache_key, context)
        return list(context)
