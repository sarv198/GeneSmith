"""
Run this script once to train your model on combined promoter data.
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
MODEL_PATH = "backend/prediction_engine/models/gbm_v1.pkl"
ORGANISMS = ["E. coli", "synthetic", "B. subtilis", "P. putida"]


def _build_feature_matrix(df: pd.DataFrame) -> tuple[np.ndarray, list[str]]:
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


def main() -> None:
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
    print(f"Training on {len(df)} characterized promoters ({sources})")

    X, feature_names = _build_feature_matrix(df)
    y = df["rpu"].astype(float).to_numpy()
    print(f"Feature matrix shape: {X.shape}")
    print(f"Expression range: {y.min():.3f} – {y.max():.3f} RPU")

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

    print("\n-- Results ---------------------")
    print(f"MAE:  {mae:.4f} RPU")
    print(f"R2:   {r2:.4f}")
    print(f"CV R2 (5-fold): {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}")

    anderson_r2 = None
    if os.path.exists(ANDERSON_CSV):
        anderson = pd.read_csv(ANDERSON_CSV).dropna(subset=["sequence", "rpu"])
        anderson["sequence"] = anderson["sequence"].str.upper().str.strip()
        anderson["organism"] = "E. coli"
        X_anderson, _ = _build_feature_matrix(anderson)
        y_anderson = anderson["rpu"].astype(float).to_numpy()
        preds = model.predict(scaler.transform(X_anderson))
        anderson_r2 = r2_score(y_anderson, preds)
        print(f"R2 on held-out Anderson set ({len(anderson)} rows): {anderson_r2:.4f}")

    print("\n-- Training set comparison -------")
    print("Previous training set: 19 rows (Anderson only)")
    print(f"New training set: {len(df)} rows ({sources} combined)")
    if anderson_r2 is not None:
        print(f"R2 on Anderson test set (apples-to-apples): {anderson_r2:.4f}")

    importances = sorted(
        zip(feature_names, model.feature_importances_),
        key=lambda item: -item[1],
    )
    print("\n-- Top 5 Features --------------")
    for name, importance in importances[:5]:
        print(f"  {name}: {importance:.4f}")

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    with open(MODEL_PATH, "wb") as handle:
        pickle.dump(
            {
                "model": model,
                "scaler": scaler,
                "feature_names": feature_names,
            },
            handle,
        )

    print(f"\nModel saved to {MODEL_PATH}")


if __name__ == "__main__":
    main()
