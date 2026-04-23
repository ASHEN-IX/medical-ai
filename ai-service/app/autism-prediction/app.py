from __future__ import annotations

import pickle
from functools import lru_cache
from pathlib import Path
from typing import Any

import gradio as gr
import pandas as pd

ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "models" / "best_model.pkl"
RAW_DATA_PATH = ROOT / "data" / "raw" / "autism.csv"
PROCESSED_DATA_PATH = ROOT / "data" / "processed" / "autism_processed.csv"

BINARY_SCORE_COLUMNS = [f"A{i}_Score" for i in range(1, 11)]
CATEGORICAL_COLUMNS = [
    "gender",
    "ethnicity",
    "jaundice",
    "austim",
    "contry_of_res",
    "used_app_before",
    "relation",
]


def _normalize_label(value: Any) -> str:
    return str(value).strip().lower()


def _pick_canonical_label(candidates: list[str], frequencies: dict[str, int]) -> str:
    valid_candidates = [c for c in candidates if _normalize_label(c) not in {"?", "nan", "none", ""}]
    source = valid_candidates if valid_candidates else candidates
    ranked = sorted(source, key=lambda c: (-frequencies.get(c, 0), c.lower()))
    return ranked[0]


def build_category_metadata(raw_df: pd.DataFrame, processed_df: pd.DataFrame) -> dict[str, dict[str, dict[Any, Any]]]:
    metadata: dict[str, dict[str, dict[Any, Any]]] = {}

    for column in CATEGORICAL_COLUMNS:
        alias_to_code: dict[str, int] = {}
        code_to_values: dict[int, list[str]] = {}
        value_counts = raw_df[column].astype(str).value_counts().to_dict()

        for raw_value, encoded_value in zip(raw_df[column].astype(str), processed_df[column].astype(int), strict=True):
            alias_to_code[_normalize_label(raw_value)] = int(encoded_value)
            code_to_values.setdefault(int(encoded_value), [])
            if raw_value not in code_to_values[int(encoded_value)]:
                code_to_values[int(encoded_value)].append(raw_value)

        code_to_label = {
            code: _pick_canonical_label(values, value_counts) for code, values in sorted(code_to_values.items())
        }

        metadata[column] = {
            "alias_to_code": alias_to_code,
            "code_to_label": code_to_label,
        }

    return metadata


@lru_cache(maxsize=1)
def load_artifacts() -> dict[str, Any]:
    processed_df = pd.read_csv(PROCESSED_DATA_PATH)
    raw_df = pd.read_csv(RAW_DATA_PATH)

    if len(raw_df) != len(processed_df):
        raise ValueError("Raw and processed datasets are not row-aligned.")

    with MODEL_PATH.open("rb") as model_file:
        model = pickle.load(model_file)

    feature_columns = list(getattr(model, "feature_names_in_", []))
    if not feature_columns:
        feature_columns = [
            *BINARY_SCORE_COLUMNS,
            "age",
            "gender",
            "ethnicity",
            "jaundice",
            "austim",
            "contry_of_res",
            "used_app_before",
            "result",
            "relation",
        ]

    category_metadata = build_category_metadata(raw_df, processed_df)

    return {
        "model": model,
        "feature_columns": feature_columns,
        "category_metadata": category_metadata,
        "processed_df": processed_df,
    }


def _encode_category(column: str, value: Any, metadata: dict[str, dict[str, dict[Any, Any]]]) -> int:
    column_meta = metadata[column]
    alias_to_code = column_meta["alias_to_code"]

    if isinstance(value, (int, float)) and int(value) == value:
        encoded = int(value)
        if encoded in column_meta["code_to_label"]:
            return encoded

    normalized = _normalize_label(value)
    if normalized in alias_to_code:
        return alias_to_code[normalized]

    valid_options = ", ".join(sorted(column_meta["code_to_label"].values()))
    raise ValueError(f"Invalid value for {column}: {value}. Expected one of: {valid_options}")


def prepare_model_input(
    a1_score: int,
    a2_score: int,
    a3_score: int,
    a4_score: int,
    a5_score: int,
    a6_score: int,
    a7_score: int,
    a8_score: int,
    a9_score: int,
    a10_score: int,
    age: float,
    gender: str | int,
    ethnicity: str | int,
    jaundice: str | int,
    austim: str | int,
    contry_of_res: str | int,
    used_app_before: str | int,
    result: float,
    relation: str | int,
) -> pd.DataFrame:
    artifacts = load_artifacts()
    category_metadata = artifacts["category_metadata"]

    scores = [a1_score, a2_score, a3_score, a4_score, a5_score, a6_score, a7_score, a8_score, a9_score, a10_score]
    if any(score not in {0, 1} for score in scores):
        raise ValueError("A1_Score through A10_Score must be 0 or 1.")

    encoded_row = {
        "A1_Score": int(a1_score),
        "A2_Score": int(a2_score),
        "A3_Score": int(a3_score),
        "A4_Score": int(a4_score),
        "A5_Score": int(a5_score),
        "A6_Score": int(a6_score),
        "A7_Score": int(a7_score),
        "A8_Score": int(a8_score),
        "A9_Score": int(a9_score),
        "A10_Score": int(a10_score),
        "age": float(int(age)),
        "gender": _encode_category("gender", gender, category_metadata),
        "ethnicity": _encode_category("ethnicity", ethnicity, category_metadata),
        "jaundice": _encode_category("jaundice", jaundice, category_metadata),
        "austim": _encode_category("austim", austim, category_metadata),
        "contry_of_res": _encode_category("contry_of_res", contry_of_res, category_metadata),
        "used_app_before": _encode_category("used_app_before", used_app_before, category_metadata),
        "result": float(result),
        "relation": _encode_category("relation", relation, category_metadata),
    }

    feature_columns = artifacts["feature_columns"]
    frame = pd.DataFrame([encoded_row], columns=feature_columns)
    return frame


