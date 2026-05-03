"""
Heart Disease Risk Predictor — Enhanced Gradio UI
Fixes vs original:
  - fbs / exang now correctly converted to int (were silently wrong as strings)
  - Visual probability bar chart with colour-coded risk level
  - Medical reference ranges shown in info tooltips
  - Input validation with clear error messages
  - Soft theme + custom CSS for a polished look
"""

import gradio as gr
import joblib
import pandas as pd
import numpy as np
import os

# ── Load models ──────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
preprocessor = joblib.load(os.path.join(BASE_DIR, "exported_models", "preprocessor.joblib"))
model        = joblib.load(os.path.join(BASE_DIR, "exported_models", "xgboost_model.joblib"))

# ── Risk labels ──────────────────────────────────────────────────────────────
RISK_LABELS = {
    0: ("🟢 Faible risque",     "#27ae60"),
    1: ("🟡 Risque léger",      "#f39c12"),
    2: ("🟠 Risque modéré",     "#e67e22"),
    3: ("🔴 Risque élevé",      "#e74c3c"),
    4: ("🔴 Risque très élevé", "#c0392b"),
}

# ── Prediction function ───────────────────────────────────────────────────────
def predict(age, sex, cp, trestbps, chol, fbs, restecg,
            thalch, exang, oldpeak, slope, ca, thal):
    try:
        # FIX: convert boolean-like dropdown values to int explicitly
        fbs_val   = 1 if fbs   == "Oui / True" else 0
        exang_val = 1 if exang == "Oui / True" else 0

        input_data = {
            "age":      float(age),
            "sex":      sex,
            "cp":       cp,
            "trestbps": float(trestbps),
            "chol":     float(chol),
            "fbs":      fbs_val,
            "restecg":  restecg,
            "thalch":   float(thalch),
            "exang":    exang_val,
            "oldpeak":  float(oldpeak),
            "slope":    slope,
            "ca":       float(ca),
            "thal":     thal,
        }

        df_input    = pd.DataFrame([input_data])
        X_processed = preprocessor.transform(df_input)
        prediction  = int(model.predict(X_processed)[0])
        probs       = model.predict_proba(X_processed)[0]

        label, color = RISK_LABELS[prediction]

        # Build visual probability bars
        bars = ""
        for i, p in enumerate(probs):
            lbl, bg = RISK_LABELS[i]
            pct     = p * 100
            width   = max(int(pct * 2.5), 2)
            bold    = "font-weight:bold;" if i == prediction else ""
            bars += f"""
            <div style="margin:5px 0;display:flex;align-items:center;gap:8px">
              <span style="width:160px;font-size:13px;{bold}">{lbl}</span>
              <div style="background:{bg};width:{width}px;height:16px;
                          border-radius:4px;transition:width 0.3s"></div>
              <span style="font-size:13px;{bold}">{pct:.1f}%</span>
            </div>"""

        html = f"""
        <div style="font-family:sans-serif;padding:20px;border-radius:12px;
                    border-left:6px solid {color};background:#fafafa;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08)">
          <h2 style="margin:0 0 6px;color:{color};font-size:22px">{label}</h2>
          <p style="margin:0 0 20px;color:#555;font-size:14px">
            Niveau de maladie prédit : <b style="font-size:16px">{prediction}</b> / 4
          </p>
          <h4 style="margin:0 0 10px;color:#333">Probabilités par classe</h4>
          {bars}
          <hr style="margin:16px 0;border:none;border-top:1px solid #eee">
          <p style="margin:0;font-size:12px;color:#999">
            ⚠️ Outil d'aide à la décision uniquement — ne constitue pas un diagnostic médical.
          </p>
        </div>"""
        return html

    except Exception as e:
        return f'<div style="color:#c0392b;padding:12px;border-radius:8px;background:#fdecea">❌ Erreur : {e}</div>'


# ── UI layout ─────────────────────────────────────────────────────────────────
CSS = """
#predict-btn {
    background: #2c3e50 !important;
    color: white !important;
    font-size: 16px !important;
    padding: 12px !important;
    border-radius: 8px !important;
}
#predict-btn:hover { background: #1a252f !important; }
"""

