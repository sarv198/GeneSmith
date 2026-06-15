"""Circuit-level expression predictor: promoter RPU, RBS translation, protein yield."""

from __future__ import annotations

import os
import pickle
from typing import Any

import numpy as np

from backend.prediction_engine.features import extract_features

PROMOTER_MODEL_PATH = "backend/prediction_engine/models/gbm_v1.pkl"
RBS_MODEL_PATH = "backend/prediction_engine/models/rbs_gbm_v1.pkl"

KNOWN_RPU = {
    "BBa_J23100": 1.00,
    "BBa_J23101": 0.70,
    "BBa_J23106": 0.47,
    "BBa_J23116": 0.16,
    "BBa_J23118": 0.56,
    "BBa_R0010": 0.01,
}

CODON_TABLE = {
    "TTT": "F", "TTC": "F", "TTA": "L", "TTG": "L",
    "TCT": "S", "TCC": "S", "TCA": "S", "TCG": "S",
    "TAT": "Y", "TAC": "Y", "TAA": "*", "TAG": "*",
    "TGT": "C", "TGC": "C", "TGA": "*", "TGG": "W",
    "CTT": "L", "CTC": "L", "CTA": "L", "CTG": "L",
    "CCT": "P", "CCC": "P", "CCA": "P", "CCG": "P",
    "CAT": "H", "CAC": "H", "CAA": "Q", "CAG": "Q",
    "CGT": "R", "CGC": "R", "CGA": "R", "CGG": "R",
    "ATT": "I", "ATC": "I", "ATA": "I", "ATG": "M",
    "ACT": "T", "ACC": "T", "ACA": "T", "ACG": "T",
    "AAT": "N", "AAC": "N", "AAA": "K", "AAG": "K",
    "AGT": "S", "AGC": "S", "AGA": "R", "AGG": "R",
    "GTT": "V", "GTC": "V", "GTA": "V", "GTG": "V",
    "GCT": "A", "GCC": "A", "GCA": "A", "GCG": "A",
    "GAT": "D", "GAC": "D", "GAA": "E", "GAG": "E",
    "GGT": "G", "GGC": "G", "GGA": "G", "GGG": "G",
}


def _translate_dna(sequence: str) -> str:
    seq = "".join(b for b in sequence.upper() if b in "ATCG")
    protein: list[str] = []
    for i in range(0, len(seq) - 2, 3):
        codon = seq[i : i + 3]
        aa = CODON_TABLE.get(codon, "X")
        if aa == "*":
            break
        protein.append(aa)
    return "".join(protein)


def _cds_expressibility_factor(sequence: str) -> float:
    """Heuristic CDS factor until calibrated yield training data is available."""
    feats = extract_features(sequence, "cds")
    aa_len = feats["cds_length_aa"]
    if aa_len <= 0:
        return 0.1
    length_factor = 1.0 - abs(aa_len - 250) / 500
    length_factor = max(0.2, min(1.0, length_factor))
    start_bonus = 0.1 if feats["start_codon"] else 0.0
    return min(1.0, length_factor + start_bonus)


