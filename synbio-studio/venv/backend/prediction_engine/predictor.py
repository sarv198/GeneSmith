"""Expression-level predictor using trained GBM or Anderson heuristic fallback."""

from __future__ import annotations

import os
import pickle
from typing import Any

import numpy as np

from backend.prediction_engine.features import extract_features

MODEL_PATH = "backend/prediction_engine/models/gbm_v1.pkl"

KNOWN_RPU = {
    "BBa_J23100": 1.00,
    "BBa_J23101": 0.70,
    "BBa_J23106": 0.47,
    "BBa_J23116": 0.16,
    "BBa_J23118": 0.56,
    "BBa_R0010": 0.01,
}


class ExpressionPredictor:
    def __init__(self) -> None:
        self.model = None
        self.scaler = None
        self.feature_names: list[str] = []
        self.mode = "heuristic"

        if os.path.exists(MODEL_PATH):
            with open(MODEL_PATH, "rb") as handle:
                data = pickle.load(handle)
            self.model = data["model"]
            self.scaler = data["scaler"]
            self.feature_names = list(data["feature_names"])
            self.mode = "GBM-v1"
        else:
            print(
                "WARNING: No trained model found at "
                "backend/prediction_engine/models/gbm_v1.pkl — using heuristic fallback"
            )

    def predict(self, parts: list[dict[str, Any]]) -> dict[str, Any]:
        if self.mode == "heuristic":
            return self._heuristic_predict(parts)

        promoter = next(
            (part for part in parts if str(part.get("part_type", "")).lower() == "promoter"),
            None,
        )
        if promoter is None:
            raise ValueError("No promoter found in circuit")

        feats = extract_features(str(promoter.get("sequence", "")), "promoter")
        row = []
        for name in self.feature_names:
            if name in feats:
                row.append(feats[name])
            elif name == "org_E. coli":
                row.append(1.0)
            elif name.startswith("org_"):
                row.append(0.0)
            else:
                row.append(0.0)
        X = np.array([row])
        X_scaled = self.scaler.transform(X)
        pred = float(self.model.predict(X_scaled)[0])

        return {
            "expression_level": round(pred, 4),
            "confidence_interval": [round(pred * 0.85, 4), round(pred * 1.15, 4)],
            "unit": "RPU",
            "model": "GBM-v1",
        }

    def _heuristic_predict(self, parts: list[dict[str, Any]]) -> dict[str, Any]:
        promoter = next(
            (part for part in parts if str(part.get("part_type", "")).lower() == "promoter"),
            None,
        )
        part_id = str(promoter.get("part_id", "")) if promoter else ""
        base = KNOWN_RPU.get(part_id, 0.3)
        return {
            "expression_level": base,
            "confidence_interval": [round(base * 0.5, 4), round(base * 1.5, 4)],
            "unit": "RPU",
            "model": "heuristic",
        }
