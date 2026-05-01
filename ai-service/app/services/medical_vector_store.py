from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Sequence

import numpy as np

from app.services.medical_knowledge_loader import MedicalKnowledgeChunk

try:
    import faiss
except ImportError:  # pragma: no cover - depends on optional runtime package
    faiss = None


@dataclass(frozen=True, slots=True)
class MedicalVectorHit:
    chunk_id: str
    chunk_type: str
    text: str
    disease: str
    score: float


class MedicalVectorStoreError(RuntimeError):
    pass


class MedicalVectorStore:
    def __init__(self) -> None:
        self._index: Any | None = None
        self._chunks: list[MedicalKnowledgeChunk] = []
        self._dimension: int | None = None

    @property
    def is_ready(self) -> bool:
        return self._index is not None and bool(self._chunks)

    def build(self, embeddings: np.ndarray, chunks: Sequence[MedicalKnowledgeChunk]) -> None:
        if faiss is None:
            raise MedicalVectorStoreError("FAISS dependency is not installed")

        if embeddings.size == 0:
            raise MedicalVectorStoreError("Cannot build FAISS index without embeddings")

        if len(chunks) != embeddings.shape[0]:
            raise MedicalVectorStoreError("Embedding count does not match chunk count")

        self._dimension = int(embeddings.shape[1])
        index = faiss.IndexFlatIP(self._dimension)
        index.add(np.ascontiguousarray(embeddings, dtype=np.float32))

        self._index = index
        self._chunks = list(chunks)

    def search(self, query_embedding: np.ndarray, top_k: int) -> list[MedicalVectorHit]:
        if not self.is_ready or self._index is None:
            raise MedicalVectorStoreError("FAISS index has not been built")

        if top_k <= 0:
            raise MedicalVectorStoreError("top_k must be greater than zero")

        query_vector = np.ascontiguousarray(query_embedding, dtype=np.float32).reshape(1, -1)
        scores, indices = self._index.search(query_vector, min(top_k, len(self._chunks)))

        hits: list[MedicalVectorHit] = []
        for score, index in zip(scores[0], indices[0], strict=False):
            if index < 0:
                continue

            chunk = self._chunks[int(index)]
            hits.append(
                MedicalVectorHit(
                    chunk_id=chunk.chunk_id,
                    chunk_type=chunk.chunk_type,
                    text=chunk.text,
                    disease=chunk.disease,
                    score=float(score),
                )
            )

        return hits
