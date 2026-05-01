from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from app.knowledge_graph.kg_builder import (
    KnowledgeGraphBuilderError,
    KnowledgeGraphSeed,
    build_knowledge_graph_from_directory,
)
from app.knowledge_graph.kg_schema import KnowledgeGraphContext, KnowledgeGraphProfile
from app.knowledge_graph.neo4j_driver import Neo4jDriverManager
from app.knowledge_graph.kg_queries import GET_FULL_PROFILE_QUERY, GET_RELATION_QUERY


logger = logging.getLogger(__name__)


MODEL_TO_DISEASE = {
    "autism_dl": "autism_spectrum_disorder",
    "kidney": "kidney_disease",
    "kidney_disease": "kidney_disease",
    "diabetes": "diabetes",
    "heart": "heart_disease",
    "stroke": "stroke",
}


class KnowledgeGraphServiceError(RuntimeError):
    pass


@dataclass(slots=True)
class KnowledgeGraphService:
    driver_manager: Neo4jDriverManager | None = None
    _initialized: bool = False

    def __post_init__(self) -> None:
        self.driver_manager = self.driver_manager or Neo4jDriverManager.from_environment()

    def bootstrap(self, data_directories: Iterable[Path | str] | None = None) -> None:
        directories = list(data_directories) if data_directories is not None else self._default_data_directories()
        if self._initialized:
            return

        try:
            self.driver_manager.verify_connection()
            profiles: list[KnowledgeGraphSeed] = []
            for directory in directories:
                path = Path(directory)
                if not path.exists() or not path.is_dir():
                    logger.info("Skipping missing knowledge graph directory path=%s", path)
                    continue

                profiles.extend(build_knowledge_graph_from_directory(self.driver_manager, path))
            self._initialized = True
            logger.info("Knowledge graph bootstrap completed profiles=%s", len(profiles))
        except KnowledgeGraphBuilderError as exc:
            raise KnowledgeGraphServiceError(str(exc)) from exc
        except Exception as exc:  # pylint: disable=broad-except
            raise KnowledgeGraphServiceError(str(exc)) from exc

    def get_symptoms(self, disease: str) -> list[str]:
        return self._get_relation_values(disease, "HAS_SYMPTOM", "Symptom")

    def get_risk_factors(self, disease: str) -> list[str]:
        return self._get_relation_values(disease, "HAS_RISK_FACTOR", "RiskFactor")

    def get_complications(self, disease: str) -> list[str]:
        return self._get_relation_values(disease, "CAUSES", "Complication")

    def get_treatments(self, disease: str) -> list[str]:
        return self._get_relation_values(disease, "TREATS", "Treatment")

    def get_full_profile(self, disease: str) -> KnowledgeGraphProfile:
        self._ensure_ready()
        with self.driver_manager.driver.session(database=self.driver_manager.config.database) as session:
            record = session.run(GET_FULL_PROFILE_QUERY, disease=self._normalize_disease(disease)).single()
            if record is None:
                return KnowledgeGraphProfile(disease=self._normalize_disease(disease))

            return KnowledgeGraphProfile(
                disease=str(record.get("disease") or self._normalize_disease(disease)),
                symptoms=_clean_list(record.get("symptoms", [])),
                risk_factors=_clean_list(record.get("risk_factors", [])),
                complications=_clean_list(record.get("complications", [])),
                treatments=_clean_list(record.get("treatments", [])),
            )

    def get_context_for_diseases(self, diseases: Iterable[str]) -> KnowledgeGraphContext:
        profiles = [self.get_full_profile(disease) for disease in diseases]
        return self._merge_profiles(profiles)

    def get_context_for_models(self, model_names: Iterable[str]) -> KnowledgeGraphContext:
        diseases = [MODEL_TO_DISEASE.get(str(model_name).strip().lower()) for model_name in model_names]
        resolved = [disease for disease in diseases if disease]
        if not resolved:
            return KnowledgeGraphContext()
        return self.get_context_for_diseases(resolved)

    def _get_relation_values(self, disease: str, relationship: str, label: str) -> list[str]:
        self._ensure_ready()
        query = GET_RELATION_QUERY.format(relationship=relationship, label=label)
        with self.driver_manager.driver.session(database=self.driver_manager.config.database) as session:
            record = session.run(query, disease=self._normalize_disease(disease)).single()
            if record is None:
                return []
            return _clean_list(record.get("values", []))

    def _merge_profiles(self, profiles: list[KnowledgeGraphProfile]) -> KnowledgeGraphContext:
        diseases: list[str] = []
        symptoms: list[str] = []
        risk_factors: list[str] = []
        complications: list[str] = []
        treatments: list[str] = []

        for profile in profiles:
            if profile.disease and profile.disease not in diseases:
                diseases.append(profile.disease)
            symptoms.extend(profile.symptoms)
            risk_factors.extend(profile.risk_factors)
            complications.extend(profile.complications)
            treatments.extend(profile.treatments)

        return KnowledgeGraphContext(
            diseases=diseases,
            symptoms=_unique_ordered(symptoms),
            risk_factors=_unique_ordered(risk_factors),
            complications=_unique_ordered(complications),
            treatments=_unique_ordered(treatments),
            source_profiles=profiles,
        )

    def _ensure_ready(self) -> None:
        if not self._initialized:
            self.bootstrap()

    def _default_data_directories(self) -> list[Path]:
        repo_root = Path(__file__).resolve().parents[2]
        return [Path("/data/medical"), repo_root / "data" / "medical"]

    def _normalize_disease(self, disease: str) -> str:
        normalized = str(disease or "").strip().lower().replace(" ", "_")
        return MODEL_TO_DISEASE.get(normalized, normalized)


knowledge_graph_service = KnowledgeGraphService()


def _clean_list(values: Iterable[str]) -> list[str]:
    return _unique_ordered([str(value).strip() for value in values if str(value).strip()])


def _unique_ordered(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        cleaned = str(value).strip()
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        ordered.append(cleaned)
    return ordered
