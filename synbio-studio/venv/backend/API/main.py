"""GeneSmith API — expression prediction and part recommendation."""

from __future__ import annotations

import re
from pathlib import Path
from typing import List, Optional

import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.prediction_engine.predictor import ExpressionPredictor

app = FastAPI(title="GeneSmith API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

predictor = ExpressionPredictor()
MODEL_PATH = "backend/prediction_engine/models/gbm_v1.pkl"
PARTS_MASTER_PATH = Path("backend/data/parts_master.csv")

DEFAULT_CIRCUIT = [
    {
        "part_id": "BBa_J23100",
        "part_type": "promoter",
        "name": "J23100 strong promoter",
        "description": "Anderson constitutive promoter, RPU 1.0",
        "sequence": "TTGACGGCTAGCTCAGTCCTAGGTACAGTGCTAGC",
    },
    {
        "part_id": "BBa_B0034",
        "part_type": "rbs",
        "name": "B0034 RBS",
        "description": "Ribosome binding site",
        "sequence": "AAAGAGGAGAAA",
    },
    {
        "part_id": "BBa_E0040",
        "part_type": "cds",
        "name": "GFP",
        "description": "Green fluorescent protein coding sequence",
        "sequence": "ATGAGTAAAGGAGAAGAACTTTTCACTGGAGTTGTCCCAATTCTTGTTGAATTAGATGGTGATGTTAATGGGCACAAATTTTCTGTCAGTGGAGAGGGTGAAGGTGATGCAACATACGGAAAACTTACCCTTAAATTTATTTGCACTACTGGAAAACTACCTGTTCCATGGCCAACACTTGTCACTACTTTCTCTTATGGTGTTCAATGCTTTTCAAGATACCCAGATCATATGAAACGGCATGACTTTTTCAAGAGTGCCATGCCCGAAGGTTATGTACAGGAAAGAACTATATTTTTCAAAGATGACGGGAACTACAAGACACGTGCTGAAGTCAAGTTTGAAGGTGATACCCTTGTTAATAGAATCGAGTTAAAAGGTATTGATTTTAAAGAAGATGGAAACATTCTTGGACACAAATTGGAATACAACTATAACTCACACAATGTATACATCATGGCAGACAAACAAAAGAATGGAATCAAAGTTAACTTCAAAATTAGACACAACATTGAAGATGGAAGCGTTCAACTAGCAGACCATTATCAACAAAATACTCCAATTGGCGATGGCCCTGTCCTTTTACCAGACAACCATTACCTGTCCACACAATCTGCCCTTTCGAAAGATCCCAACGAAAAGAGAGACCACATGGTCCTTCTTGAGTTTGTAACAGCTGCTGGGATTACACATGGCATGGATGAACTATACAAATAA",
    },
    {
        "part_id": "BBa_B0015",
        "part_type": "terminator",
        "name": "B0015 terminator",
        "description": "Transcription terminator",
        "sequence": "AAAAACGAAAGGGCCTCGTGATACGCCTATTTTTATAGGTTAATGTCATGATAATAATGGTTTCTTAGACGTCAGGTGGCACTTTTCGGGGAAATGTGCGCGGAACCCCTATTTGTTTATTTTTCTAAATACATTCAAATATGTATCCGCTCATGAGACAATAACCCTGATAAATGCTTCAATAATATTGAAAAAGGAAGAGT",
    },
]

PARTS_DB: pd.DataFrame = pd.DataFrame()
if PARTS_MASTER_PATH.exists():
    PARTS_DB = pd.read_csv(PARTS_MASTER_PATH)
    print(f"Loaded {len(PARTS_DB)} parts from {PARTS_MASTER_PATH}")
else:
    print(f"WARNING: {PARTS_MASTER_PATH} not found — /recommend will use defaults only")


class Part(BaseModel):
    part_id: str
    part_type: str
    sequence: str


class PredictRequest(BaseModel):
    parts: List[Part]


class RecommendRequest(BaseModel):
    trait: str


def _normalize_type(part_type: str) -> str:
    part_type = part_type.lower()
    if part_type in {"gene", "cds"}:
        return "cds"
    return part_type


def _score_part(description: str, tokens: list[str]) -> int:
    text = description.lower()
    return sum(1 for token in tokens if token in text)


def recommend_parts(trait: str) -> list[dict]:
    tokens = [t for t in re.findall(r"[a-z0-9]+", trait.lower()) if len(t) > 2]
    target_types = ["promoter", "rbs", "cds", "terminator"]
    results: list[dict] = []

    if PARTS_DB.empty:
        return DEFAULT_CIRCUIT

    work = PARTS_DB.copy()
    work["part_type"] = work["part_type"].map(_normalize_type)
    work["description"] = work["description"].fillna("").astype(str)
    work["score"] = work["description"].apply(lambda d: _score_part(d, tokens))

    any_match = work["score"].max() > 0
    for part_type in target_types:
        subset = work[work["part_type"] == part_type]
        if subset.empty:
            continue
        ranked = subset.sort_values("score", ascending=False) if any_match else subset
        for _, row in ranked.head(2).iterrows():
            results.append(
                {
                    "part_id": row["part_id"],
                    "part_type": part_type if part_type != "cds" else "gene",
                    "name": row.get("name", row["part_id"]),
                    "description": row["description"],
                    "sequence": row["sequence"],
                }
            )

    if not results or not any_match:
        return DEFAULT_CIRCUIT

    return results


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
    return {"parts": parts, "prediction": prediction}


@app.post("/recommend")
def recommend(body: RecommendRequest) -> dict:
    parts = recommend_parts(body.trait)
    return {"trait": body.trait, "parts": parts}
