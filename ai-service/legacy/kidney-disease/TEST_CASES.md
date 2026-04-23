# 🏥 Kidney Disease Prediction App - TEST CASES (Simplified)

## Quick Start

### 1. Export Model (Notebook)
Run the last cell in `notebooks/training.ipynb` to export the trained Random Forest model and artifacts.

### 2. Start the Gradio App
```bash
cd /home/vanitas/Desktop/kidney
source .venv/bin/activate
python3 app.py
```

The app will be available at: **http://localhost:7860**

### 3. Run Test Suite (Simplified)
```bash
python3 test_predictions_simple.py
```

---

## 📋 Simplified Form - 7 Essential Fields

The app uses only **7 clinically significant features** that account for 80% of CKD prediction:

1. **Age** (years) - Required for age-creatinine interactions
2. **Hemoglobin** (g/dL) - 16.3% importance | **Key predictor of kidney anemia**
3. **Specific Gravity** (1.0-1.03) - 16.3% importance | **Urine concentration indicator**
4. **Albumin** (0-5 scale) - 11.8% importance | **Proteinuria is major CKD marker**
5. **Packed Cell Volume (%)** - 11.4% importance | **Blood cell ratio**
6. **Serum Creatinine** (mg/dL) - 10.2% importance | **Primary kidney function marker**
7. **Hypertension** (Yes/No) - 5.0% importance | **Major CKD risk factor**

---

## Test Cases for Manual Testing

### ✅ TEST CASE 1: Healthy Young Adult (Expected: NEGATIVE)
**Clinical Profile:** Young patient with normal kidney markers, no hypertension

| Field | Value | Clinical Significance |
|-------|-------|----------------------|
| **Age** | 28 | Young (low risk) |
| **Hemoglobin** | 14.5 | Normal (high is good) |
| **Specific Gravity** | 1.021 | Normal range |
| **Albumin** | 0 | No proteinuria ✓ |
| **Packed Cell Volume** | 43 | Normal blood cell ratio |
| **Serum Creatinine** | 0.85 | Normal kidney function ✓ |
| **Hypertension** | No | No HTN risk |

**Expected Output:** 🟢 **NEGATIVE** (89-91% confidence)  
**Why:** All normal values indicate healthy kidneys; no disease markers present

---

### 🔴 TEST CASE 2: Advanced CKD (Expected: POSITIVE)
**Clinical Profile:** Elderly patient with severe kidney dysfunction markers

| Field | Value | Clinical Significance |
|-------|-------|----------------------|
| **Age** | 68 | Older (higher baseline risk) |
| **Hemoglobin** | 7.5 | **LOW** - kidney anemia ⚠️ |
| **Specific Gravity** | 1.008 | **VERY LOW** - kidney loss of function ⚠️ |
| **Albumin** | 3 | **HIGH** - severe proteinuria ⚠️ |
| **Packed Cell Volume** | 24 | **LOW** - secondary anemia ⚠️ |
| **Serum Creatinine** | 4.2 | **VERY HIGH** - severe kidney damage ⚠️ |
| **Hypertension** | Yes | Major CKD risk factor |

**Expected Output:** 🔴 **POSITIVE** (99-100% confidence)  
**Why:** Multiple severe kidney dysfunction markers; clear CKD Stage 4-5 indicators

---

### 🔴 TEST CASE 2: CKD Patient - HIGH RISK ❌ (Expected: POSITIVE)
**Clinical Scenario:** Elderly patient with multiple CKD risk factors and clear disease markers

| Parameter | Value | Clinical Meaning |
|-----------|-------|------------------|
| **Age** | 65 | Older patient (higher risk) |
| **Blood Pressure** | 160 | High (hypertensive) |
| **Specific Gravity** | 1.010 | Very low - kidney malfunction |
| **Albumin** | 2 | **HIGH** - proteinuria (major CKD marker) |
| **Blood Sugar** | 1 | Sugar in urine (diabetic) |
| **RBC Classification** | Abnormal | **Abnormal RBCs** |
| **WBC Classification** | Abnormal | **Abnormal white cells** |
| **Pus Cells** | Abnormal | Infection/inflammation |
| **Pus Cell Clumps** | Present | **Strong infection indicator** |
| **Bacteria** | Present | **Urinary tract infection** |
| **BUN** | 90 | **VERY HIGH** - kidney dysfunction |
| **Serum Creatinine** | 3.5 | **VERY HIGH** - severe kidney damage |
| **Sodium** | 132 | Low - kidney dysfunction |
| **Potassium** | 6.5 | **HIGH** - kidneys can't filter |
| **Hemoglobin** | 8 | **VERY LOW** - anemia from kidney disease |
| **PCV** | 25 | **LOW** - anemia |
| **Hypertension** | Yes | **Major CKD risk** |
| **Diabetes** | Yes | **Major CKD risk** |
| **CAD** | Yes | Cardiovascular complication |
| **Appetite** | Poor | Disease symptom |
| **Pedal Edema** | Yes | **Fluid retention** - kidney failure sign |
| **Anemia** | Yes | **Kidney-induced anemia** |

**Expected Output:** 🔴 POSITIVE (~100% confidence)
**Clinical Interpretation:** Clear CKD Stage 4-5 indicators. Immediate nephrologist referral needed.

---

### 🟡 TEST CASE 3: Early-Stage CKD with HTN (Expected: POSITIVE)
**Clinical Profile:** Middle-aged with mild kidney markers + hypertension

