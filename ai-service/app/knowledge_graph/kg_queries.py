from __future__ import annotations

SCHEMA_QUERIES = [
    "CREATE CONSTRAINT disease_name IF NOT EXISTS FOR (n:Disease) REQUIRE n.name IS UNIQUE",
    "CREATE CONSTRAINT symptom_name IF NOT EXISTS FOR (n:Symptom) REQUIRE n.name IS UNIQUE",
    "CREATE CONSTRAINT risk_factor_name IF NOT EXISTS FOR (n:RiskFactor) REQUIRE n.name IS UNIQUE",
    "CREATE CONSTRAINT complication_name IF NOT EXISTS FOR (n:Complication) REQUIRE n.name IS UNIQUE",
    "CREATE CONSTRAINT treatment_name IF NOT EXISTS FOR (n:Treatment) REQUIRE n.name IS UNIQUE",
]

GET_FULL_PROFILE_QUERY = """
MATCH (d:Disease {name: $disease})
OPTIONAL MATCH (d)-[:HAS_SYMPTOM]->(s:Symptom)
OPTIONAL MATCH (d)-[:HAS_RISK_FACTOR]->(r:RiskFactor)
OPTIONAL MATCH (d)-[:CAUSES]->(c:Complication)
OPTIONAL MATCH (d)-[:TREATS]->(t:Treatment)
RETURN
    d.name AS disease,
    collect(DISTINCT s.name) AS symptoms,
    collect(DISTINCT r.name) AS risk_factors,
    collect(DISTINCT c.name) AS complications,
    collect(DISTINCT t.name) AS treatments
"""

GET_RELATION_QUERY = """
MATCH (d:Disease {name: $disease})
OPTIONAL MATCH (d)-[:{relationship}]->(n:{label})
RETURN collect(DISTINCT n.name) AS values
"""

MERGE_DISEASE_QUERY = """
MERGE (d:Disease {name: $disease})
ON CREATE SET d.source = $source
ON MATCH SET d.source = coalesce(d.source, $source)
RETURN d.name AS disease
"""

MERGE_RELATED_ENTITY_QUERY = """
MERGE (d:Disease {name: $disease})
MERGE (n:{label} {name: $name})
MERGE (d)-[:{relationship}]->(n)
RETURN d.name AS disease, n.name AS name
"""
