# Medical AI Test Cases - Complete Reference

**Created**: May 5, 2026  
**Purpose**: Exact field specifications and example payloads for all medical prediction models

---

## 📋 FILE STRUCTURE

Each test case file contains:
```json
{
  "model": "Model name",
  "endpoint": "REST endpoint",
  "description": "What the model does",
  "fields": { "detailed specifications" },
  "example_low_risk": { "healthy person data" },
  "example_medium_risk": { "clinical concern data" },
  "example_high_risk": { "urgent intervention data" }
}
```

---

## 🧬 DISEASE-SPECIFIC FIELDS

### 1. AUTISM PREDICTION
**File**: `TEST_CASES/autism_prediction.json`  
**Endpoint**: `POST /api/v1/autism-pred/predict`

**Survey Component** (M-CHAT - Modified Checklist for Autism in Toddlers):
- A1_Score through A10_Score (each 0 or 1)
- Based on behavioral observations

**Demographics Component**:
- gender (m/f)
- age (in months)
- ethnicity
- jaundice history (0/1)
- relation to child (Parent, Self, etc)
- autism in family (0/1)
- used app before (0/1)

**Example Usage**:
```bash
curl -X POST http://localhost:8001/api/v1/autism-pred/predict \
  -H "Content-Type: application/json" \
  -d '{
    "responses": {
      "A1_Score": 0, "A2_Score": 0, "A3_Score": 0, "A4_Score": 0, "A5_Score": 0,
      "A6_Score": 0, "A7_Score": 0, "A8_Score": 0, "A9_Score": 0, "A10_Score": 0
    },
    "demographics": {
      "gender": "m", "age": 24, "ethnicity": "White-European",
      "jaundice": 0, "relation": "Parent", "austim": 0, "used_app_before": 0
    }
  }'
```

---

### 2. DIABETES MELLITUS
**File**: `TEST_CASES/diabetes.json`  
**Endpoint**: `POST /api/v1/diabetes/predict`

**Input Fields** (8 required):
1. **pregnancies**: Integer (0-20) - Number of pregnancies
2. **glucose**: Float (0-250 mg/dL) - Blood glucose 2h after OGTT
3. **blood_pressure**: Float (0-140 mmHg) - Diastolic BP
4. **skin_thickness**: Float (0-100 mm) - Triceps skin fold
5. **insulin**: Float (0-900 mU/ml) - 2-hour serum insulin
6. **bmi**: Float (0-70 kg/m²) - Body mass index
7. **diabetes_pedigree_function**: Float (0-3) - Genetic factor
8. **age**: Integer (1-120 years) - Age

**Example Usage**:
```bash
curl -X POST http://localhost:8001/api/v1/diabetes/predict \
  -H "Content-Type: application/json" \
  -d '{
    "pregnancies": 2, "glucose": 148, "blood_pressure": 72,
    "skin_thickness": 35, "insulin": 150, "bmi": 31.0,
    "diabetes_pedigree_function": 0.5, "age": 45
  }'
```

**Risk Levels**:
- **LOW**: glucose <100, BMI <25, no family history
- **MEDIUM**: glucose 100-150, BMI 25-35, possible family history
- **HIGH**: glucose >150, BMI >35, strong family history

---

### 3. HEART DISEASE
**File**: `TEST_CASES/heart_disease.json`  
**Endpoint**: `POST /api/v1/heart/predict`

**Input Fields** (4 required):
1. **age**: Integer (1-120 years)
2. **blood_pressure**: Float (0-300 mmHg) - Systolic BP
3. **cholesterol**: Float (0-600 mg/dL) - Total serum cholesterol
4. **bmi**: Float (10-60 kg/m²)

**Example Usage**:
```bash
curl -X POST http://localhost:8001/api/v1/heart/predict \
  -H "Content-Type: application/json" \
  -d '{
    "age": 50, "blood_pressure": 140,
    "cholesterol": 240, "bmi": 28.0
  }'
```

**Risk Levels**:
- **LOW**: age <40, BP <120, cholesterol <200, BMI <25
- **MEDIUM**: age 40-60, BP 120-160, cholesterol 200-300, BMI 25-30
- **HIGH**: age >60, BP >160, cholesterol >300, BMI >30

---

### 4. KIDNEY DISEASE
**File**: `TEST_CASES/kidney_disease.json`  
**Endpoint**: `POST /api/v1/kidney-disease/predict`

**Input Fields** (7 required):
1. **age**: Float (0-120 years)
2. **hemo**: Float (0-25 g/dL) - Hemoglobin
3. **sg**: Float (1.0-1.05) - Urine specific gravity
4. **al**: Integer (0-5) - Albumin level
5. **pcv**: Float (0-60%) - Packed cell volume/hematocrit
6. **sc**: Float (0-20 mg/dL) - Serum creatinine
7. **htn**: Integer (0/1) - Hypertension

