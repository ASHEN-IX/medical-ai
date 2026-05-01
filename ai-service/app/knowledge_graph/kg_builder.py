from __future__ import annotations

import copy
import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from app.knowledge_graph.kg_schema import KnowledgeGraphProfile
from app.knowledge_graph.neo4j_driver import Neo4jDriverManager
from app.knowledge_graph.kg_queries import MERGE_DISEASE_QUERY, MERGE_RELATED_ENTITY_QUERY, SCHEMA_QUERIES
from app.models.rag_schema import MedicalKnowledgeDocumentInput


logger = logging.getLogger(__name__)


RELATION_TO_LABEL = {
    "HAS_SYMPTOM": "Symptom",
    "HAS_RISK_FACTOR": "RiskFactor",
    "CAUSES": "Complication",
    "TREATS": "Treatment",
}

BLUEPRINTS: dict[str, dict[str, list[str]]] = {
    "autism_spectrum_disorder": {
        "symptoms": [
            "difficulty in social interaction",
            "difficulty in communication",
            "reduced eye contact",
            "delayed speech development",
            "repetitive behaviors",
            "strong preference for routines",
            "intense interests",
            "sensory sensitivities",
            "differences in learning and behavior",
        ],
        "risk_factors": [
            "genetic factors",
            "environmental factors",
            "parental age",
            "prenatal exposure to pollutants",
            "complications during birth",
            "premature birth",
            "certain genetic variations",
        ],
        "complications": [],
        "treatments": [
            "early intervention",
            "behavioral therapies",
            "educational support",
            "speech therapy",
            "occupational therapy",
            "individualized care plans",
        ],
    },
    "kidney_disease": {
        "symptoms": [
            "fatigue",
            "shortness of breath",
            "swelling in legs or hands",
            "nausea",
            "vomiting",
            "muscle cramps",
            "generalized itching",
            "changes in urination",
        ],
        "risk_factors": [
            "diabetes",
            "high blood pressure",
            "cardiovascular disease",
            "kidney infections",
            "glomerulonephritis",
            "genetic conditions",
            "urinary blockages",
            "long-term NSAID use",
            "toxins",
            "ageing populations",
        ],
        "complications": [],
        "treatments": [
            "lifestyle changes",
            "blood pressure control",
            "diabetes management",
            "medications",
            "dialysis",
            "kidney transplantation",
            "healthy lifestyle",
            "regular physical activity",
            "maintaining healthy weight",
            "avoiding smoking",
            "controlling cholesterol levels",
        ],
    },
}


@dataclass(frozen=True, slots=True)
class KnowledgeGraphSeed:
    disease: str
    source: str
    symptoms: list[str]
    risk_factors: list[str]
    complications: list[str]
    treatments: list[str]


class KnowledgeGraphBuilderError(RuntimeError):
    pass