with gr.Blocks(title="Prédiction Maladie Cardiaque", css=CSS,
               theme=gr.themes.Soft()) as demo:

    gr.Markdown("""
    # ❤️ Prédiction du Risque de Maladie Cardiaque
    Remplissez les paramètres cliniques du patient, puis cliquez sur **Prédire**.
    > Modèle : **XGBoost** · Dataset UCI Heart Disease (Cleveland · Hungary · Switzerland · VA Long Beach)
    """)

    with gr.Row():
        with gr.Column():
            gr.Markdown("### 👤 Démographie")
            age = gr.Slider(20, 100, value=54, step=1,
                            label="Âge (ans)",
                            info="Moyenne du dataset : 54 ans")
            sex = gr.Dropdown(["Male", "Female"], value="Male",
                              label="Sexe biologique")
            cp  = gr.Dropdown(
                ["typical angina", "atypical angina", "non-anginal", "asymptomatic"],
                value="asymptomatic",
                label="Type de douleur thoracique (cp)",
                info="'asymptomatic' est le plus associé à la maladie cardiaque")

            gr.Markdown("### 🩺 Mesures cliniques")
            trestbps = gr.Slider(80, 220, value=130, step=1,
                                 label="Pression artérielle au repos — mmHg (trestbps)",
                                 info="Normale : 90–120 mmHg")
            chol = gr.Slider(100, 600, value=246, step=1,
                             label="Cholestérol sérique — mg/dl (chol)",
                             info="Souhaitable : < 200 mg/dl  |  Limite haute : 200–239")
            fbs  = gr.Dropdown(["Oui / True", "Non / False"], value="Non / False",
                               label="Glycémie à jeun > 120 mg/dl (fbs)",
                               info="Indicateur de diabète potentiel")

        with gr.Column():
            gr.Markdown("### 📊 ECG & Effort")
            restecg = gr.Dropdown(
                ["normal", "lv hypertrophy", "st-t abnormality"],
                value="normal",
                label="Résultat ECG au repos (restecg)")
            thalch = gr.Slider(60, 220, value=149, step=1,
                               label="Fréquence cardiaque max atteinte — bpm (thalch)",
                               info="Max théorique ≈ 220 − âge")
            exang  = gr.Dropdown(["Oui / True", "Non / False"], value="Non / False",
                                 label="Angine induite par l'exercice (exang)")
            oldpeak = gr.Slider(0.0, 10.0, value=1.0, step=0.1,
                                label="Dépression ST à l'effort (oldpeak)",
                                info="0 = aucune · > 2 mm = significatif")
            slope   = gr.Dropdown(["upsloping", "flat", "downsloping"], value="flat",
                                  label="Pente du segment ST (slope)")

            gr.Markdown("### 🔬 Imagerie")
            ca   = gr.Slider(0, 4, value=0, step=1,
                             label="Vaisseaux principaux colorés en fluoroscopie (ca)",
                             info="0 = aucun · 3–4 = atteinte sévère")
            thal = gr.Dropdown(
                ["normal", "fixed defect", "reversable defect"],
                value="normal",
                label="Thalassémie (thal)",
                info="'reversable defect' est le plus péjoratif")

    predict_btn = gr.Button("🔍 Prédire le risque", elem_id="predict-btn", size="lg")
    output      = gr.HTML(label="Résultat")

    predict_btn.click(
        fn=predict,
        inputs=[age, sex, cp, trestbps, chol, fbs, restecg,
                thalch, exang, oldpeak, slope, ca, thal],
        outputs=output
    )

    gr.Markdown("""
    ---
    **Niveaux** (variable *num* originale UCI) :
    `0` = sain &nbsp;·&nbsp; `1` = légère &nbsp;·&nbsp; `2` = modérée &nbsp;·&nbsp;
    `3` = élevée &nbsp;·&nbsp; `4` = très élevée
    """)


if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860, share=False)
