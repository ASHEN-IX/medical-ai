#!/usr/bin/env python3
"""Simple test for autism prediction with pre-trained model and encoders."""

import sys
import pickle
from pathlib import Path

import pandas as pd

# Add ai-service to path
sys.path.insert(0, str(Path(__file__).parent / "ai-service"))

from app.services.autism_parser import parse_autism_prediction_request


def test_autism_prediction():
    """Test autism prediction using pre-trained model and encoders."""
    
    print("=" * 80)
    print("AUTISM PREDICTION TEST - WITH TRAINED MODEL")
    print("=" * 80)
    
    # Path to autism model
    model_root = Path(__file__).parent / "ai-service" / "models" / "autism-prediction"
    model_path = model_root / "best-model-autism.pkl"
    encoders_path = model_root / "encoders.pkl"
    
    print(f"\nLoading autism model from: {model_path}")
    print(f"Loading encoders from: {encoders_path}")
    
    if not model_path.exists():
        print(f"✗ Model file not found: {model_path}")
        return
    
    if not encoders_path.exists():
        print(f"✗ Encoders file not found: {encoders_path}")
        return
    
    # Load model and encoders
    try:
        with open(model_path, "rb") as f:
            model = pickle.load(f)
        print(f"✓ Model loaded successfully")
    except Exception as e:
        print(f"✗ Failed to load model: {e}")
        return
    
    try:
        with open(encoders_path, "rb") as f:
            encoders = pickle.load(f)
        print(f"✓ Encoders loaded successfully")
        print(f"  Encoder keys: {list(encoders.keys())}")
    except Exception as e:
        print(f"✗ Failed to load encoders: {e}")
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
    print(f"  Gender: {parsed.demographics.gender}")
    print(f"  Ethnicity: {parsed.demographics.ethnicity}")
    print(f"  Relation: {parsed.demographics.relation}")
    print(f"  Jaundice: {parsed.demographics.jaundice}")
    print(f"  Family History: {parsed.demographics.austim}")
    print(f"  Used App Before: {parsed.demographics.used_app_before}")
    print(f"  Country: {parsed.demographics.contry_of_res}")
    
    print(f"\nA-Scores extracted:")
    total_score = 0
    for i in range(1, 11):
        score = responses_dict.get(f"A{i}_Score", 0)
        total_score += score
        print(f"  A{i}_Score: {score}")
    print(f"  TOTAL: {total_score}/10")
    
    # Prepare input for model
    print("\n" + "=" * 80)
    print("ENCODING WITH MODEL ENCODERS")
    print("=" * 80)
    
    try:
        # First, create the input data from parsed demographics
        input_data = {
            "A1_Score": float(responses_dict.get("A1_Score", 0)),
            "A2_Score": float(responses_dict.get("A2_Score", 0)),
            "A3_Score": float(responses_dict.get("A3_Score", 0)),
            "A4_Score": float(responses_dict.get("A4_Score", 0)),
            "A5_Score": float(responses_dict.get("A5_Score", 0)),
            "A6_Score": float(responses_dict.get("A6_Score", 0)),
            "A7_Score": float(responses_dict.get("A7_Score", 0)),
            "A8_Score": float(responses_dict.get("A8_Score", 0)),
            "A9_Score": float(responses_dict.get("A9_Score", 0)),
            "A10_Score": float(responses_dict.get("A10_Score", 0)),
            "age": float(parsed.demographics.age or 0),
            "gender": parsed.demographics.gender,
            "ethnicity": parsed.demographics.ethnicity or "0",
            "jaundice": parsed.demographics.jaundice or "no",
            "austim": parsed.demographics.austim or "no",
            "contry_of_res": parsed.demographics.contry_of_res or "0",
            "used_app_before": parsed.demographics.used_app_before or "no",
            "result": float(total_score),
            "relation": parsed.demographics.relation or "0",
        }
        
        # Map categorical strings to numeric codes based on what the encoders expect
        categorical_mappings = {
            "gender": {"m": 0, "f": 1, "M": 0, "F": 1, "0": 0, "1": 1},
            "jaundice": {"yes": 1, "no": 0, "1": 1, "0": 0},
            "austim": {"yes": 1, "no": 0, "1": 1, "0": 0},
            "used_app_before": {"yes": 1, "no": 0, "1": 1, "0": 0},
            "relation": {"self": 0, "parent": 1, "0": 0, "1": 1},
            "ethnicity": {},  # Will be handled as-is
            "contry_of_res": {},  # Will be handled as-is
        }
        
        # Convert categorical fields to their expected numeric codes
        print(f"\nMapping values:")
        for col in ["gender", "jaundice", "austim", "used_app_before", "relation", "ethnicity", "contry_of_res"]:
            if col not in input_data:
                continue
                
            mapping = categorical_mappings.get(col, {})
            if len(mapping) == 0:
                print(f"  Skipping {col} (no mapping dict)")
                continue
            
            raw_value = input_data[col]
            if isinstance(raw_value, (int, float)):
                input_data[col] = float(raw_value)
                print(f"  {col}: {raw_value} (already numeric)")
            else:
                # Try to find the mapped value
                raw_str = str(raw_value).lower().strip()
                if raw_str in mapping:
                    input_data[col] = float(mapping[raw_str])
                    print(f"  Mapped {col}: {raw_value} → {mapping[raw_str]}")
                else:
                    # Default to 0
                    input_data[col] = 0.0
                    print(f"  ⚠ No mapping for {col}={raw_value}, using 0")
        
        print(f"\nFinal input data for model:")
        for key in ["A1_Score", "A10_Score", "age", "gender", "jaundice", "austim", "used_app_before", "relation"]:
            print(f"  {key}: {input_data[key]}")
        
        # Make prediction
        print("\n" + "=" * 80)
        print("MODEL PREDICTION")
        print("=" * 80)
        
        # Get feature columns from model
        feature_columns = list(getattr(model, "feature_names_in_", []))
        if not feature_columns:
            feature_columns = [
                "A1_Score", "A2_Score", "A3_Score", "A4_Score", "A5_Score",
                "A6_Score", "A7_Score", "A8_Score", "A9_Score", "A10_Score",
                "age", "gender", "ethnicity", "jaundice", "austim",
                "contry_of_res", "used_app_before", "result", "relation",
            ]
        
        print(f"\nModel feature columns ({len(feature_columns)}): {feature_columns}")
        
        # Create DataFrame with proper column order
        df_data = {}
        for col in feature_columns:
            df_data[col] = input_data.get(col, 0.0)
        
        df = pd.DataFrame([df_data])
        print(f"Input DataFrame shape: {df.shape}")
        print(f"Input values:\n{df}")
        
        # Make prediction
        prediction = int(model.predict(df)[0])
        
        if hasattr(model, "predict_proba"):
            probabilities = model.predict_proba(df)[0]
            no_asd_prob = float(probabilities[0])
            asd_prob = float(probabilities[1])
        else:
            asd_prob = float(prediction)
            no_asd_prob = 1.0 - asd_prob
        
        print(f"\n✓ PREDICTION RESULT:")
        print(f"  Class: {prediction} ({'ASD' if prediction == 1 else 'NO ASD'})")
        print(f"  ASD Probability: {asd_prob:.1%}")
        print(f"  No ASD Probability: {no_asd_prob:.1%}")
        
        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"Subject: 7-year-old male from USA")
        print(f"M-CHAT Screening: {total_score}/10 positive responses")
        print(f"Model Prediction: {'✓ ASD likely' if prediction == 1 else '✗ No ASD'}")
        print(f"Confidence: {max(asd_prob, no_asd_prob):.1%}")
        print("=" * 80)
        
    except Exception as e:
        print(f"✗ Error during encoding/prediction: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    test_autism_prediction()
