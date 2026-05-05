# MedAI Nexus — Reworked Technical Presentation

**Audience**: Technical judges, reviewers, DevOps engineers, and investor-technical leads

Last updated: May 5, 2026

---

## Executive Summary

- MedAI Nexus transforms multi-format medical reports into clinical-grade, explainable diagnoses across 8 disease domains.
- Fast, parallel inference (<5s end-to-end), RAG-grounded LLM explanations, and a Neo4j knowledge graph for contextual reasoning.
- Production-ready architecture: Docker Compose for local dev, Kubernetes + Helm for production, and CI/CD pipelines for safe model promotion.

---

## Slide: Objectives

- Present the full pipeline from ingestion → extraction → routing → inference → explanation.
- Explain CRISP-DM-based development and reproducibility practices.
- Detail model integration (packaging, loader, adapters, validation, routing).
- Provide a DevOps playbook: local dev, containerization, registry, Helm deploy, CI/CD, monitoring, and rollback.

---

## Slide: CRISP-DM Process & Tooling

1. Business Understanding
   - Defined diagnosis objectives, accuracy targets, latency targets, and regulatory considerations.
   - Stakeholders: physicians, data scientists, devs, hospital IT, compliance.

2. Data Understanding
   - Sources: hospital exports, annotated PDFs/images, pilot datasets.
   - Tools: `pandas`, exploratory notebooks, clinician-led label review.

3. Data Preparation
   - OCR pipeline: `Tesseract` + text clean-up heuristics.
   - Parsers: disease-specific extraction modules in `ai-service/app/services` (regex + context + unit normalization).
   - Validation: Pydantic schemas in `ai-service/app/models/schemas.py` enforce types and ranges.

4. Modeling
   - Algorithms per disease chosen by accuracy vs interpretability: RandomForest, LogisticRegression, XGBoost, SVM, DNNs.
   - Libraries: `scikit-learn`, `xgboost`, `PyTorch`, `TensorFlow`.
   - Experiment tracking: `MLflow` or S3 artifact + manifest (git commit, dataset fingerprint, metrics).

5. Evaluation
   - Standard metrics: accuracy, precision, recall, AUC, calibration curves.
   - Clinical pilots: small hospital rollouts and physician review before production.

6. Deployment
   - Artifact packaging: model file + preprocessor + manifest (e.g., `model.onnx`, `scaler.pkl`, `manifest.json`).
   - Serving: FastAPI microservices (local) and ONNXRuntime/Triton for optimized production runtime.
   - Orchestration: Docker Compose for dev, Kubernetes (Helm) for prod; CI for automated promotion.

7. Maintenance
   - Monitoring → drift detection → data labeling → retrain cycle.
   - Governance: model registry, versioning, automated rollback rules.

---

## Slide: ML Methodology (Details)

- Feature engineering: domain-driven features, interactions (age×BMI), unit normalization, and missing-value strategies.
- Model selection: evaluate multiple families per disease and pick the best accuracy/interpretable tradeoff.
- Tuning: grid search / Bayesian methods with cross-validation (5-fold stratified).
- Ensembles: stacking/ensembling where it improves robustness.
- Explainability: SHAP or feature importance exported per prediction; per-model `feature_importance` outputs.
- Reproducibility: containerized training, artifact manifests and dataset fingerprints stored alongside model artifacts.

---

## Slide: Model Integration (How models are integrated into the AI service)

Key design patterns and concrete behaviors (implementation references: `ai-service/app/services/model_loader.py`, `ai-service/app/models/schemas.py`):

- Packaging
  - Bundle the model artifact and preprocessing into `/models/<disease>/`.
  - Expected artifact types: `*.joblib`, `*.pkl`, `*.h5` (TF), sometimes `*.onnx` for portability.
  - Manifest contains `model_id`, `version`, `training_commit`, `metrics`, `required_runtime`.

- Model Loader
  - `ModelLoader` reads `MODELS_PATH` (env) and searches fallback paths; supports hot startup loading of multiple models.
  - Validates artifacts (existence, non-empty) and registers `model_versions` + `response_time` metadata.