class KnowledgeGraphBuilder:
    def __init__(self, driver_manager: Neo4jDriverManager) -> None:
        self.driver_manager = driver_manager

    def ensure_schema(self) -> None:
        with self.driver_manager.driver.session(database=self.driver_manager.config.database) as session:
            for query in SCHEMA_QUERIES:
                session.run(query)

    def ingest_documents(self, documents: Iterable[MedicalKnowledgeDocumentInput], source_file: str) -> None:
        profiles = [self._build_profile(document, source_file) for document in documents]
        with self.driver_manager.driver.session(database=self.driver_manager.config.database) as session:
            for profile in profiles:
                self._upsert_profile(session, profile, source_file)

    def _upsert_profile(self, session, profile: KnowledgeGraphSeed, source_file: str) -> None:
        session.run(MERGE_DISEASE_QUERY, disease=profile.disease, source=source_file)
        for symptom in profile.symptoms:
            self._merge_related_entity(session, profile.disease, symptom, "HAS_SYMPTOM")
        for risk_factor in profile.risk_factors:
            self._merge_related_entity(session, profile.disease, risk_factor, "HAS_RISK_FACTOR")
        for complication in profile.complications:
            self._merge_related_entity(session, profile.disease, complication, "CAUSES")
        for treatment in profile.treatments:
            self._merge_related_entity(session, profile.disease, treatment, "TREATS")

    def _merge_related_entity(self, session, disease: str, name: str, relationship: str) -> None:
        label = RELATION_TO_LABEL[relationship]
        # Use simple replacement to avoid interfering with Cypher parameter braces
        query = MERGE_RELATED_ENTITY_QUERY.replace("{label}", label).replace("{relationship}", relationship)
        session.run(query, disease=disease, name=name)

    def _build_profile(self, document: MedicalKnowledgeDocumentInput, source_file: str) -> KnowledgeGraphSeed:
        disease = self._normalize_disease(document.disease)
        blueprint = copy.deepcopy(BLUEPRINTS.get(disease, {}))

        symptoms = list(blueprint.get("symptoms", []))
        risk_factors = list(blueprint.get("risk_factors", []))
        complications = list(blueprint.get("complications", []))
        treatments = list(blueprint.get("treatments", []))

        for chunk in document.chunks:
            chunk_type = chunk.type.strip().lower()
            extracted_terms = self._extract_terms(chunk.text)

            if chunk_type == "symptoms":
                symptoms.extend(extracted_terms)
            elif chunk_type in {"causes", "risk_factors", "prevention"}:
                risk_factors.extend(extracted_terms)
            elif chunk_type in {"treatment", "support"}:
                treatments.extend(extracted_terms)
            elif chunk_type == "complications":
                complications.extend(extracted_terms)

        return KnowledgeGraphSeed(
            disease=disease,
            source=source_file,
            symptoms=_dedupe(symptoms),
            risk_factors=_dedupe(risk_factors),
            complications=_dedupe(complications),
            treatments=_dedupe(treatments),
        )

    def _extract_terms(self, text: str) -> list[str]:
        cleaned = re.sub(r"\s+", " ", text.strip())
        cleaned = re.sub(r"\b(?:Symptoms include|Common causes include|Treatment focuses on|Support includes|Risk can be reduced through)\b",
                         "",
                         cleaned,
                         flags=re.IGNORECASE)
        pieces = re.split(r",|;|\band\b", cleaned, flags=re.IGNORECASE)
        terms = []
        for piece in pieces:
            candidate = piece.strip().strip(". ")
            if not candidate:
                continue
            if len(candidate.split()) <= 1 and candidate.lower() in {"and", "or"}:
                continue
            if candidate.lower().startswith(("it is", "this includes", "it can")):
                continue
            terms.append(candidate)
        return terms

    def _normalize_disease(self, disease: str) -> str:
        normalized = disease.strip().lower().replace(" ", "_")
        synonyms = {
            "autism": "autism_spectrum_disorder",
            "asd": "autism_spectrum_disorder",
            "ckd": "kidney_disease",
        }
        return synonyms.get(normalized, normalized)


def build_knowledge_graph_from_directory(driver_manager: Neo4jDriverManager, data_directory: Path) -> list[KnowledgeGraphSeed]:
    if not data_directory.exists() or not data_directory.is_dir():
        raise KnowledgeGraphBuilderError(f"Knowledge graph data directory not found: {data_directory}")

    builder = KnowledgeGraphBuilder(driver_manager)
    builder.ensure_schema()

    ingested_profiles: list[KnowledgeGraphSeed] = []
    for json_file in sorted(data_directory.glob("*.json")):
        try:
            raw_payload = json.loads(json_file.read_text(encoding="utf-8"))
            document = MedicalKnowledgeDocumentInput.model_validate(raw_payload)
            builder.ingest_documents([document], str(json_file))
            ingested_profiles.append(builder._build_profile(document, str(json_file)))
        except Exception as exc:  # pylint: disable=broad-except
            raise KnowledgeGraphBuilderError(f"Failed to ingest knowledge graph file {json_file}: {exc}") from exc

    return ingested_profiles


def _dedupe(values: list[str]) -> list[str]:
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
