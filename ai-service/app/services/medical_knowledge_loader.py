from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from app.models.rag_schema import MedicalKnowledgeDocumentInput


logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class MedicalKnowledgeChunk:
    chunk_id: str
    chunk_type: str
    text: str
    disease: str
    source_file: str


class MedicalKnowledgeLoaderError(ValueError):
    pass


class MedicalKnowledgeLoader:
    def __init__(self, knowledge_dirs: Iterable[Path | str]) -> None:
        self.knowledge_dirs = [Path(directory) for directory in knowledge_dirs]

    def load_chunks(self) -> list[MedicalKnowledgeChunk]:
        json_files = self._discover_json_files()
        if not json_files:
            raise MedicalKnowledgeLoaderError(
                f"No medical knowledge JSON files were found in: {', '.join(str(path) for path in self.knowledge_dirs)}"
            )

        chunks: list[MedicalKnowledgeChunk] = []
        for json_file in json_files:
            document = self._load_document(json_file)
            for index, chunk in enumerate(document.chunks, start=1):
                chunk_id = chunk.id or self._build_fallback_chunk_id(document.disease, index)
                chunks.append(
                    MedicalKnowledgeChunk(
                        chunk_id=chunk_id,
                        chunk_type=chunk.type,
                        text=chunk.text,
                        disease=document.disease,
                        source_file=str(json_file),
                    )
                )

        logger.info(
            "Loaded medical knowledge chunks count=%s files=%s",
            len(chunks),
            len(json_files),
        )
        return chunks

    def _discover_json_files(self) -> list[Path]:
        discovered_files: list[Path] = []
        seen_paths: set[Path] = set()

        for directory in self.knowledge_dirs:
            if not directory.exists() or not directory.is_dir():
                continue

            for json_file in sorted(directory.rglob("*.json")):
                if json_file in seen_paths:
                    continue
                seen_paths.add(json_file)
                discovered_files.append(json_file)

        return discovered_files

    def _load_document(self, json_file: Path) -> MedicalKnowledgeDocumentInput:
        try:
            raw_payload = json.loads(json_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise MedicalKnowledgeLoaderError(f"Invalid JSON in {json_file}") from exc
        except OSError as exc:
            raise MedicalKnowledgeLoaderError(f"Unable to read medical knowledge file {json_file}") from exc

        try:
            return MedicalKnowledgeDocumentInput.model_validate(raw_payload)
        except Exception as exc:  # pylint: disable=broad-except
            raise MedicalKnowledgeLoaderError(f"Schema validation failed for {json_file}") from exc

    def _build_fallback_chunk_id(self, disease: str, index: int) -> str:
        safe_disease = disease.strip().lower().replace(" ", "_")
        return f"{safe_disease}_{index}"