class ExpressionPredictor:
    def __init__(self) -> None:
        self.promoter_model = None
        self.promoter_scaler = None
        self.promoter_feature_names: list[str] = []
        self.rbs_model = None
        self.rbs_scaler = None
        self.rbs_feature_names: list[str] = []
        self.mode = "heuristic"

        if os.path.exists(PROMOTER_MODEL_PATH):
            try:
                with open(PROMOTER_MODEL_PATH, "rb") as handle:
                    data = pickle.load(handle)
                self.promoter_model = data["model"]
                self.promoter_scaler = data["scaler"]
                self.promoter_feature_names = list(data["feature_names"])
                self.mode = "GBM-v1"
            except Exception as exc:
                print(
                    f"WARNING: Could not load promoter model ({exc}) — using heuristic fallback. "
                    "Run from synbio-studio/venv and ensure scikit-learn matches the trained "
                    "model version (python -m backend.prediction_engine.train)."
                )

        if os.path.exists(RBS_MODEL_PATH):
            try:
                with open(RBS_MODEL_PATH, "rb") as handle:
                    data = pickle.load(handle)
                self.rbs_model = data["model"]
                self.rbs_scaler = data["scaler"]
                self.rbs_feature_names = list(data["feature_names"])
            except Exception as exc:
                print(
                    f"WARNING: Could not load RBS model ({exc}) — using heuristic fallback. "
                    "Run from synbio-studio/venv and ensure scikit-learn matches the trained "
                    "model version (python -m backend.prediction_engine.train)."
                )

        if self.promoter_model is None:
            print(
                "WARNING: No promoter model at backend/prediction_engine/models/gbm_v1.pkl "
                "— using heuristic fallback"
            )

    @property
    def model(self):
        return self.promoter_model

    @property
    def scaler(self):
        return self.promoter_scaler

    @property
    def feature_names(self) -> list[str]:
        return self.promoter_feature_names

    def _predict_promoter(self, sequence: str) -> float:
        if self.promoter_model is None:
            return 0.3
        feats = extract_features(sequence, "promoter")
        row = []
        for name in self.promoter_feature_names:
            if name in feats:
                row.append(feats[name])
            elif name == "org_E. coli":
                row.append(1.0)
            elif name.startswith("org_"):
                row.append(0.0)
            else:
                row.append(0.0)
        X = self.promoter_scaler.transform(np.array([row]))
        return float(np.clip(self.promoter_model.predict(X)[0], 0.0, 1.0))

    def _predict_rbs(self, sequence: str) -> float:
        if self.rbs_model is None:
            return 0.5
        feats = extract_features(sequence, "rbs")
        row = [feats[name] for name in self.rbs_feature_names]
        X = self.rbs_scaler.transform(np.array([row]))
        return float(np.clip(self.rbs_model.predict(X)[0], 0.0, 1.0))

    def predict(self, parts: list[dict[str, Any]]) -> dict[str, Any]:
        if self.mode == "heuristic":
            return self._heuristic_predict(parts)

        promoter = next(
            (p for p in parts if str(p.get("part_type", "")).lower() == "promoter"),
            None,
        )
        rbs = next(
            (p for p in parts if str(p.get("part_type", "")).lower() == "rbs"),
            None,
        )
        cds = next(
            (
                p
                for p in parts
                if str(p.get("part_type", "")).lower() in {"cds", "gene"}
            ),
            None,
        )

        if promoter is None:
            raise ValueError("No promoter found in circuit")

        promoter_rpu = self._predict_promoter(str(promoter.get("sequence", "")))
        translation_rate = (
            self._predict_rbs(str(rbs.get("sequence", "")))
            if rbs
            else 0.5
        )

        cds_sequence = str(cds.get("sequence", "")) if cds else ""
        amino_acids = _translate_dna(cds_sequence) if cds_sequence else ""
        cds_factor = _cds_expressibility_factor(cds_sequence) if cds_sequence else 0.5

        protein_yield = promoter_rpu * translation_rate * cds_factor
        protein_yield = round(float(np.clip(protein_yield, 0.0, 1.0)), 4)

        return {
            "expression_level": protein_yield,
            "unit": "relative_yield",
            "model": "GBM-v1",
            "promoter_strength": {
                "rpu": round(promoter_rpu, 4),
                "unit": "RPU",
            },
            "translation_rate": {
                "value": round(translation_rate, 4),
                "unit": "normalized",
                "model": "RBS-GBM-v1" if self.rbs_model else "default",
            },
            "protein_yield": {
                "relative_yield": protein_yield,
                "amino_acid_length": len(amino_acids),
                "amino_acid_sequence": amino_acids[:100]
                + ("…" if len(amino_acids) > 100 else ""),
                "cds_expressibility_factor": round(cds_factor, 4),
                "calibrated": False,
                "note": (
                    "Relative yield = promoter RPU × translation rate × CDS factor. "
                    "Provide measured protein yield data to train a calibrated yield model."
                ),
            },
            "confidence_interval": [
                round(protein_yield * 0.85, 4),
                round(min(protein_yield * 1.15, 1.0), 4),
            ],
        }

    def _heuristic_predict(self, parts: list[dict[str, Any]]) -> dict[str, Any]:
        promoter = next(
            (p for p in parts if str(p.get("part_type", "")).lower() == "promoter"),
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