def predict_asd(
    a1_score: int,
    a2_score: int,
    a3_score: int,
    a4_score: int,
    a5_score: int,
    a6_score: int,
    a7_score: int,
    a8_score: int,
    a9_score: int,
    a10_score: int,
    age: float,
    gender: str | int,
    ethnicity: str | int,
    jaundice: str | int,
    austim: str | int,
    contry_of_res: str | int,
    used_app_before: str | int,
    result: float,
    relation: str | int,
) -> tuple[str, dict[str, float]]:
    artifacts = load_artifacts()
    model = artifacts["model"]

    input_frame = prepare_model_input(
        a1_score,
        a2_score,
        a3_score,
        a4_score,
        a5_score,
        a6_score,
        a7_score,
        a8_score,
        a9_score,
        a10_score,
        age,
        gender,
        ethnicity,
        jaundice,
        austim,
        contry_of_res,
        used_app_before,
        result,
        relation,
    )

    prediction = int(model.predict(input_frame)[0])

    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(input_frame)[0]
        no_asd_probability = float(probabilities[0])
        asd_probability = float(probabilities[1])
    else:
        no_asd_probability = 1.0 - float(prediction)
        asd_probability = float(prediction)

    label = "ASD likely" if prediction == 1 else "No ASD likely"
    confidence = asd_probability if prediction == 1 else no_asd_probability
    summary = f"{label} (confidence: {confidence:.1%})"

    return summary, {
        "No ASD (Class 0)": no_asd_probability,
        "ASD (Class 1)": asd_probability,
    }


def build_interface() -> gr.Blocks:
    artifacts = load_artifacts()
    processed_df = artifacts["processed_df"]
    category_metadata = artifacts["category_metadata"]

    defaults = processed_df.iloc[0]

    category_choices = {
        column: [label for _, label in sorted(meta["code_to_label"].items())]
        for column, meta in category_metadata.items()
    }

    def default_label(column: str) -> str:
        code = int(defaults[column])
        return category_metadata[column]["code_to_label"][code]

    with gr.Blocks(title="Autism Prediction App") as demo:
        gr.Markdown("## Autism Prediction with Random Forest")
        gr.Markdown(
            "This app uses your trained model from models/best_model.pkl and the same encoded feature schema used during training."
        )

        with gr.Row():
            with gr.Column():
                score_inputs = [
                    gr.Number(
                        value=int(defaults[column]),
                        precision=0,
                        label=f"{column} (enter 0 or 1)",
                    )
                    for column in BINARY_SCORE_COLUMNS
                ]

                age_input = gr.Number(value=float(defaults["age"]), label="age")
                gender_input = gr.Dropdown(choices=category_choices["gender"], value=default_label("gender"), label="gender")
                ethnicity_input = gr.Dropdown(
                    choices=category_choices["ethnicity"],
                    value=default_label("ethnicity"),
                    label="ethnicity",
                )
                jaundice_input = gr.Dropdown(
                    choices=category_choices["jaundice"],
                    value=default_label("jaundice"),
                    label="jaundice",
                )
                austim_input = gr.Dropdown(choices=category_choices["austim"], value=default_label("austim"), label="austim")
                country_input = gr.Dropdown(
                    choices=category_choices["contry_of_res"],
                    value=default_label("contry_of_res"),
                    label="contry_of_res",
                    filterable=True,
                )
                used_before_input = gr.Dropdown(
                    choices=category_choices["used_app_before"],
                    value=default_label("used_app_before"),
                    label="used_app_before",
                )
                result_input = gr.Number(value=float(defaults["result"]), label="result")
                relation_input = gr.Dropdown(
                    choices=category_choices["relation"],
                    value=default_label("relation"),
                    label="relation",
                )

                predict_button = gr.Button("Predict")

            with gr.Column():
                prediction_text = gr.Textbox(label="Prediction", interactive=False)
                probability_output = gr.Label(label="Class probabilities")

        predict_button.click(
            fn=predict_asd,
            inputs=[
                *score_inputs,
                age_input,
                gender_input,
                ethnicity_input,
                jaundice_input,
                austim_input,
                country_input,
                used_before_input,
                result_input,
                relation_input,
            ],
            outputs=[prediction_text, probability_output],
        )

    return demo


if __name__ == "__main__":
    interface = build_interface()
    interface.launch()