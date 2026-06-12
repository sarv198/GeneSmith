"""GeneSmith API — expression prediction endpoints."""

from __future__ import annotations

from typing import List

from fastapi import FastAPI
from pydantic import BaseModel

from backend.prediction_engine.predictor import ExpressionPredictor

app = FastAPI(title="GeneSmith API")
predictor = ExpressionPredictor()

MODEL_PATH = "backend/prediction_engine/models/gbm_v1.pkl"


class Part(BaseModel):
    part_id: str
    part_type: str
    sequence: str


class PredictRequest(BaseModel):
    parts: List[Part]


@app.get("/model/status")
def model_status() -> dict:
    return {
        "model_loaded": predictor.model is not None,
        "mode": predictor.mode,
        "model_path": MODEL_PATH,
        "features_count": len(predictor.feature_names),
    }


@app.post("/circuits/predict")
def predict_circuit(body: PredictRequest) -> dict:
    parts = [part.model_dump() for part in body.parts]
    prediction = predictor.predict(parts)
    return {
        "parts": parts,
        "prediction": prediction,
    }
