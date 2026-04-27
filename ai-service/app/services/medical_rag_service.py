from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Iterable

from app.models.rag_schema import MedicalRagResult
from app.services.medical_embedding_service import MedicalEmbeddingService, MedicalEmbeddingServiceError
from app.services.medical_knowledge_loader import MedicalKnowledgeLoader, MedicalKnowledgeLoaderError
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

    @property
    def is_ready(self) -> bool:
        return self.vector_store.is_ready

    def initialize(self) -> None:
        with self._lock:
            if self._initialized and self.vector_store.is_ready:
                return

            try:
                logger.info("Initializing medical RAG service with knowledge_dirs=%s", self.knowledge_dirs)
                chunks = self.loader.load_chunks()
                embeddings = self.embedding_service.embed_texts([chunk.text for chunk in chunks])
                self.vector_store.build(embeddings, chunks)
                self._initialized = True
                self._initialization_error = None
                logger.info("Medical RAG index ready chunks=%s dimension=%s", len(chunks), embeddings.shape[1])
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


medical_rag_service = MedicalRagService()