- Feature Schema & Validation
  - All inference inputs are validated by Pydantic models in `ai-service/app/models/schemas.py` ensuring typed, bounded inputs.
  - This prevents silent failures from malformed inputs and ensures consistent preprocessing.

- Adapter Pattern
  - Each model has an adapter that converts standardized features → model input tensor/array and performs postprocessing (risk score, class probabilities, clinical labels).
  - Adapters expose a uniform `predict(input: dict) -> dict` interface.

- Routing & Orchestration
  - AI agent determines models to run via rules + lightweight routing ML, then issues parallel adapter `/predict` calls and aggregates results.

- Fault Tolerance & Safety
  - Timeouts + retries for model inference calls.
  - Cached last-good results and fallback models if primary artifact unavailable.
  - Health endpoints expose per-model `loaded`/`not_loaded` states with versions.

- Observability
  - Per-model Prometheus metrics: `inference_requests_total`, `inference_latency_seconds`, `inference_errors_total`, `prediction_distribution`.
  - Structured logs include `model_id`, `model_version`, `input_hash`, and `request_id`.

- CI Validation
  - CI runs schema checks and sample inference tests prior to model promotion. If tests fail, model cannot be promoted.

- Runtime Loading
  - Serving images expect model artifacts available via mounted volume or downloaded from registry (S3/MLflow) into `MODELS_PATH`.

---

## Slide: AI Pipeline (concise)

1. Ingest (PDF/image) → 2. OCR → 3. Disease Parsers → 4. Validation → 5. Routing → 6. Parallel Inference → 7. RAG retrieval → 8. KG reasoning → 9. LLM explanations

Latency targets: end-to-end 2-5s; model inference 50-150ms per model (depending on runtime).

---

## Slide: RAG, Knowledge Graph & LLMs (Concise)

- Embeddings: `sentence-transformers` → FAISS index for semantic retrieval (local path `FAISS_DATA_PATH` in env)
- LLMs: grounded prompts + retrieved evidence and KG facts; LLM used only for explanation generation (not as single source of truth)
- Knowledge graph: Neo4j stores domain schema (diseases, symptoms, treatments) queried for contraindication checks and comorbidity reasoning

---

## Slide: DevOps & Production Playbook (Full)

This section contains concrete, reproducible steps used in development and recommended for production.

### Local Development (docker-compose)

- Command: run the full stack locally for feature development

```bash
docker-compose up --build
```

- Key dev services (see `docker-compose.yml`):
  - `frontend` (Next.js) → port 3000
  - `backend` (NestJS) → port 4000
  - `ai-service` (FastAPI) → port 8001; mounts `/models` and `/data`
  - `postgres`, `neo4j`, `redis`

- Important envs from `docker-compose.yml` used at runtime:
  - `MODELS_PATH=/models` (where model artifacts must be mounted)
  - `FAISS_DATA_PATH=/data/faiss`
  - `AI_SERVICE_URL` used by the backend to call AI service

### Containerization & Image Strategy

- Per-service images follow the pattern: `registry.example.com/<project>/<service>:<semver>`.
- Build images via CI; example build command:

```bash
docker build -t registry.example.com/medai/ai-service:1.2.0 -f ai-service/Dockerfile.ai ./ai-service
docker push registry.example.com/medai/ai-service:1.2.0
```

- Images include: inference server, minimal runtime, and an init step to fetch model artifacts (or use a mounted volume in k8s).

### Model Registry & Artifacts

- Recommended: use MLflow for artifact metadata + S3/MinIO for model storage; manifest should include:
  - `model_id`, `version`, `git_commit`, `training_data_fingerprint`, `metrics`, `runtime_requirements`.
- Serving instances download artifacts from storage during init or mount via CSI/hostPath in k8s.
- The `ModelLoader` reads local `MODELS_PATH` and supports multiple artifact types (`.joblib`, `.pkl`, `.h5`).

### Kubernetes (Production) — Helm + Best Practices

