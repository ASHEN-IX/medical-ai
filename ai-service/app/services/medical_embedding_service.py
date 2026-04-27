from __future__ import annotations

import logging
from functools import lru_cache
from typing import Sequence

import numpy as np


logger = logging.getLogger(__name__)


class MedicalEmbeddingServiceError(RuntimeError):
    pass


class MedicalEmbeddingService:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2") -> None:
        self.model_name = model_name

    @lru_cache(maxsize=1)
    def _load_model(self):
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:
            raise MedicalEmbeddingServiceError(
                "sentence-transformers is not installed. Add the package to the service environment."
            ) from exc

        logger.info("Loading SentenceTransformer model=%s", self.model_name)
        return SentenceTransformer(self.model_name)

    def embed_texts(self, texts: Sequence[str]) -> np.ndarray:
        if not texts:
            raise MedicalEmbeddingServiceError("No texts provided for embedding")

        model = self._load_model()
        embeddings = model.encode(
            list(texts),
            batch_size=32,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return np.asarray(embeddings, dtype=np.float32)

    def embed_query(self, query: str) -> np.ndarray:
        cleaned_query = query.strip()
        if not cleaned_query:
            raise MedicalEmbeddingServiceError("Query cannot be empty")

        embeddings = self.embed_texts([cleaned_query])
        return embeddings[0]
