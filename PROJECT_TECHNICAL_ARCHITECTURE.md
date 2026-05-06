# MedAI Nexus: Technical Deep-Dive
**Project Architecture, Design Decisions, and Rationale**

## 🌐 Overview
MedAI Nexus is an end-to-end clinical AI platform designed to transform medical data into actionable insights. This document details the technologies used, their implementation, and the rationale behind each choice.

---

## 🏗️ System Architecture

### 1. The Multi-Service Core
We chose a **Microservices Architecture** to separate the fast-moving AI domain from the stable, high-reliability Backend domain.

*   **Backend (NestJS / Node.js)**
    *   **How**: A modular TypeScript backend using Prisma ORM.
    *   **Why**: NestJS provides a robust, enterprise-grade architecture. Its dependency injection and modularity allow us to scale the API without spaghetti code. TypeScript ensures type safety across our complex medical data models.
*   **AI Service (FastAPI / Python)**
    *   **How**: A high-performance Python service using asynchronous processing.
    *   **Why**: Python is the lingua franca of AI/ML. FastAPI was chosen for its extreme speed, automatic OpenAPI generation, and its ability to handle multiple ML models in parallel via asynchronous endpoints.

### 2. The Data Layers
*   **PostgreSQL (Relational)**: Stores user data, reports, and **Audit Logs**.
    *   *Why*: Transactions, ACID compliance, and structured queries are essential for medical records and reliable audit trails.
*   **Neo4j (Graph)**: Stores medical domain knowledge.
    *   *Why*: Medical reasoning is inherently relational (e.g., "Symptom A is a comorbidity of Disease B which is contraindicated with Medication C"). A graph database allows us to query these deep relationships much faster than a relational DB.
*   **Redis (Cache)**: High-speed caching for active diagnosis sessions.
    *   *Why*: Reduces database load and provides sub-millisecond response times for real-time chat and staged diagnosis.

---

## 🤖 The AI "Onion" (Layered Intelligence)

We didn't just stop at simple ML models. We built a three-layered "AI Onion":

### Layer 1: The Predictive Core (ML)
*   **What**: Specialized models for 8+ diseases (XGBoost, Random Forest, DNNs).
*   **How**: Trained on clinical datasets and packaged as portable artifacts (`.joblib`, `.pkl`).
*   **Rationale**: Different diseases require different models. For example, Tree-based models (XGBoost) excel at tabular data like diabetes, while Deep Learning is better suited for the complex patterns in our Autism detection pipeline.

### Layer 2: The Reasoning Layer (Knowledge Graph + Staged Diagnosis)
*   **What**: A stateful logic engine that connects ML predictions to clinical facts.
*   **How**: If the ML detects "High Risk Diabetes," the system queries Neo4j for follow-up symptoms (e.g., Polyuria) and uses a **Staged Diagnosis** flow to ask the user clarifying questions.
*   **Rationale**: Models alone can be "blind." Adding a reasoning layer ensures the AI behaves more like a human doctor, narrowing down possibilities through dialogue.

### Layer 3: The Explanation Layer (RAG)
*   **What**: Retrieval-Augmented Generation using a Vector Database (FAISS).
*   **How**: We embed thousands of clinical research papers and store them in FAISS. When a diagnosis is made, the LLM retrieves the most relevant paper snippets to provide a grounded, evidence-based explanation.
*   **Rationale**: Transparency is critical in health. RAG prevents "AI Hallucinations" by forcing the model to cite real medical literature for every claim it makes.

---

## 📊 AIOps & MLOps: Monitoring the Intelligence

The project implements a modern **AIOps** stack to ensure the AI remains healthy in production.

*   **Prometheus & Grafana**:
    *   **How**: We instrumented the code to expose "Inference Metrics."
    *   **Why**: We need to know if a model is "drifting" (performing differently than in training) or if latency is spiking.
*   **The Custom Backend Exporter**:
    *   **Innovation**: We built a custom exporter in the NestJS backend that derives Prometheus metrics from our PostgreSQL audit logs. This means our monitoring has "perfect memory"—if a service restarts, we don't lose our historical trend data.

---

## 🏁 Conclusion: The "Why"
Every technology in MedAI Nexus was chosen to solve a specific clinical or engineering challenge:
- **FastAPI** for speed.
- **NestJS** for reliability.
- **Neo4j** for reasoning.
- **Prometheus** for visibility.

Together, they form a production-ready ecosystem that moves AI from a "research project" into a **clinical-grade tool**.