- Use a Helm chart per service (ai-service, backend, frontend)
- ai-service Deployment notes:
  - Liveness and readiness probes for `/health` and per-model status
  - Mount models via CSI volume or initContainer that downloads model artifacts from registry
  - Use nodeSelectors / tolerations for GPU workloads (autism image model)
  - HPA based on custom metrics (CPU/GPU + inference queue length)
  - Canary deployments: set `maxSurge`/`maxUnavailable` and traffic split via ingress or service mesh

Sample Helm deploy command:

```bash
helm upgrade --install medai-ai ./charts/ai-service --set image.tag=1.2.0 --namespace ai --wait
```

### CI/CD Pipeline (GitHub Actions - skeleton)

- Steps for model / service pipeline:
  1. Lint & unit tests
  2. Run sample inference tests (use a small fixture to validate model responds)
  3. Build Docker image and push to registry
  4. Deploy to staging (Helm canary)
  5. Run smoke and integration tests in staging
  6. Promote to production if metrics pass

Example job snippet (conceptual):

```yaml
name: CI
on: [push, pull_request]
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install deps
        run: pip install -r ai-service/requirements.txt
      - name: Run unit tests
        run: pytest -q
      - name: Build & push image
        uses: docker/build-push-action@v4
        with:
          push: true
          tags: registry.example.com/medai/ai-service:${{ github.sha }}
      - name: Deploy to staging
        run: helm upgrade --install ...
```

### Canarying, Shadowing & Rollback

- Canary: deploy new image to a subset of pods / percentage of traffic and monitor.
- Shadow: send traffic copies to new model instance without affecting responses.
- Rollback: use image tags and Helm rollback: `helm rollback RELEASE REVISION` or kubectl rollout undo.

### Observability & Monitoring

- Metrics to export from ai-service:
  - `inference_requests_total{model_id,version}`
  - `inference_latency_seconds{quantile,model_id}`
  - `inference_errors_total{model_id}`
  - `prediction_distribution{model_id,label}` (for drift detection)

- Logging format: JSON structured logs with `request_id`, `model_id`, `model_version`, `input_hash`.
- Dashboards: Grafana panels for p50/p90/p99 latency, error rate, throughput, and distribution drift.
- Alerts: trigger rollback on sustained metric degradations (e.g., 3x error rate or drift beyond threshold).

---

## Slide: Security, Compliance & Governance

- Secrets: use Kubernetes secrets or Vault; do not embed keys in images.
- Data privacy: store PHI encrypted at rest; redact PII in logs.
- Audit: model predictions and inputs retained for a limited audit window; maintain model lineage and dataset fingerprints.
- Regulatory: document clinical validation steps and safety checks for any ML-driven clinical recommendation.

---

## Appendix: Quick Commands & Examples

Local dev compose up:

```bash
docker-compose up --build
```

Build AI service image:

```bash
docker build -t registry.example.com/medai/ai-service:1.2.0 -f ai-service/Dockerfile.ai ./ai-service
```

Push image:

```bash
docker push registry.example.com/medai/ai-service:1.2.0
```

Helm deploy (staging/canary):

```bash
helm upgrade --install medai-ai ./charts/ai-service --set image.tag=1.2.0 --namespace ai --wait
```

Test inference (sample):

```bash
curl -X POST http://localhost:8001/predict -H 'Content-Type: application/json' -d '{"features": {...}}'
```

---

## Next Steps (recommended)

- Create minimal Helm chart for `ai-service` with model-init initContainer.
- Add GitHub Actions workflows for service CI and model CI (artifact validation + staging promotion).
- Implement Prometheus exporters in ai-service and create Grafana dashboards.
- Formalize a model registry (MLflow + S3/MinIO) and add automatic artifact ingestion hook into CI.

---

File created: `TECHNICAL_PRESENTATION_REWORKED.md`

If you want, I can now:
- commit this file and open a PR, or
- generate a PDF slide deck from this markdown, or
- scaffold the Helm chart and GitHub Actions workflow referenced above.
