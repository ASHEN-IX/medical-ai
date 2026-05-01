from __future__ import annotations

import logging
import os
from dataclasses import dataclass

from neo4j import Driver, GraphDatabase

from app.knowledge_graph.kg_schema import KnowledgeGraphConfig


logger = logging.getLogger(__name__)


@dataclass(slots=True)
class Neo4jDriverManager:
    config: KnowledgeGraphConfig
    _driver: Driver | None = None

    @classmethod
    def from_environment(cls) -> "Neo4jDriverManager":
        uri = os.getenv("NEO4J_URL", os.getenv("NEO4J_URI", "bolt://neo4j:7687"))
        username = os.getenv("NEO4J_USERNAME", "neo4j")
        password = os.getenv("NEO4J_PASSWORD", "neo4j_password")
        database = os.getenv("NEO4J_DATABASE")
        return cls(KnowledgeGraphConfig(uri=uri, username=username, password=password, database=database))

    @property
    def driver(self) -> Driver:
        if self._driver is None:
            self._driver = GraphDatabase.driver(
                self.config.uri,
                auth=(self.config.username, self.config.password),
            )
        return self._driver

    def verify_connection(self) -> None:
        logger.info("Verifying Neo4j connection uri=%s database=%s", self.config.uri, self.config.database)
        with self.driver.session(database=self.config.database) as session:
            session.run("RETURN 1 AS ok").single()

    def close(self) -> None:
        if self._driver is not None:
            self._driver.close()
            self._driver = None