**Example Usage**:
```bash
curl -X POST http://localhost:8001/api/v1/kidney-disease/predict \
  -H "Content-Type: application/json" \
  -d '{
    "age": 45.0, "hemo": 11.5, "sg": 1.015, "al": 1,
    "pcv": 38.0, "sc": 1.5, "htn": 1
  }'
```

**Risk Levels**:
- **LOW**: age <30, hemo >12, sg >1.01, al=0, sc <0.8, htn=0
- **MEDIUM**: age 30-60, hemo 10-12, sg 1.01-1.02, al=1, sc 1-2, htn=1
- **HIGH**: age >60, hemo <8, sg <1.01, al>2, sc >3, htn=1

---

### 5. LIVER DISEASE
**File**: `TEST_CASES/liver_disease.json`  
**Endpoint**: `POST /api/v1/liver-disease/predict`

**Input Fields** (10 fields, some optional):
1. **age**: Integer (1-120 years)
2. **gender**: String (M/F/Male/Female/m/f)
3. **total_bilirubin**: Float (0-30 mg/dL)
4. **direct_bilirubin**: Float (0-20 mg/dL)
5. **alkaline_phosphotase**: Float (0-1500 U/L)
6. **alanine_aminotransferase**: Float (0-2000 U/L) - ALT/SGPT
7. **aspartate_aminotransferase**: Float (0-5000 U/L) - AST/SGOT
8. **total_protiens**: Float (0-10 g/dL) - Optional
9. **albumin**: Float (0-6 g/dL)
10. **albumin_and_globulin_ratio**: Float (0-3) - Optional

**Example Usage**:
```bash
curl -X POST http://localhost:8001/api/v1/liver-disease/predict \
  -H "Content-Type: application/json" \
  -d '{
    "age": 50, "gender": "F", "total_bilirubin": 1.2,
    "direct_bilirubin": 0.4, "alkaline_phosphotase": 100,
    "alanine_aminotransferase": 80, "aspartate_aminotransferase": 85,
    "total_protiens": 7.0, "albumin": 3.8,
    "albumin_and_globulin_ratio": 1.0
  }'
```

**Risk Levels**:
- **LOW**: bilirubin <0.8, ALT <35, AST <35, albumin >4
- **MEDIUM**: bilirubin 0.8-2, ALT 35-100, AST 35-100, albumin 3.5-4
- **HIGH**: bilirubin >2, ALT >100, AST >150, albumin <3

---

### 6. STROKE PREDICTION
**File**: `TEST_CASES/stroke.json`  
**Endpoint**: `POST /api/v1/stroke/predict`

**Input Fields** (8 required):
1. **age**: Float (0-120 years)
2. **hypertension**: Integer (0/1) - History of hypertension
3. **heart_disease**: Integer (0/1) - History of heart disease
4. **bmi**: Float (0-60 kg/m²)
5. **ever_married**: String (Yes/No)
6. **work_type**: String (Self-employed/children/Private/Govt_job/Never_worked)
7. **smoking_status**: String (Unknown/formerly smoked/never smoked/smokes)
8. **avg_glucose_level**: Float (0-300 mg/dL)

**Example Usage**:
```bash
curl -X POST http://localhost:8001/api/v1/stroke/predict \
  -H "Content-Type: application/json" \
  -d '{
    "age": 55, "hypertension": 1, "heart_disease": 0, "bmi": 28.5,
    "ever_married": "Yes", "work_type": "Private",
    "smoking_status": "formerly smoked", "avg_glucose_level": 130
  }'
```

**Risk Levels**:
- **LOW**: age <45, htn=0, heart_disease=0, bmi <25, glucose <100, nonsmoker
- **MEDIUM**: age 45-65, htn=1, bmi 25-30, glucose 100-150, former smoker
- **HIGH**: age >65, htn=1, heart_disease=1, bmi >30, glucose >150, current smoker

---

### 7. THYROID CANCER RECURRENCE
**File**: `TEST_CASES/thyroid.json`  
**Endpoint**: `POST /api/v1/thyroid/predict`

**Input Fields** (Flexible - accepts any clinical markers):
- age, gender, tumor_size, radiation_dose, stage, histology
- lymph_node_involvement, distant_metastasis, tsh_level, thyroglobulin_level
- Any other thyroid-specific fields

**Note**: Schema accepts extra fields (model_config = ConfigDict(extra='allow'))

