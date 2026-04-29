from __future__ import annotations

from typing import Iterable

from app.knowledge_graph.kg_schema import KnowledgeGraphContext
from app.knowledge_graph.kg_service import KnowledgeGraphService, KnowledgeGraphServiceError, knowledge_graph_service
from app.services.analysis_cache import TimedCache


class KGClientError(RuntimeError):
    pass


class KGClient:
    def __init__(self, service: KnowledgeGraphService | None = None, ttl_seconds: float = 300.0) -> None:
        self.service = service or knowledge_graph_service
        self._cache: TimedCache[KnowledgeGraphContext] = TimedCache(ttl_seconds=ttl_seconds, maxsize=256)

    def get_context_for_models(self, model_names: Iterable[str]) -> KnowledgeGraphContext:
        normalized_models = tuple(sorted({str(model_name).strip().lower() for model_name in model_names if str(model_name).strip()}))
        cached = self._cache.get(normalized_models)
        if cached is not None:
            return cached.model_copy(deep=True)

        try:
            context = self.service.get_context_for_models(normalized_models)
        except KnowledgeGraphServiceError as exc:
            raise KGClientError(str(exc)) from exc

        self._cache.set(normalized_models, context)
        return context.model_copy(deep=True)
