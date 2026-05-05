# MLOps + AIOps Integration Guide for MedAI Nexus

## Overview

This guide shows how to integrate MLOps (model versioning, tracking) and AIOps (monitoring, drift detection) into MedAI Nexus.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI AI Service                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐    ┌──────────────────────────────┐ │
│  │  MLflow Tracker  │    │ Prometheus Monitoring        │ │
│  │  - Model Registry│    │ - Inference Requests         │ │
│  │  - Experiment    │    │ - Latency Tracking           │ │
│  │  - Versioning    │    │ - Error Rates                │ │
│  └──────────────────┘    │ - Confidence Scores          │ │
│         ↓                │ - Drift Alerts               │ │
│                          └──────────────────────────────┘ │
│  ┌──────────────────┐    ┌──────────────────────────────┐ │
│  │ Prediction Logger│    │  Drift Detector              │ │
│  │ - Log to Backend │    │ - Feature Drift Check        │ │
│  │ - Local JSONL    │    │ - Prediction Distribution    │ │
│  │ - Structured Logs│    │ - Statistical Analysis       │ │
│  └──────────────────┘    └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         │                          │                  │
         ↓                          ↓                  ↓
    ┌─────────┐           ┌──────────────┐    ┌──────────────┐
    │ PostgreSQL           │  Prometheus  │    │ MLflow Server│
    │ (Logs)               │  (Metrics)   │    │ (Registry)   │
    └─────────┘           └──────────────┘    └──────────────┘
         ↓                          ↓
    ┌─────────────────────────────────────┐
    │    NestJS Backend API               │
    │  /api/logs/prediction               │
    │  /api/logs/statistics               │
    │  /api/model/info                    │
    └─────────────────────────────────────┘
         ↓
    ┌─────────────────────────────────────┐
    │    Next.js Frontend                 │
    │  Monitoring Dashboard               │
    │  Drift Alerts                       │
    │  Model Info                         │
    └─────────────────────────────────────┘
```

---

## Step 1: Install Dependencies

Update `ai-service/requirements.txt`:

```bash
pip install -r ai-service/requirements.txt
```

Includes:
- `mlflow==2.9.1` - Model tracking & registry
- `prometheus-fastapi-instrumentator==6.1.0` - Metrics collection
- `prometheus-client==0.19.0` - Prometheus client

---

## Step 2: Initialize MLflow

### Option A: Local File Storage (Development)

```python
# ai-service/app/services/mlflow_tracker.py
import os
import mlflow

# Set tracking URI
MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "file:./mlruns")
mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
mlflow.set_experiment("medai_models")
```

### Option B: Remote MLflow Server (Production)

```bash
# Start MLflow server
mlflow server --backend-store-uri postgresql://user:password@localhost:5432/mlflow \
              --default-artifact-root s3://my-bucket/mlflow \
              --host 0.0.0.0 --port 5000
```

Then set environment variable:

```bash
export MLFLOW_TRACKING_URI=http://mlflow-server:5000
```

---

## Step 3: Integrate into FastAPI Main

Update `ai-service/app/main.py`:

```python
from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator
from app.services.mlflow_tracker import get_tracker
from app.services.prediction_logger import get_prediction_logger
from app.services.drift_detector import get_drift_detector
from app.services.prometheus_monitoring import setup_prometheus

app = FastAPI()

# Initialize MLflow
tracker = get_tracker()

# Initialize prediction logger
pred_logger = get_prediction_logger(backend_api_url="http://backend:4000")

# Initialize drift detector (set baseline from training data)
drift_detector = get_drift_detector()
baseline_features = {
    "age": {"mean": 45, "std": 15},
    "glucose": {"mean": 125, "std": 30},
    "bmi": {"mean": 27, "std": 5},
}
drift_detector.set_baseline(baseline_features)

# Setup Prometheus
setup_prometheus(app)

