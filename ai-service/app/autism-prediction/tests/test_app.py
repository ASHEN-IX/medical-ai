from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app import CATEGORICAL_COLUMNS, load_artifacts, predict_asd, prepare_model_input

RAW_DATA_PATH = ROOT / "data" / "raw" / "autism.csv"
PROCESSED_DATA_PATH = ROOT / "data" / "processed" / "autism_processed.csv"


def _first_row_inputs() -> tuple[pd.Series, pd.Series]:
    raw_row = pd.read_csv(RAW_DATA_PATH).iloc[0]
    processed_row = pd.read_csv(PROCESSED_DATA_PATH).iloc[0]
    return raw_row, processed_row


def test_category_metadata_has_expected_columns() -> None:
    artifacts = load_artifacts()
    metadata_columns = set(artifacts["category_metadata"].keys())
    assert metadata_columns == set(CATEGORICAL_COLUMNS)


def test_prepare_model_input_matches_processed_row() -> None:
    artifacts = load_artifacts()
    feature_columns = artifacts["feature_columns"]
    raw_row, processed_row = _first_row_inputs()

    frame = prepare_model_input(
        int(raw_row["A1_Score"]),
        int(raw_row["A2_Score"]),
        int(raw_row["A3_Score"]),
        int(raw_row["A4_Score"]),
        int(raw_row["A5_Score"]),
        int(raw_row["A6_Score"]),
        int(raw_row["A7_Score"]),
        int(raw_row["A8_Score"]),
        int(raw_row["A9_Score"]),
        int(raw_row["A10_Score"]),
        float(raw_row["age"]),
        str(raw_row["gender"]),
        str(raw_row["ethnicity"]),
        str(raw_row["jaundice"]),
        str(raw_row["austim"]),
        str(raw_row["contry_of_res"]),
        str(raw_row["used_app_before"]),
        float(raw_row["result"]),
        str(raw_row["relation"]),
    )

    assert list(frame.columns) == feature_columns
    assert frame.shape == (1, len(feature_columns))

    for column in feature_columns:
        expected = float(processed_row[column])
        actual = float(frame.iloc[0][column])
        assert actual == pytest.approx(expected)


def test_predict_asd_returns_probabilities() -> None:
    raw_row, _ = _first_row_inputs()

    summary, probabilities = predict_asd(
        int(raw_row["A1_Score"]),
        int(raw_row["A2_Score"]),
        int(raw_row["A3_Score"]),
        int(raw_row["A4_Score"]),
        int(raw_row["A5_Score"]),
        int(raw_row["A6_Score"]),
        int(raw_row["A7_Score"]),
        int(raw_row["A8_Score"]),
        int(raw_row["A9_Score"]),
        int(raw_row["A10_Score"]),
        float(raw_row["age"]),
        str(raw_row["gender"]),
        str(raw_row["ethnicity"]),
        str(raw_row["jaundice"]),
        str(raw_row["austim"]),
        str(raw_row["contry_of_res"]),
        str(raw_row["used_app_before"]),
        float(raw_row["result"]),
        str(raw_row["relation"]),
    )

    assert isinstance(summary, str)
    assert "confidence" in summary.lower()
    assert set(probabilities.keys()) == {"No ASD (Class 0)", "ASD (Class 1)"}
    assert 0.0 <= probabilities["No ASD (Class 0)"] <= 1.0
    assert 0.0 <= probabilities["ASD (Class 1)"] <= 1.0
    assert probabilities["No ASD (Class 0)"] + probabilities["ASD (Class 1)"] == pytest.approx(1.0, abs=1e-6)


def test_prepare_model_input_rejects_invalid_score() -> None:
    raw_row, _ = _first_row_inputs()

    with pytest.raises(ValueError, match="must be 0 or 1"):
        prepare_model_input(
            2,
            int(raw_row["A2_Score"]),
            int(raw_row["A3_Score"]),
            int(raw_row["A4_Score"]),
            int(raw_row["A5_Score"]),
            int(raw_row["A6_Score"]),
            int(raw_row["A7_Score"]),
            int(raw_row["A8_Score"]),
            int(raw_row["A9_Score"]),
            int(raw_row["A10_Score"]),
            float(raw_row["age"]),
            str(raw_row["gender"]),
            str(raw_row["ethnicity"]),
            str(raw_row["jaundice"]),
            str(raw_row["austim"]),
            str(raw_row["contry_of_res"]),
            str(raw_row["used_app_before"]),
            float(raw_row["result"]),
            str(raw_row["relation"]),
        )


def test_prepare_model_input_rejects_unknown_category() -> None:
    raw_row, _ = _first_row_inputs()

    with pytest.raises(ValueError, match="Invalid value for ethnicity"):
        prepare_model_input(
            int(raw_row["A1_Score"]),
            int(raw_row["A2_Score"]),
            int(raw_row["A3_Score"]),
            int(raw_row["A4_Score"]),
            int(raw_row["A5_Score"]),
            int(raw_row["A6_Score"]),
            int(raw_row["A7_Score"]),
            int(raw_row["A8_Score"]),
            int(raw_row["A9_Score"]),
            int(raw_row["A10_Score"]),
            float(raw_row["age"]),
            str(raw_row["gender"]),
            "NotARealEthnicity",
            str(raw_row["jaundice"]),
            str(raw_row["austim"]),
            str(raw_row["contry_of_res"]),
            str(raw_row["used_app_before"]),
            float(raw_row["result"]),
            str(raw_row["relation"]),
        )