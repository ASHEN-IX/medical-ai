from __future__ import annotations

import logging
import threading
import re
from pathlib import Path
from typing import Iterable

from app.models.rag_schema import MedicalRagResult
from app.services.medical_embedding_service import MedicalEmbeddingService, MedicalEmbeddingServiceError
from app.services.medical_knowledge_loader import (
    MedicalKnowledgeChunk,
    MedicalKnowledgeLoader,
    MedicalKnowledgeLoaderError,
)
from app.services.medical_vector_store import MedicalVectorStore, MedicalVectorStoreError


logger = logging.getLogger(__name__)


class MedicalRagServiceError(RuntimeError):
    pass


class MedicalRagServiceNotReadyError(MedicalRagServiceError):
    pass


class MedicalRagService:
    def __init__(
        self,
        knowledge_dirs: Iterable[Path | str] | None = None,
        embedding_service: MedicalEmbeddingService | None = None,
        vector_store: MedicalVectorStore | None = None,
    ) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        default_dirs = [Path("/data/medical"), repo_root / "data" / "medical"]
        self.knowledge_dirs = list(knowledge_dirs) if knowledge_dirs is not None else default_dirs
        self.embedding_service = embedding_service or MedicalEmbeddingService()
        self.vector_store = vector_store or MedicalVectorStore()
        self.loader = MedicalKnowledgeLoader(self.knowledge_dirs)
        self._lock = threading.RLock()
        self._initialized = False
        self._initialization_error: str | None = None
        self._fallback_chunks: list[MedicalKnowledgeChunk] = []

    @property
    def is_ready(self) -> bool:
        return self.vector_store.is_ready or bool(self._fallback_chunks)

    def initialize(self) -> None:
        with self._lock:
            if self._initialized and self.vector_store.is_ready:
                return

            try:
                logger.info("Initializing medical RAG service with knowledge_dirs=%s", self.knowledge_dirs)
                chunks = self.loader.load_chunks()
                try:
                    embeddings = self.embedding_service.embed_texts([chunk.text for chunk in chunks])
                    self.vector_store.build(embeddings, chunks)
                    self._fallback_chunks = []
                    logger.info("Medical RAG index ready chunks=%s dimension=%s", len(chunks), embeddings.shape[1])
                except Exception as exc:  # pylint: disable=broad-except
                    self._fallback_chunks = list(chunks)
                    self._initialization_error = str(exc)
                    logger.warning("Medical RAG semantic index unavailable; using lexical fallback: %s", exc)

                self._initialized = True
                self._initialization_error = None if self.vector_store.is_ready else self._initialization_error
            except (MedicalKnowledgeLoaderError, MedicalEmbeddingServiceError, MedicalVectorStoreError) as exc:
                self._initialized = False
                self._initialization_error = str(exc)
                logger.exception("Failed to initialize medical RAG service")
                raise MedicalRagServiceError(str(exc)) from exc

    def retrieve(self, query: str, top_k: int = 3) -> list[MedicalRagResult]:
        if not self.is_ready:
            try:
                self.initialize()
            except MedicalRagServiceError as exc:
                raise MedicalRagServiceNotReadyError(str(exc)) from exc

        if not self.vector_store.is_ready:
            if self._fallback_chunks:
                return self._retrieve_fallback(query, top_k)

            message = self._initialization_error or "Medical RAG service is not ready"
            raise MedicalRagServiceNotReadyError(message)

        try:
            query_embedding = self.embedding_service.embed_query(query)
            hits = self.vector_store.search(query_embedding, top_k)
        except (MedicalEmbeddingServiceError, MedicalVectorStoreError, MedicalKnowledgeLoaderError) as exc:
            raise MedicalRagServiceError(str(exc)) from exc

        return [
            MedicalRagResult(type=hit.chunk_type, text=hit.text, disease=hit.disease)
            for hit in hits
        ]

    def _retrieve_fallback(self, query: str, top_k: int) -> list[MedicalRagResult]:
        query_terms = set(self._tokenize(query))
        scored_chunks: list[tuple[int, MedicalKnowledgeChunk]] = []

        for chunk in self._fallback_chunks:
            chunk_terms = set(self._tokenize(f"{chunk.disease} {chunk.chunk_type} {chunk.text}"))
            score = len(query_terms.intersection(chunk_terms))
            if score == 0 and query_terms:
                if any(term in chunk.text.lower() for term in query_terms):
                    score = 1
            scored_chunks.append((score, chunk))

        scored_chunks.sort(key=lambda item: (item[0], item[1].disease, item[1].chunk_type), reverse=True)
        selected = [chunk for score, chunk in scored_chunks if score > 0][:top_k]
        if not selected:
            selected = [chunk for _, chunk in scored_chunks[:top_k]]

        return [MedicalRagResult(type=chunk.chunk_type, text=chunk.text, disease=chunk.disease) for chunk in selected]

    def _tokenize(self, text: str) -> list[str]:
        return [token for token in re.split(r"[^a-zA-Z0-9]+", text.lower()) if len(token) > 2]


medical_rag_service = MedicalRagService()