@app.post("/predict/{disease}")
async def predict(disease: str, features: dict):
    start_time = time.time()
    
    try:
        # ... prediction logic ...
        
        # Record metrics
        from app.services.prometheus_monitoring import (
            record_inference_request,
            record_inference_latency,
            record_confidence,
        )
        
        latency = (time.time() - start_time) * 1000
        model_id = f"{disease}_pred"
        model_version = "1.0"
        
        record_inference_request(model_id, model_version)
        record_inference_latency(model_id, latency / 1000)
        record_confidence(model_id, prediction["confidence"])
        
        # Check for drift
        drift_detected, drift_report = drift_detector.check_feature_drift(features)
        
        # Log prediction
        pred_logger.log_prediction(
            report_id=request_id,
            model_id=model_id,
            model_version=model_version,
            input_features=features,
            prediction=prediction,
            confidence=prediction["confidence"],
            processing_time_ms=latency,
            metadata={"drift_detected": drift_detected, "drift_report": drift_report}
        )
        
        return prediction
        
    except Exception as e:
        from app.services.prometheus_monitoring import record_inference_error
        record_inference_error(model_id, type(e).__name__)
        raise
```

---

## Step 4: Update NestJS Backend

### 4.1 Add PredictionLog Entity

Entity already created: `src/modules/logs/entities/prediction-log.entity.ts`

### 4.2 Import LogsModule in App Module

Update `src/app.module.ts`:

```typescript
import { LogsModule } from './modules/logs/logs.module';

@Module({
  imports: [
    // ... other imports
    LogsModule,
  ],
})
export class AppModule {}
```

### 4.3 Run Prisma Migration

```bash
cd medical-api
npx prisma migrate dev --name add_prediction_logs
npx prisma generate
```

---

## Step 5: Add Frontend Monitoring Dashboard

### 5.1 Import Component

Update your Next.js layout or page:

```typescript
// src/app/monitoring/page.tsx
import MonitoringDashboard from '@/components/MonitoringDashboard';

export default function MonitoringPage() {
  return <MonitoringDashboard />;
}
```

### 5.2 Add Route in Navigation

Add monitoring link to navigation menu:

```typescript
const navigationItems = [
  // ... existing items
  {
    label: 'Monitoring',
    href: '/monitoring',
    icon: '📊',
  },
];
```

---

## Step 6: Configure Prometheus (Optional but Recommended)

### 6.1 Create prometheus.yml

```yaml
# docker/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'medai-ai-service'
    static_configs:
      - targets: ['localhost:8001']
    metrics_path: '/metrics'
```

### 6.2 Add to Docker Compose

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./docker/prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
    networks:
      - medai-network
```

### 6.3 Add Grafana (Optional)

```yaml
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana
    networks:
      - medai-network
```

---

## Step 7: Usage Examples

### Log a Prediction

```bash
curl -X POST http://localhost:4000/api/logs/prediction \
  -H "Content-Type: application/json" \
  -d '{
    "report_id": "report-123",
    "model_id": "diabetes_pred",
    "model_version": "1.0",
    "input": {"glucose": 180, "bmi": 28},
    "prediction": {"risk": "high", "label": "diabetic"},
    "confidence": 0.92,
    "processing_time_ms": 45.2
  }'
```

### Get Model Statistics

```bash
curl http://localhost:4000/api/logs/statistics?modelId=diabetes_pred
```

### Get Drift Alerts

```bash
curl http://localhost:4000/api/logs/drift-alerts?modelId=diabetes_pred
```

### Get Model Info

```bash
curl http://localhost:4000/api/model/info?modelId=diabetes_pred
```

### Access Prometheus Metrics

```bash
# FastAPI metrics endpoint
curl http://localhost:8001/metrics
```

---

## Step 8: Track Model Training with MLflow

Example training script:

```python
# ai-service/training/train_diabetes_model.py
import mlflow
import mlflow.sklearn
from app.services.mlflow_tracker import get_tracker
from sklearn.ensemble import RandomForestClassifier

tracker = get_tracker()

# Start MLflow run
tracker.start_run(
    run_name="diabetes_model_v1.0",
    tags={"project": "medai", "disease": "diabetes"}
)

# Train model
model = RandomForestClassifier(n_estimators=100)
model.fit(X_train, y_train)

# Log metrics
metrics = {
    "accuracy": 0.94,
    "precision": 0.92,
    "recall": 0.94,
    "f1_score": 0.93,
}
tracker.log_metrics(metrics)

# Log parameters
params = {
    "n_estimators": 100,
    "max_depth": 15,
    "min_samples_split": 5,
}
tracker.log_params(params)

# Log model
tracker.log_model(model, "diabetes_model", model_type="sklearn")

# End run
tracker.end_run()

# Register model
tracker.register_model(
    model_name="diabetes_v1",
    model_uri=f"runs:/...../diabetes_model",
    stage="Production"
)
```

---

## Step 9: Monitoring & Alerting

### Basic Alerts to Set Up

1. **High Error Rate**
   - Alert if error rate > 5%

2. **Low Confidence**
   - Alert if average confidence < 70%

3. **Drift Detected**
   - Alert if feature drift > 2 sigma

4. **High Latency**
   - Alert if inference latency > 1000ms

---

## Step 10: Docker Compose Integration

Update `docker-compose.yml`:

```yaml
services:
  ai-service:
    environment:
      - MLFLOW_TRACKING_URI=http://mlflow:5000
      - PROMETHEUS_ENABLED=true
    # ... rest of config

  mlflow:
    image: ghcr.io/mlflow/mlflow:latest
    ports:
      - "5000:5000"
    command: mlflow server --host 0.0.0.0 --backend-store-uri file:///mlflow
    volumes:
      - mlflow-data:/mlflow
    networks:
      - medai-network

volumes:
  mlflow-data:
```

---

## Deployment Checklist

- [ ] Install dependencies in AI service
- [ ] Create MLflow configuration (local or remote)
- [ ] Update FastAPI main.py with monitoring integration
- [ ] Update Prisma schema and run migration
- [ ] Import LogsModule in NestJS app
- [ ] Add Monitoring Dashboard to Next.js
- [ ] Configure Prometheus (optional)
- [ ] Test prediction logging endpoint
- [ ] Verify metrics exposed at `/metrics`
- [ ] Monitor dashboard working
- [ ] Set up alerts in Prometheus
- [ ] Deploy to production with monitoring enabled

---

## Troubleshooting

### MLflow Server Not Reachable

```bash
# Check if MLflow server is running
curl http://mlflow:5000/

# Verify environment variable
echo $MLFLOW_TRACKING_URI
```

### Predictions Not Being Logged

```bash
# Check FastAPI logs
docker logs medai-ai-service

# Verify backend API is accessible
curl http://backend:4000/api/logs/prediction
```

### Prometheus Metrics Not Appearing

```bash
# Check if FastAPI is exposing metrics
curl http://localhost:8001/metrics

# Verify Prometheus config
docker logs prometheus
```

---

## Next Steps

1. **Model Registry Integration**: Register all production models
2. **Advanced Drift Detection**: Implement ADWIN or Drift Detection methods
3. **Alerting System**: Integrate with PagerDuty or Slack
4. **Model Retraining Pipeline**: Automate retraining on drift detection
5. **Cost Optimization**: Implement model serving cost tracking
6. **Compliance**: Add audit logging for regulatory requirements

---

**Files Created/Modified:**
- `ai-service/requirements.txt` - Added MLflow and Prometheus packages
- `ai-service/app/services/mlflow_tracker.py` - MLflow integration
- `ai-service/app/services/prediction_logger.py` - Prediction logging
- `ai-service/app/services/drift_detector.py` - Drift detection
- `ai-service/app/services/prometheus_monitoring.py` - Prometheus metrics
- `medical-api/prisma/schema.prisma` - Added PredictionLog model
- `medical-api/src/modules/logs/` - NestJS logging module
- `medical-web/src/components/MonitoringDashboard.tsx` - Frontend dashboard

