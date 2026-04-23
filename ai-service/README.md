# ai-service

Production FastAPI service for autism prediction models.

## What This Service Does

- Serves Deep Learning vision predictions for autism detection.
- Serves survey-based ML autism risk predictions.
- Loads models once at startup.
- Exposes typed API endpoints for backend integration.

## Clean Folder Layout

```text
ai-service/
├── app/
│   ├── main.py
│   ├── api/
│   │   └── routes/
│   │       ├── autism_dl.py
│   │       └── autism_prediction.py
│   ├── models/
│   │   └── schemas.py
│   └── services/
│       ├── autism_dl_service.py
│       ├── autism_prediction_service.py
│       └── model_loader.py
├── models/
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

- POST /api/v1/autism-dl/predict
- POST /api/v1/autism-pred/predict
- GET /api/v1/autism-pred/categories
- GET /api/v1/health

## Local Run

```bash
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8001
```

## Docker Run

From workspace root:

```bash
docker compose up -d --build ai-service
```

## Model Loading Behavior

The loader checks these canonical runtime locations first:

- /models/autism-dl/final_model.h5
- /models/autism-prediction/best_model.pkl
- /models/autism-prediction/encoders.pkl

Fallback paths exist for legacy archived locations under legacy/gradio.

## Notes

- legacy/gradio keeps old notebooks and Gradio experiments for reference only.
- Production runtime should use app/ + models/ only.