**Example Usage**:
```bash
curl -X POST http://localhost:8001/api/v1/thyroid/predict \
  -H "Content-Type: application/json" \
  -d '{
    "age": 55, "gender": "M", "tumor_size": 3.0,
    "radiation_dose": 150, "stage": 2, "histology": "Follicular",
    "lymph_node_involvement": 1, "distant_metastasis": 0
  }'
```

**Risk Levels**:
- **LOW**: stage 1, size <2cm, papillary, no node involvement, no metastasis
- **MEDIUM**: stage 2, size 2-4cm, follicular, lymph node involvement, no metastasis
- **HIGH**: stage 4, size >4cm, anaplastic, extensive involvement, distant metastasis

---

### 8. AI GATEWAY (UNIFIED)
**File**: `TEST_CASES/ai_gateway.json`  
**Endpoint**: `POST /api/v1/ai/analyze`

**Request Parameters**:
```json
{
  "report_type": "auto|diabetes|heart|kidney|stroke|autism|mixed",
  "features": { "clinical markers as key-value pairs" },
  "raw_text": "OCR extracted text from report (optional)",
  "include_explanation": true|false,
  "symptoms": ["symptom1", "symptom2"],
  "image": "base64 encoded image (optional)"
}
```

**Example Diabetes Screening**:
```bash
curl -X POST http://localhost:8001/api/v1/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "report_type": "diabetes",
    "features": {
      "glucose": 180, "bmi": 32.5, "age": 55
    },
    "symptoms": ["excessive thirst", "frequent urination"],
    "include_explanation": true
  }'
```

**Example Multi-Disease Analysis**:
```bash
curl -X POST http://localhost:8001/api/v1/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "report_type": "mixed",
    "features": {
      "age": 58, "blood_pressure": 160, "glucose": 200,
      "creatinine": 1.8, "bmi": 35
    },
    "symptoms": ["fatigue", "blurred vision", "chest pain"],
    "include_explanation": true
  }'
```

**Response Includes**:
- Individual model predictions
- Risk assessment across all models
- LLM-generated clinical explanation
- RAG context from knowledge base
- Knowledge graph insights
- Recommended next steps

---

## 🎯 USAGE WORKFLOW

### Step 1: Choose Your Test Case
```bash
cd TEST_CASES
cat [model]_disease.json  # View test case
```

### Step 2: Extract Example Data
```bash
# Copy the example_low_risk / example_medium_risk / example_high_risk object
```

### Step 3: Submit to Endpoint
```bash
curl -X POST http://localhost:8001/api/v1/[endpoint] \
  -H "Content-Type: application/json" \
  -d '{your_test_data}'
```

### Step 4: Collect Response
Response will include:
- `risk_level`: LOW / MEDIUM / HIGH
- `probability`: 0.0 - 1.0
- `confidence_score`: 0.0 - 1.0
- `recommendations`: Clinical recommendations
- `class_probabilities`: Detailed breakdown

---

## 📊 EXAMPLE RESPONSE

```json
{
  "success": true,
  "request_id": "req_uuid",
  "model": "diabetes",
  "risk_level": "MEDIUM",
  "is_diabetic": true,
  "probability": 0.72,
  "confidence_score": 0.85,
  "diabetes_probability": 0.72,
  "class_probabilities": {
    "non_diabetic": 0.28,
    "diabetic": 0.72
  },
  "recommendations": [
    "Recommend glucose monitoring",
    "Lifestyle modifications",
    "Follow-up in 3 months"
  ],
  "metadata": {
    "model_version": "1.0.0",
    "processing_time_ms": 45,
    "timestamp": "2026-05-05T14:30:00Z"
  }
}
```

---

## ✅ VALIDATION CHECKLIST

Before using test cases:

- [ ] Docker stack is running: `docker compose ps`
- [ ] Health endpoint responds: `curl http://localhost:8001/api/v1/health`
- [ ] Model JSON files are valid: `cat TEST_CASES/*.json`
- [ ] API is accessible: `curl http://localhost:8001/health`

---

## 🔗 CROSS-REFERENCE

| Need | Reference |
|------|-----------|
| Quick overview | [QUICK_START.md](QUICK_START.md) |
| Full details | [PIPELINE_STATUS_REPORT.md](PIPELINE_STATUS_REPORT.md) |
| API reference | Each file in `TEST_CASES/` |
| Architecture | See ARCHITECTURE.md |
| Deployment | See docker-compose.yml |

---

**Created**: May 5, 2026  
**Status**: ✅ READY FOR REPORT GENERATION  
**Total Models**: 7 active + 1 (autism_dl - TensorFlow optional)  
**Test Cases**: 8 files with 3 risk levels each
