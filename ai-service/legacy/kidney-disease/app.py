"""
Kidney Disease Prediction App - Gradio Interface
Deploys the trained Random Forest model for CKD screening
"""

import gradio as gr
import joblib
import numpy as np
import pandas as pd
import os

# Load model artifacts
MODEL_PATH = "./models/kidney_disease_model.pkl"
SCALER_PATH = "./models/scaler.pkl"
FEATURE_NAMES_PATH = "./models/feature_names.pkl"
LE_PATH = "./models/label_encoder.pkl"

# Check if model files exist
if not all(os.path.exists(p) for p in [MODEL_PATH, SCALER_PATH, FEATURE_NAMES_PATH, LE_PATH]):
    raise FileNotFoundError("❌ Model files not found. Run training.ipynb to generate models.")

# Load artifacts
model = joblib.load(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)
feature_names = joblib.load(FEATURE_NAMES_PATH)
le = joblib.load(LE_PATH)

print("✅ Model and artifacts loaded successfully!")
print(f"Model: Random Forest")
print(f"Features: {len(feature_names)}")


def predict_ckd(age, hemo, sg, al, pcv, sc, htn):
    """
    Predict Chronic Kidney Disease based on 7 key clinical parameters
    
    Args: 
        age: Patient age
        hemo: Hemoglobin level
        sg: Specific gravity (urine)
        al: Albumin/Proteinuria (0-5 scale)
        pcv: Packed cell volume
        sc: Serum creatinine
        htn: Hypertension (0/1)
    
    Returns: Prediction result with confidence score
    """
    
    try:
        # Create full feature set with required dummy values for all 24 original features
        input_data = {
            'age': age,
            'bp': 120,  # default normal
            'sg': sg,
            'al': al,
            'su': 0,  # default no sugar
            'rbc': 1,  # default normal
            'pc': 1,  # default normal
            'pcc': 0,  # default absent
            'ba': 0,  # default absent
            'bgr': 100,  # default normal glucose
            'bu': 25,  # default normal BUN (calculated from al, sc, hemo in interaction)
            'sc': sc,
            'sod': 138,  # default normal sodium
            'pot': 4.5,  # default normal potassium
            'hemo': hemo,
            'pcv': pcv,
            'wc': 1,  # default normal
            'rc': 4.5,  # default normal
            'htn': htn,
            'dm': 0,  # default no diabetes
            'cad': 0,  # default no CAD
            'appet': 1,  # default good appetite
            'pe': 0,  # default no edema
            'ane': 0  # default no anemia
        }
        
        df_input = pd.DataFrame([input_data])
        
        # Apply feature engineering (same as training pipeline)
        df_input['kidney_health_score'] = df_input[['bu', 'sc', 'hemo']].mean(axis=1)
        df_input['sc_bu_ratio'] = df_input['sc'] / (df_input['bu'] + 1e-5)
        df_input['age_sc_interaction'] = df_input['age'] * df_input['sc']
        df_input['age_squared'] = df_input['age'] ** 2
        df_input['high_risk'] = ((df_input['htn'] == 1) & (df_input['dm'] == 1)).astype(int)
        
        # Scale features
        X_scaled = scaler.transform(df_input)
        
        # Make prediction
        prediction = model.predict(X_scaled)[0]
        probability = model.predict_proba(X_scaled)[0]
        confidence = max(probability) * 100
        
        # Format output
        if prediction == 1:
            output = f"🔴 **POSITIVE** - CKD Likely Detected\n\n"
            output += f"**Confidence:** {confidence:.1f}%\n\n"
            output += "⚠️ **Recommendation:** Consult a nephrologist for further evaluation.\n"
            output += "This prediction is for screening purposes only and should not replace clinical diagnosis."
        else:
            output = f"🟢 **NEGATIVE** - No CKD Detected\n\n"
            output += f"**Confidence:** {confidence:.1f}%\n\n"
            output += "✅ Patient appears to have healthy kidney function.\n"
            output += "Regular check-ups recommended for ongoing monitoring."
        
        pred_label = "CKD" if prediction == 1 else "NOT CKD"
        return output, f"{pred_label} ({confidence:.1f}%)"
    
    except Exception as e:
        return f"❌ Error in prediction: {str(e)}", "ERROR"


# Create Gradio Interface
with gr.Blocks(title="Kidney Disease Prediction") as app:
    
    gr.Markdown("""
    # 🏥 Kidney Disease (CKD) Prediction System
    
    **Quick Screening Tool** - Based on 7 essential clinical markers  
    Uses a Random Forest model with 97.5% accuracy
    
    ⚠️ **DISCLAIMER**: This is a screening tool only. Always consult healthcare professionals for diagnosis.
    """)
    
    with gr.Row():
        with gr.Group():
            gr.Markdown("### 📊 Patient Data (7 Key Indicators)")
            age = gr.Number(label="Age (years)", value=45, minimum=0, maximum=120)
            hemo = gr.Number(label="Hemoglobin (g/dL)", value=13, minimum=0, maximum=20)
            sg = gr.Number(label="Specific Gravity", value=1.020, minimum=1.000, maximum=1.030)
            al = gr.Slider(label="Albumin/Proteinuria (0-5)", value=0, minimum=0, maximum=5, step=1)
            pcv = gr.Number(label="Packed Cell Volume (%)", value=40, minimum=0, maximum=60)
            sc = gr.Number(label="Serum Creatinine (mg/dL)", value=1.2, minimum=0, maximum=10)
            htn = gr.Radio(label="Hypertension (HTN)", choices=["No (0)", "Yes (1)"], value="No (0)")
    
    submit_btn = gr.Button("🔍 Analyze Patient", variant="primary", size="lg")
    
    with gr.Row():
        output_text = gr.Markdown("Results will appear here")
    
    with gr.Row():
        output_label = gr.Label("Prediction Result")
    
    # Convert radio value to int
    def convert_inputs(age, hemo, sg, al, pcv, sc, htn):
        htn_val = 1 if "Yes" in htn else 0
        return predict_ckd(age, hemo, sg, al, pcv, sc, htn_val)
    
    submit_btn.click(
        fn=convert_inputs,
        inputs=[age, hemo, sg, al, pcv, sc, htn],
        outputs=[output_text, output_label]
    )
    
    gr.Markdown("""
    ---
    
    ### 📊 Model Information
    - **Algorithm**: Random Forest Classifier
    - **Test Accuracy**: 97.5%
    - **Training Samples**: 320 patients
    - **Test Samples**: 80 patients
    - **Features Used**: 29 (including engineered features)
    - **Cross-Validation Score**: 96.25% ± 3.3%
    
    ### 🎯 Key Predictors
    Top 5 most important features for CKD detection:
    1. Hemoglobin (blood protein)
    2. Specific Gravity (urine concentration)
    3. Albumin (protein in urine)
    4. Packed Cell Volume (blood cell ratio)
    5. Serum Creatinine (kidney waste marker)
    
    ### ⚕️ Clinical Notes
    - High values for BUN, Creatinine, and low Hemoglobin suggest CKD
    - Proteinuria (Albumin in urine) is a strong CKD indicator
    - This tool supports clinical decision-making, not replacement
    """)


if __name__ == "__main__":
    print("\n" + "="*70)
    print("🚀 Starting Kidney Disease Prediction App")
    print("="*70)
    print("\n📍 Access the app at: http://localhost:7860")
    print("\nType Ctrl+C to stop the server\n")
    
    app.launch(share=False, server_name="0.0.0.0", server_port=7860, theme=gr.themes.Soft())
