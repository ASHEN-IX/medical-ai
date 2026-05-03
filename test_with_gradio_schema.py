#!/usr/bin/env python3
"""Test script to validate autism prediction with exact Gradio model schema."""

import sys
import pickle
from pathlib import Path
from typing import Any

import pandas as pd

# Add ai-service to path
sys.path.insert(0, str(Path(__file__).parent / "ai-service"))

from app.services.autism_parser import parse_autism_prediction_request
from app.services.autism_prediction_service import AutismPredictionService

def normalize_label(value: Any) -> str:
    return str(value).strip().lower()


def build_category_metadata_from_model(raw_csv: str, processed_csv: str, model_path: str) -> dict[str, dict[str, dict[Any, Any]]]:
    """Build category metadata exactly like the Gradio app does."""
    
    CATEGORICAL_COLUMNS = [
        "gender",
        "ethnicity",
        "jaundice",
        "austim",
        "contry_of_res",
        "used_app_before",
        "relation",
    ]
    
    raw_df = pd.read_csv(raw_csv)
    processed_df = pd.read_csv(processed_csv)
    
    metadata: dict[str, dict[str, dict[Any, Any]]] = {}

    for column in CATEGORICAL_COLUMNS:
        alias_to_code: dict[str, int] = {}
        code_to_values: dict[int, list[str]] = {}
        value_counts = raw_df[column].astype(str).value_counts().to_dict()

        for raw_value, encoded_value in zip(raw_df[column].astype(str), processed_df[column].astype(int), strict=True):
            alias_to_code[normalize_label(raw_value)] = int(encoded_value)
            code_to_values.setdefault(int(encoded_value), [])
            if raw_value not in code_to_values[int(encoded_value)]:
                code_to_values[int(encoded_value)].append(raw_value)

        code_to_label = {code: values[0] for code, values in sorted(code_to_values.items())}
        
        metadata[column] = {
            "alias_to_code": alias_to_code,
            "code_to_label": code_to_label,
        }

    return metadata


def encode_category(column: str, value: Any, metadata: dict[str, dict[str, dict[Any, Any]]]) -> int:
    """Encode categorical value exactly like Gradio app."""
    column_meta = metadata[column]
    alias_to_code = column_meta["alias_to_code"]

    if isinstance(value, (int, float)) and int(value) == value:
        encoded = int(value)
        if encoded in column_meta["code_to_label"]:
            return encoded

    normalized = normalize_label(value)
    if normalized in alias_to_code:
        return alias_to_code[normalized]

    valid_options = ", ".join(sorted(column_meta["code_to_label"].values()))
    raise ValueError(f"Invalid value for {column}: {value}. Expected one of: {valid_options}")


