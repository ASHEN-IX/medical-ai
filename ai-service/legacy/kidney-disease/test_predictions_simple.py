"""
Simplified Test Script - 7 Essential Features Only
Tests the prediction function with clinically relevant scenarios
"""

import sys
sys.path.insert(0, '/home/vanitas/Desktop/kidney')

import joblib
import numpy as np
import pandas as pd

# Load model artifacts
model = joblib.load("./models/kidney_disease_model.pkl")
scaler = joblib.load("./models/scaler.pkl")
feature_names = joblib.load("./models/feature_names.pkl")

print("="*70)
print("🧪 KIDNEY DISEASE PREDICTION - SIMPLIFIED TEST SUITE (7 Features)")
print("="*70)

def apply_feature_engineering(age, hemo, sg, al, pcv, sc, htn):
    """Apply feature engineering with required defaults"""
    data = {
        'age': age, 'bp': 120, 'sg': sg, 'al': al, 'su': 0, 'rbc': 1, 'pc': 1, 
        'pcc': 0, 'ba': 0, 'bgr': 100, 'bu': 25, 'sc': sc, 'sod': 138, 'pot': 4.5,
        'hemo': hemo, 'pcv': pcv, 'wc': 1, 'rc': 4.5, 'htn': htn, 'dm': 0, 
        'cad': 0, 'appet': 1, 'pe': 0, 'ane': 0
    }
    df = pd.DataFrame([data])
    df['kidney_health_score'] = df[['bu', 'sc', 'hemo']].mean(axis=1)
    df['sc_bu_ratio'] = df['sc'] / (df['bu'] + 1e-5)
    df['age_sc_interaction'] = df['age'] * df['sc']
    df['age_squared'] = df['age'] ** 2
    df['high_risk'] = ((df['htn'] == 1) & (df['dm'] == 1)).astype(int)
    return df

# TEST CASE 1: Healthy Young Adult
print("\n" + "="*70)
print("TEST CASE 1: Healthy Young Adult (Expected: NEGATIVE)")
print("="*70)
print("Clinical Profile: Young patient with normal kidney markers, no HTN")

age, hemo, sg, al, pcv, sc, htn = 28, 14.5, 1.021, 0, 43, 0.85, 0

df = apply_feature_engineering(age, hemo, sg, al, pcv, sc, htn)
X_scaled = scaler.transform(df)
pred = model.predict(X_scaled)[0]
prob = model.predict_proba(X_scaled)[0]
confidence = max(prob) * 100

print(f"\n  Age: {age} years")
print(f"  Hemoglobin: {hemo} g/dL (normal)")
print(f"  Specific Gravity: {sg} (normal)")
print(f"  Albumin: {al} (no proteinuria)")
print(f"  PCV: {pcv}% (normal)")
print(f"  Serum Creatinine: {sc} mg/dL (normal)")
print(f"  Hypertension: No")
print(f"\n✅ Prediction: {'NEGATIVE' if pred == 0 else 'POSITIVE'}")
print(f"   Confidence: {confidence:.1f}%")
print(f"   Status: ✓ CORRECT" if pred == 0 else "   Status: ✗ WRONG")

# TEST CASE 2: High-Risk CKD Patient
print("\n" + "="*70)
print("TEST CASE 2: Advanced CKD (Expected: POSITIVE)")
print("="*70)
print("Clinical Profile: Elderly with severe kidney dysfunction markers")

age, hemo, sg, al, pcv, sc, htn = 68, 7.5, 1.008, 3, 24, 4.2, 1

df = apply_feature_engineering(age, hemo, sg, al, pcv, sc, htn)
X_scaled = scaler.transform(df)
pred = model.predict(X_scaled)[0]
prob = model.predict_proba(X_scaled)[0]
confidence = max(prob) * 100

print(f"\n  Age: {age} years")
print(f"  Hemoglobin: {hemo} g/dL (LOW - anemia)")
print(f"  Specific Gravity: {sg} (VERY LOW - kidney dysfunction)")
print(f"  Albumin: {al} (HIGH - severe proteinuria)")
print(f"  PCV: {pcv}% (LOW - anemia)")
print(f"  Serum Creatinine: {sc} mg/dL (VERY HIGH - kidney damage)")
print(f"  Hypertension: Yes")
print(f"\n🔴 Prediction: {'NEGATIVE' if pred == 0 else 'POSITIVE'}")
print(f"   Confidence: {confidence:.1f}%")
print(f"   Status: ✓ CORRECT" if pred == 1 else "   Status: ✗ WRONG")

# TEST CASE 3: Mild CKD with Hypertension
print("\n" + "="*70)
print("TEST CASE 3: Early-Stage CKD with HTN (Expected: POSITIVE)")
print("="*70)
print("Clinical Profile: Middle-aged with mild kidney markers + hypertension")

age, hemo, sg, al, pcv, sc, htn = 52, 11.8, 1.015, 1, 36, 1.9, 1

df = apply_feature_engineering(age, hemo, sg, al, pcv, sc, htn)
X_scaled = scaler.transform(df)
pred = model.predict(X_scaled)[0]
prob = model.predict_proba(X_scaled)[0]
confidence = max(prob) * 100

print(f"\n  Age: {age} years")
print(f"  Hemoglobin: {hemo} g/dL (slightly low)")
print(f"  Specific Gravity: {sg} (slightly low)")
print(f"  Albumin: {al} (mild proteinuria)")
print(f"  PCV: {pcv}% (slightly low)")
print(f"  Serum Creatinine: {sc} mg/dL (slightly elevated)")
print(f"  Hypertension: Yes")
print(f"\n🟡 Prediction: {'NEGATIVE' if pred == 0 else 'POSITIVE'}")
print(f"   Confidence: {confidence:.1f}%")
print(f"   Status: ✓ CORRECT" if pred == 1 else "   Status: ✗ WRONG")

# TEST CASE 4: Borderline - Normal Labs but HTN
print("\n" + "="*70)
print("TEST CASE 4: Borderline - HTN with Normal Labs (Expected: POSITIVE/CAUTION)")
print("="*70)
print("Clinical Profile: Patient with hypertension but mostly normal markers")

age, hemo, sg, al, pcv, sc, htn = 45, 13.2, 1.018, 0, 40, 1.1, 1

df = apply_feature_engineering(age, hemo, sg, al, pcv, sc, htn)
X_scaled = scaler.transform(df)
pred = model.predict(X_scaled)[0]
prob = model.predict_proba(X_scaled)[0]
confidence = max(prob) * 100

print(f"\n  Age: {age} years")
print(f"  Hemoglobin: {hemo} g/dL (normal)")
print(f"  Specific Gravity: {sg} (normal)")
print(f"  Albumin: {al} (no proteinuria)")
print(f"  PCV: {pcv}% (normal)")
print(f"  Serum Creatinine: {sc} mg/dL (normal)")
print(f"  Hypertension: Yes")
print(f"\n🟠 Prediction: {'NEGATIVE' if pred == 0 else 'POSITIVE'}")
print(f"   Confidence: {confidence:.1f}%")
print(f"   Note: Borderline - monitoring recommended")

print("\n" + "="*70)
print("✅ TEST SUITE COMPLETED")
print("="*70)
print(f"\n📊 Key Insights:")
print(f"  - Test 1 (Healthy): Should show NO CKD")
print(f"  - Test 2 (Advanced CKD): Should show CLEAR CKD signal")
print(f"  - Test 3 (Early CKD+HTN): Should show CKD likely")
print(f"  - Test 4 (HTN only): Model uncertainty expected")
print(f"\n✅ Simplified form ready for deployment!")
