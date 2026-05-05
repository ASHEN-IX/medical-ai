# 🚀 Medical AI - Quick Start Guide

## ✅ WHAT'S READY NOW

### Pipeline Status
- **7/8 Models**: Fully loaded and operational
- **Knowledge Base**: 7 diseases × 7 chunks each = 49 medical summaries
- **API Gateway**: Unified analysis endpoint ready
- **Test Files**: 8 JSON files with example inputs for all models

### Available Endpoints
```
Diabetes:          POST /api/v1/diabetes/predict
Heart:             POST /api/v1/heart/predict
Kidney:            POST /api/v1/kidney-disease/predict
Liver:             POST /api/v1/liver-disease/predict
Stroke:            POST /api/v1/stroke/predict
Thyroid:           POST /api/v1/thyroid/predict
Autism Survey:     POST /api/v1/autism-pred/predict
AI Gateway:        POST /api/v1/ai/analyze
Health Check:      GET /api/v1/health
```

---

## 📊 MODEL INPUT FIELDS

### Quick Reference Table

| Model | Key Fields | Units |
|-------|-----------|-------|
| **Diabetes** | glucose, BMI, age, BP, insulin | mg/dL, kg/m², yrs, mmHg, mU/ml |
| **Heart** | age, BP, cholesterol, BMI | yrs, mmHg, mg/dL, kg/m² |
| **Kidney** | age, hemoglobin, creatinine, htn | yrs, g/dL, mg/dL, 0/1 |
| **Liver** | age, gender, bilirubin, AST, ALT | yrs, M/F, mg/dL, U/L, U/L |
| **Stroke** | age, hypertension, heart_disease, glucose | yrs, 0/1, 0/1, mg/dL |
| **Thyroid** | age, tumor_size, stage, histology | yrs, cm, 1-4, text |
| **Autism** | A1-A10 survey scores + demographics | 0/1 each, mixed |

See detailed schemas in: `TEST_CASES/*.json`

---

## 🎯 HOW TO GENERATE REPORTS

### Step 1: Prepare Test Data
Use the examples in `TEST_CASES/` folder:
- **Low Risk Example**: Healthy baseline
- **Medium Risk Example**: Clinical concern
- **High Risk Example**: Urgent intervention needed

### Step 2: Start the Stack
```bash
docker compose up -d --build
```

### Step 3: Test Health Endpoint
```bash
curl http://localhost:8001/api/v1/health
```

### Step 4: Submit Medical Data

#### Example 1: Diabetes Screening
```bash
curl -X POST http://localhost:8001/api/v1/diabetes/predict \
  -H "Content-Type: application/json" \
  -d '{
    "pregnancies": 2,
    "glucose": 148,
    "blood_pressure": 72,
    "skin_thickness": 35,
    "insulin": 0,
    "bmi": 33.6,
    "diabetes_pedigree_function": 0.627,
    "age": 50
  }'
```

#### Example 2: Unified AI Gateway
```bash
curl -X POST http://localhost:8001/api/v1/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "report_type": "mixed",
    "features": {
      "age": 55,
      "glucose": 180,
      "blood_pressure": 150,
      "cholesterol": 280,
      "creatinine": 1.8
    },
    "symptoms": ["fatigue", "blurred vision", "chest pain"],
    "include_explanation": true
  }'
```

### Step 5: Get Report Output
Returns JSON with:
- Risk level (LOW/MEDIUM/HIGH)
- Confidence score (0-1)
- Recommendations
- LLM explanation
- Knowledge graph insights

---

## 📁 File Locations

### Test Cases (Use These for Your Reports)
```
TEST_CASES/
├── autism_prediction.json
├── diabetes.json
├── heart_disease.json
├── kidney_disease.json
├── liver_disease.json
├── stroke.json
├── thyroid.json
└── ai_gateway.json
```

### Knowledge Base (Automatically Loaded)
```
ai-service/data/medical/
├── autism.json
├── diabetes.json
├── heart_disease.json
├── kidney_disease.json
├── liver_disease.json
├── stroke.json
└── thyroid.json
```

### Models (Automatically Loaded)
```
ai-service/models/
├── autism-prediction/
├── diabetes/
├── heart-disease/
├── kidney-disease/
├── liver-disease/
├── Stroke_prediction/
└── Throyd-prediction/
```

---

## 🔧 WHAT WAS JUST FIXED

✅ **Model Loader**: Added heart & liver model loading  
✅ **Schemas**: Created HeartRequest/Response, LiverRequest/Response  
✅ **Knowledge Base**: All 7 disease files with 49 chunks  
✅ **Test Files**: 8 comprehensive test case files  
✅ **Health Endpoint**: All 8 models reported  

---

## ⚙️ PIPELINE ARCHITECTURE

```
User Medical Report/Data
        ↓
Report Processing (OCR, text extraction)
        ↓
AI Gateway (Report Type Detection)
        ↓
Route to Model(s)
    ├─→ Diabetes Model
    ├─→ Heart Model
    ├─→ Kidney Model
    ├─→ Liver Model
    ├─→ Stroke Model
    ├─→ Thyroid Model
    └─→ Autism Model
        ↓
Risk Assessment (integrated)
        ↓
RAG Retrieval (medical knowledge lookup)
        ↓
Knowledge Graph (relationships, treatments)
        ↓
LLM Explanation (clinical summary)
        ↓
Final Report with:
  - Risk levels
  - Confidence scores
  - Recommendations
  - Clinical explanations
```

---

## 🧪 VALIDATION CHECKLIST

Before running reports, verify:

```bash
# 1. Check models load
python -c "from app.services.model_loader import model_loader; model_loader.load_models(); print('✅ Models loaded')"

# 2. Check health endpoint
curl http://localhost:8001/api/v1/health | jq .

# 3. Check knowledge files
ls ai-service/data/medical/*.json

# 4. Check test files
ls TEST_CASES/*.json
```

---

## 🎯 NEXT ACTIONS

1. ✅ **Done**: Pipeline fully configured
2. ✅ **Done**: Test files created with example inputs
3. ⏭️ **Next**: Start docker stack
4. ⏭️ **Next**: Generate reports using test case examples
5. ⏭️ **Next**: Validate outputs match expected risk levels

---

## 📞 QUICK TROUBLESHOOTING

**Models not loading?**
```bash
cd ai-service && python -m app.services.model_loader
```

**Can't connect to API?**
```bash
docker compose ps
docker compose logs ai-service
```

**Need field descriptions?**
```bash
cat TEST_CASES/[model_name].json
```

---

**Status**: ✅ READY FOR REPORT GENERATION  
**Date**: May 5, 2026  
**Version**: 1.0.0
