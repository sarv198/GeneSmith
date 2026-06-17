"""
Train promoter (RPU) and RBS (translation rate) GBM models.
Usage: python -m backend.prediction_engine.train
"""

from __future__ import annotations

import os
import pickle

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.preprocessing import StandardScaler

from backend.prediction_engine.features import extract_features

PROMOTER_CSV = "backend/data/promoter_training_final.csv"
ANDERSON_CSV = "backend/data/anderson_promoters.csv"
RBS_CSV = "backend/data/salis_rbs_clean.csv"
PROMOTER_MODEL_PATH = "backend/prediction_engine/models/gbm_v1.pkl"
RBS_MODEL_PATH = "backend/prediction_engine/models/rbs_gbm_v1.pkl"
ORGANISMS = ["E. coli", "synthetic", "B. subtilis", "P. putida"]


def _build_promoter_matrix(df: pd.DataFrame) -> tuple[np.ndarray, list[str]]:
    seq_feature_names: list[str] | None = None
    feature_rows: list[list[float]] = []

    for _, row in df.iterrows():
        feats = extract_features(row["sequence"], "promoter")
        if seq_feature_names is None:
            seq_feature_names = list(feats.keys())
        feature_rows.append([feats[name] for name in seq_feature_names])

    org_dummies = pd.get_dummies(df["organism"].fillna("E. coli"), prefix="org")
    for org in ORGANISMS:
        col = f"org_{org}"
        if col not in org_dummies.columns:
            org_dummies[col] = 0
    org_dummies = org_dummies[[f"org_{org}" for org in ORGANISMS]]

    seq_matrix = np.array(feature_rows, dtype=float)
    org_matrix = org_dummies.to_numpy(dtype=float)
    feature_names = seq_feature_names + list(org_dummies.columns)
    return np.hstack([seq_matrix, org_matrix]), feature_names


def _build_rbs_matrix(df: pd.DataFrame) -> tuple[np.ndarray, list[str]]:
    feature_names: list[str] | None = None
    feature_rows: list[list[float]] = []

    for _, row in df.iterrows():
        feats = extract_features(row["sequence"], "rbs")
        if feature_names is None:
            feature_names = list(feats.keys())
        feature_rows.append([feats[name] for name in feature_names])

    return np.array(feature_rows, dtype=float), feature_names


def _train_gbm(
    X: np.ndarray,
    y: np.ndarray,
    label: str,
) -> tuple[GradientBoostingRegressor, StandardScaler, dict[str, float]]:
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = GradientBoostingRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        random_state=42,
    )
    model.fit(X_train_scaled, y_train)

    y_pred = model.predict(X_test_scaled)
    cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=5, scoring="r2")
    metrics = {
        "mae": float(mean_absolute_error(y_test, y_pred)),
        "r2": float(r2_score(y_test, y_pred)),
        "cv_r2_mean": float(cv_scores.mean()),
        "cv_r2_std": float(cv_scores.std()),
    }
    print(f"\n-- {label} results ----------------")
    print(f"MAE:  {metrics['mae']:.4f}")
    print(f"R2:   {metrics['r2']:.4f}")
    print(
        f"CV R2 (5-fold): {metrics['cv_r2_mean']:.4f} +/- {metrics['cv_r2_std']:.4f}"
    )
    return model, scaler, metrics


def _save_model(path: str, model, scaler, feature_names: list[str]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as handle:
        pickle.dump(
            {
                "model": model,
                "scaler": scaler,
                "feature_names": feature_names,
            },
            handle,
        )
    print(f"Model saved to {path}")


def train_promoter() -> None:
    try:
        df = pd.read_csv(PROMOTER_CSV)
    except FileNotFoundError as exc:
        raise SystemExit(
            "ERROR: Could not find promoter_training_final.csv — "
            "run python -m backend.data.combine_datasets first"
        ) from exc

    df = df.dropna(subset=["sequence", "rpu"])
    df["sequence"] = df["sequence"].str.upper().str.strip()
    sources = ", ".join(sorted(df["source"].dropna().unique()))
    print(f"Training promoter model on {len(df)} rows ({sources})")

    X, feature_names = _build_promoter_matrix(df)
    y = df["rpu"].astype(float).to_numpy()
    print(f"Feature matrix shape: {X.shape}")
    print(f"RPU range: {y.min():.3f} – {y.max():.3f}")

    model, scaler, _ = _train_gbm(X, y, "Promoter (RPU)")
    _save_model(PROMOTER_MODEL_PATH, model, scaler, feature_names)

    if os.path.exists(ANDERSON_CSV):
        anderson = pd.read_csv(ANDERSON_CSV).dropna(subset=["sequence", "rpu"])
        anderson["sequence"] = anderson["sequence"].str.upper().str.strip()
        anderson["organism"] = "E. coli"
        X_anderson, _ = _build_promoter_matrix(anderson)
        y_anderson = anderson["rpu"].astype(float).to_numpy()
        preds = model.predict(scaler.transform(X_anderson))
        print(f"R2 on Anderson set ({len(anderson)} rows): {r2_score(y_anderson, preds):.4f}")


def train_rbs() -> None:
    try:
        df = pd.read_csv(RBS_CSV)
    except FileNotFoundError as exc:
        raise SystemExit(
            "ERROR: Could not find salis_rbs_clean.csv — "
            "run python -m backend.data.fetch_salis first"
        ) from exc

    df = df.dropna(subset=["sequence", "translation_rate"])
    df["sequence"] = df["sequence"].astype(str).str.upper().str.strip()
    rates = df["translation_rate"].astype(float)
    df["translation_rate_norm"] = (rates - rates.min()) / (rates.max() - rates.min())

    print(f"\nTraining RBS model on {len(df)} Salis sequences")
    X, feature_names = _build_rbs_matrix(df)
    y = df["translation_rate_norm"].to_numpy()
    print(f"Feature matrix shape: {X.shape}")
    print(f"Translation rate range (normalized): {y.min():.3f} – {y.max():.3f}")

    model, scaler, _ = _train_gbm(X, y, "RBS (translation rate)")
    _save_model(RBS_MODEL_PATH, model, scaler, feature_names)


def main() -> None:
    train_promoter()
    train_rbs()


if __name__ == "__main__":
    main()