| Field | Value | Clinical Significance |
|-------|-------|----------------------|
| **Age** | 52 | Middle-aged (moderate risk) |
| **Hemoglobin** | 11.8 | **Slightly LOW** - mild anemia ⚠️ |
| **Specific Gravity** | 1.015 | **Slightly LOW** - early kidney changes ⚠️ |
| **Albumin** | 1 | **Mild proteinuria** - early CKD indicator ⚠️ |
| **Packed Cell Volume** | 36 | **Slightly LOW** - anemia |
| **Serum Creatinine** | 1.9 | **Elevated** - kidney function declining ⚠️ |
| **Hypertension** | Yes | Major CKD risk factor |

**Expected Output:** 🟡 **POSITIVE** (99-100% confidence)  
**Why:** Combination of HTN + mild kidney dysfunction markers = early CKD (Stage 1-2)  
**Action:** Requires monitoring and management with lifestyle modifications

---

### 🟠 TEST CASE 4: Borderline - HTN with Normal Labs (Expected: POSITIVE - CAUTION)
**Clinical Profile:** Patient with hypertension but mostly normal kidney markers

| Field | Value | Clinical Significance |
|-------|-------|----------------------|
| **Age** | 45 | Younger middle-aged |
| **Hemoglobin** | 13.2 | Normal |
| **Specific Gravity** | 1.018 | Normal range |
| **Albumin** | 0 | No proteinuria |
| **Packed Cell Volume** | 40 | Normal |
| **Serum Creatinine** | 1.1 | Normal-to-slightly-low |
| **Hypertension** | Yes | Major risk factor (only abnormality) |

**Expected Output:** 🟠 **POSITIVE** (56-57% confidence - BORDERLINE)  
**Why:** HTN alone is risk factor; model shows uncertainty with normal labs  
**Action:** Close monitoring recommended; periodic kidney function testing; aggressive HTN management

---

## Model Performance

| Metric | Score |
|--------|-------|
| **Test Accuracy** | 97.5% |
| **Precision** | 100% |
| **Recall** | 96% |
| **False Negatives** | 4% |

---

## Key Clinical Features (by importance)

| # | Feature | Importance | Clinical Meaning |
|---|---------|-----------|-----------------|
| 1 | Hemoglobin | 16.3% | Kidney anemia indicator |
| 2 | Specific Gravity | 16.3% | Urine concentration/kidney function |
| 3 | Albumin | 11.8% | Proteinuria = most specific CKD marker |
| 4 | PCV | 11.4% | Blood cell ratio (secondary anemia) |
| 5 | Serum Creatinine | 10.2% | PRIMARY kidney function marker |
| 6 | Age × SC (interaction) | 8% | Age-related creatinine sensitivity |
| 7 | Hypertension | 5% | Major CKD risk factor |

**Total:** These 7 features account for **80%** of predictive power  
Remaining fields: Less than 1% individual importance

---

## Quick Reference - Normal Ranges

| Parameter | Normal Range | CKD Signal | Units |
|-----------|-------------|-----------|-------|
| **Age** | 18-80 | - | Years |
| **Hemoglobin** | 12-17 | < 10 | g/dL |
| **Specific Gravity** | 1.015-1.025 | < 1.010 | Ratio |
| **Albumin** | 0 (absent) | > 1 (present) | 0-5 scale |
| **PCV** | 37-47 | < 32 | % |
| **Serum Creatinine** | 0.7-1.3 | > 1.5 | mg/dL |
| **HTN** | No (0) | Yes (1) | Binary |

---

## Testing on Simplified App

**For each test case, enter the 7 values in the form:**

1. Click on each input field
2. Enter value (or use slider for Albumin)
3. Select HTN status (Yes/No radio button)
4. Click **"🔍 Analyze Patient"**
5. View result in seconds

**Time per prediction:** ~2-5 seconds processing
**Confidence display:** 0-100%

---

## Troubleshooting

### App Won't Start
```bash
pip install gradio scikit-learn joblib pandas numpy
```

### Model Files Not Found
Run the export cell in `notebooks/training.ipynb`

### Port in Use
```bash
python3 app.py  # Check terminal; default ports shift automatically
```

---

## Clinical Use Guidelines

✅ **USE:** Preliminary CKD screening  
✅ **USE:** Risk assessment in primary care  
✅ **USE:** Patient education about kidney health  

❌ **DON'T:** Use alone for diagnosis  
❌ **DON'T:** Replace clinical labs/biopsy  
❌ **DON'T:** Delay specialist referral based on negative result if symptomatic  

---

## False Negative Risk

⚠️ **4% miss rate** on test set (2 CKD cases out of 50)

**If positive result:** High confidence (usually >95%) - recommend swift referral  
**If negative result:** Consider clinical presentation; some early-stage CKD may not trigger

**Recommendation:** Follow-up labs annually if HTN or DM present, regardless of screening result

---

## Next Steps

1. **Run app.py** - Start web interface
2. **Test Cases 1-4** - Verify predictions match expected outputs
3. **Try real patient data** - See how model responds
4. **Integration** - Could deploy to web server, mobile app, or hospital system

---

## Questions?

Technical questions → Check [app.py](app.py) and [test_predictions_simple.py](test_predictions_simple.py)  
Model details → See [training.ipynb](notebooks/training.ipynb)  
Data info → See [exploration.ipynb](notebooks/exploration.ipynb)