def test_with_gradio_schema():
    """Test autism prediction using exact Gradio model schema."""
    
    print("=" * 80)
    print("AUTISM PREDICTION WITH GRADIO MODEL SCHEMA")
    print("=" * 80)
    
    # Path to autism model
    model_root = Path(__file__).parent / "ai-service" / "models" / "autism-prediction"
    model_path = model_root / "best-model-autism.pkl"
    encoders_path = model_root / "encoders.pkl"
    
    print(f"\nLoading autism model from: {model_path}")
    print(f"Encoders from: {encoders_path}")
    
    if not model_path.exists():
        print(f"✗ Model file not found: {model_path}")
        return
    
    if not encoders_path.exists():
        print(f"✗ Encoders file not found: {encoders_path}")
        return
    
    # M-CHAT report data (from user's report)
    m_chat_text = """
    Patient NameN/A (Self-Report)Patient IDASSD-2026-002
    Date of ReportApril 29, 2026Exam TypeDevelopmental
    Screening (M-CHAT)
    Age / Gender7 years · MaleEthnicityWhite-European
    Country of ResidenceUnited StatesInformantSelf
    Jaundice at BirthNoPrior Screening AppNo
    M-CHAT Screening Responses
    ItemQuestion Response
    A1Does the child look at you when you call their name?Yes
    A2Does the child use pointing to show interest?Yes
    A3Does the child engage in pretend play?Yes
    A4Does the child show interest in other children?Yes
    A5Does the child bring objects to show you?Yes
    A6Does the child make eye contact with you?Yes
    A7Does the child imitate your actions?Yes
    A8Does the child respond to their name being called?Yes
    A9Does the child use simple gestures?Yes
    A10Does the child smile in response to your smile?Yes
    """
    
    print("\n" + "=" * 80)
    print("PARSING M-CHAT REPORT")
    print("=" * 80)
    
    # Parse the report
    parsed = parse_autism_prediction_request(m_chat_text)
    responses_dict = parsed.responses.model_dump() if hasattr(parsed.responses, "model_dump") else parsed.responses.dict()
    
    print(f"\nExtracted from report:")
    print(f"  Age: {parsed.demographics.age}")
    print(f"  Gender (raw): {parsed.demographics.gender}")
    print(f"  Ethnicity (raw): {parsed.demographics.ethnicity}")
    print(f"  Relation (raw): {parsed.demographics.relation}")
    print(f"  Jaundice (raw): {parsed.demographics.jaundice}")
    print(f"  Family History (raw): {parsed.demographics.austim}")
    print(f"  Used App Before (raw): {parsed.demographics.used_app_before}")
    print(f"  Country (raw): {parsed.demographics.contry_of_res}")
    
    print(f"\nA-Scores:")
    total_score = 0
    for i in range(1, 11):
        score = responses_dict.get(f"A{i}_Score", 0)
        total_score += score
        print(f"  A{i}_Score: {score}")
    
    # Prepare input for model
    print("\n" + "=" * 80)
    print("ENCODING WITH GRADIO SCHEMA")
    print("=" * 80)
    
    try:
        # Encode categorical fields
        gender_encoded = encode_category("gender", parsed.demographics.gender or "0", metadata)
        ethnicity_encoded = encode_category("ethnicity", parsed.demographics.ethnicity or "0", metadata) if parsed.demographics.ethnicity else 0
        jaundice_encoded = encode_category("jaundice", parsed.demographics.jaundice or "no", metadata)
        austim_encoded = encode_category("austim", parsed.demographics.austim or "no", metadata)
        relation_encoded = encode_category("relation", parsed.demographics.relation or "self", metadata)
        country_encoded = encode_category("contry_of_res", parsed.demographics.contry_of_res or "0", metadata)
        used_before_encoded = encode_category("used_app_before", parsed.demographics.used_app_before or "no", metadata)
        
        print(f"\nEncoded demographics:")
        print(f"  gender: {parsed.demographics.gender} → {gender_encoded}")
        print(f"  ethnicity: {parsed.demographics.ethnicity} → {ethnicity_encoded}")
        print(f"  jaundice: {parsed.demographics.jaundice} → {jaundice_encoded}")
        print(f"  austim (family history): {parsed.demographics.austim} → {austim_encoded}")
        print(f"  relation: {parsed.demographics.relation} → {relation_encoded}")
        print(f"  contry_of_res: {parsed.demographics.contry_of_res} → {country_encoded}")
        print(f"  used_app_before: {parsed.demographics.used_app_before} → {used_before_encoded}")
        
        # Create model input
        input_data = {
            "A1_Score": responses_dict.get("A1_Score", 0),
            "A2_Score": responses_dict.get("A2_Score", 0),
            "A3_Score": responses_dict.get("A3_Score", 0),
            "A4_Score": responses_dict.get("A4_Score", 0),
            "A5_Score": responses_dict.get("A5_Score", 0),
            "A6_Score": responses_dict.get("A6_Score", 0),
            "A7_Score": responses_dict.get("A7_Score", 0),
            "A8_Score": responses_dict.get("A8_Score", 0),
            "A9_Score": responses_dict.get("A9_Score", 0),
            "A10_Score": responses_dict.get("A10_Score", 0),
            "age": float(parsed.demographics.age or 0),
            "gender": gender_encoded,
            "ethnicity": ethnicity_encoded,
            "jaundice": jaundice_encoded,
            "austim": austim_encoded,
            "contry_of_res": country_encoded,
            "used_app_before": used_before_encoded,
            "result": float(total_score),  # Sum of A-scores as result
            "relation": relation_encoded,
        }
        
        print(f"\nFinal model input:")
        for key, value in input_data.items():
            print(f"  {key}: {value}")
        
        # Load model and make prediction
        print("\n" + "=" * 80)
        print("MODEL PREDICTION")
        print("=" * 80)
        
        with open(model_path, "rb") as f:
            model = pickle.load(f)
        
        # Get feature columns
        feature_columns = list(getattr(model, "feature_names_in_", []))
        if not feature_columns:
            feature_columns = [
                "A1_Score", "A2_Score", "A3_Score", "A4_Score", "A5_Score",
                "A6_Score", "A7_Score", "A8_Score", "A9_Score", "A10_Score",
                "age", "gender", "ethnicity", "jaundice", "austim",
                "contry_of_res", "used_app_before", "result", "relation",
            ]
        
        # Create DataFrame
        df = pd.DataFrame([input_data], columns=feature_columns)
        
        print(f"\nFeature columns: {feature_columns}")
        print(f"Input shape: {df.shape}")
        
        # Make prediction
        prediction = int(model.predict(df)[0])
        
        if hasattr(model, "predict_proba"):
            probabilities = model.predict_proba(df)[0]
            no_asd_prob = float(probabilities[0])
            asd_prob = float(probabilities[1])
        else:
            no_asd_prob = 1.0 - float(prediction)
            asd_prob = float(prediction)
        
        print(f"\n✓ Prediction: {'ASD LIKELY' if prediction == 1 else 'NO ASD'}")
        print(f"  ASD Probability: {asd_prob:.1%}")
        print(f"  No ASD Probability: {no_asd_prob:.1%}")
        print(f"  Prediction Class: {prediction}")
        
        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"Subject: 7-year-old male from USA")
        print(f"M-CHAT Screening: {total_score}/10 positive responses")
        print(f"Model Prediction: {'ASD likely' if prediction == 1 else 'No ASD'}")
        print(f"Confidence: {max(asd_prob, no_asd_prob):.1%}")
        
    except Exception as e:
        print(f"✗ Error during encoding/prediction: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    test_with_gradio_schema()
