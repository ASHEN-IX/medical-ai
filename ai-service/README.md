# ai-service

Production FastAPI service for medical disease prediction models.

## What This Service Does

- Serves diabetes detection using the integrated Decision Tree `.joblib` model.
- Serves Deep Learning vision predictions for autism detection.
- Serves survey-based ML autism risk predictions.
- Serves kidney disease predictions.
- Provides an AI Gateway endpoint that routes requests to the correct model.
- Loads models once at startup.
- Exposes typed API endpoints for backend integration.

## Current Integrated Models

### Diabetes Detection

Model artifact:

```text
models/diabetes/diabetes_decision_tree.joblib
```

Source training workflow:

```text
Data Preparation - Copie/notebooks/Diabetes_Arbre_de_decision.ipynb
```

Expected model input fields:

```text
Pregnancies
Glucose
BloodPressure
SkinThickness
Insulin
BMI
DiabetesPedigreeFunction
Age
```

Public endpoint:

```text
POST /api/v1/diabetes/predict
```

Gateway endpoint:

```text
POST /api/v1/ai/analyze
```

Example diabetes request:

```json
{
  "pregnancies": 2,
  "glucose": 148,
  "blood_pressure": 72,
  "skin_thickness": 35,
  "insulin": 0,
  "bmi": 33.6,
  "diabetes_pedigree_function": 0.627,
  "age": 50
}
```

### Autism Detection

Survey/tabular autism route:

```text
POST /api/v1/autism-pred/predict
GET  /api/v1/autism-pred/categories
```

Image/DL autism route:

```text
POST /api/v1/autism-dl/predict
```

Model artifact locations:

```text
models/autism-prediction/best-model-autism.pkl
models/autism-prediction/encoders.pkl
models/autism-dl/autism-dl.h5
models/autism-dl/final_model.h5
```

The survey autism model can load from the `.pkl` files. The image/DL autism route requires an `.h5` model file. If the `.h5` file is missing, health reports `autism_dl` as `not_loaded`.

### Kidney Disease

Model artifact locations:

```text
models/kidney-disease/kidney_disease_model.pkl
models/kidney-disease/scaler.pkl
models/kidney-disease/feature_names.pkl
models/kidney-disease/label_encoder.pkl
```

Public endpoint:

```text
POST /api/v1/kidney-disease/predict
```

## Clean Folder Layout

```text
ai-service/
├── app/
│   ├── main.py
│   ├── api/
│   │   └── routes/
│   │       ├── ai_gateway.py
│   │       ├── autism_dl.py
│   │       ├── autism_prediction.py
│   │       ├── diabetes.py
│   │       ├── kidney_disease.py
│   │       ├── rag.py
│   │       └── report_processing.py
│   ├── models/
│   │   └── schemas.py
│   └── services/
│       ├── autism_dl_service.py
│       ├── autism_prediction_service.py
│       ├── diabetes_service.py
│       ├── kidney_disease_service.py
│       └── model_loader.py
├── models/
│   ├── diabetes/
│   │   └── diabetes_decision_tree.joblib
│   ├── autism-dl/
│   │   └── final_model.h5
│   └── autism-prediction/
│       ├── best_model.pkl
│       └── encoders.pkl
├── legacy/
│   └── gradio/
│       ├── autism-dl/
│       └── autism-prediction/
├── Dockerfile.ai
├── requirements.txt
└── main.py
```

## API Endpoints

- POST /api/v1/ai/analyze
- POST /api/v1/diabetes/predict
- POST /api/v1/autism-dl/predict
- POST /api/v1/autism-pred/predict
- POST /api/v1/kidney-disease/predict
- POST /api/v1/report/process
- POST /api/v1/rag/retrieve
- GET /api/v1/autism-pred/categories
- GET /api/v1/health

## Local Run

Standard setup:

```bash
pip install -r requirements.txt
python -m spacy download en_core_web_sm
python -m uvicorn app.main:app --reload --port 8001
```

Current verified local setup for the diabetes integration:

```powershell
cd "D:\Education\Esprit\4 IoSyS\2éme Semester\Machine Learning__4IoSyS1\1. Projet\medical-ai\ai-service"
$env:PYTHONPATH="D:\Education\Esprit\4 IoSyS\2éme Semester\Machine Learning__4IoSyS1\1. Projet\medical-ai\ai-service"
& "..\..\Data Preparation - Copie\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Health check:

```text
GET http://localhost:8000/api/v1/health
```

## Docker Run

From workspace root:

```bash
docker compose up -d --build ai-service
```

## Model Loading Behavior

The loader checks these canonical runtime locations first:

- /models/diabetes/diabetes_decision_tree.joblib
- /models/autism-dl/final_model.h5
- /models/autism-dl/autism-dl.h5
- /models/autism-prediction/best_model.pkl
- /models/autism-prediction/best-model-autism.pkl
- /models/autism-prediction/encoders.pkl
- /models/kidney-disease/kidney_disease_model.pkl

Fallback paths exist for legacy archived locations under legacy folders.

## Optional Dependency Behavior

Some advanced features depend on optional packages:

- RAG uses `faiss`.
- Report NLP can use `spacy`.
- OCR/report extraction can use `pytesseract`, `Pillow`, and `PyPDF2`.

The service now degrades gracefully if these packages are missing:

- Diabetes, autism survey, and kidney prediction can still run.
- RAG returns a not-ready error if FAISS is unavailable.
- Report processing uses regex extraction or returns a clear OCR dependency error.

## Notes

- legacy folders keep old notebooks and Gradio experiments for reference only.
- Production runtime should use app/ + models/ only.
