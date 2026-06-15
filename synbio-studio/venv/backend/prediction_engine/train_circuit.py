"""
Train circuit-level protein yield GBM.
Usage: python -m backend.prediction_engine.train_circuit
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

CIRCUIT_CSV = "backend/data/circuit_training.csv"
MODEL_PATH = "backend/prediction_engine/models/gbm_circuit_v1.pkl"
FEATURE_NAMES = [
    "promoter_rpu",
    "translation_rate",
    "gene_length",
    "terminator_efficiency",
]


def main() -> None:
    try:
        df = pd.read_csv(CIRCUIT_CSV)
    except FileNotFoundError as exc:
        raise SystemExit(
            "ERROR: Could not find circuit_training.csv — "
            "run python -m backend.data.build_circuit_training first"
        ) from exc

    missing = [col for col in FEATURE_NAMES + ["protein_yield"] if col not in df.columns]
    if missing:
        raise SystemExit(f"ERROR: circuit_training.csv missing columns: {missing}")

    df = df.dropna(subset=FEATURE_NAMES + ["protein_yield"])
    print(f"Training circuit yield model on {len(df)} rows")

    X = df[FEATURE_NAMES].astype(float).to_numpy()
    y = df["protein_yield"].astype(float).to_numpy()
    print(f"Feature matrix shape: {X.shape}")
    print(f"Yield range: {y.min():.2f} – {y.max():.2f}")

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
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=5, scoring="r2")

    print("\n-- Circuit yield results -------------")
    print(f"MAE:  {mae:.4f}")
    print(f"R2:   {r2:.4f}")
    print(f"CV R2 (5-fold): {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}")

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    with open(MODEL_PATH, "wb") as handle:
        pickle.dump(
            {
                "model": model,
                "scaler": scaler,
                "feature_names": FEATURE_NAMES,
            },
            handle,
        )
    print(f"\nModel saved to {MODEL_PATH}")


if __name__ == "__main__":
    main()
