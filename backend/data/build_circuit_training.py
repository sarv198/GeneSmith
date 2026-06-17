"""
Build circuit-level training data for protein yield GBM.
Usage: python -m backend.data.build_circuit_training
"""

from __future__ import annotations

import itertools
from pathlib import Path

import numpy as np
import pandas as pd

PROMOTER_CSV = Path("backend/data/promoter_training_final.csv")
RBS_CSV = Path("backend/data/salis_rbs_clean.csv")
PARTS_CSV = Path("backend/data/parts_master.csv")
OUTPUT_CSV = Path("backend/data/circuit_training.csv")
MAX_ROWS = 2000


def _heuristic_yield(
    promoter_rpu: float,
    translation_rate: float,
    gene_length: int,
    terminator_efficiency: float,
) -> float:
    safe_length = max(gene_length, 1)
    return float(
        promoter_rpu
        * (translation_rate * 100_000)
        * terminator_efficiency
        * (1.0 / np.log1p(safe_length))
        * 1000
    )


def main() -> None:
    for path in (PROMOTER_CSV, RBS_CSV, PARTS_CSV):
        if not path.exists():
            raise SystemExit(
                f"ERROR: Missing {path} — run combine_datasets and fetch_salis first"
            )

    promoters = pd.read_csv(PROMOTER_CSV).dropna(subset=["rpu"])
    promoters = promoters.sample(n=min(100, len(promoters)), random_state=42)
    promoter_rpus = promoters["rpu"].astype(float).tolist()

    rbs = pd.read_csv(RBS_CSV).dropna(subset=["translation_rate"])
    rates = rbs["translation_rate"].astype(float)
    rbs["translation_rate_norm"] = (rates - rates.min()) / (rates.max() - rates.min())
    rbs = rbs.sample(n=min(100, len(rbs)), random_state=42)
    translation_rates = rbs["translation_rate_norm"].tolist()

    parts = pd.read_csv(PARTS_CSV)
    cds = parts[parts["part_type"].str.lower().isin({"cds", "gene"})]
    cds_lengths = cds["sequence"].astype(str).str.len()
    cds_lengths = cds_lengths[cds_lengths > 0]
    if cds_lengths.empty:
        cds_lengths = pd.Series([300, 500, 720, 900, 1200])
    gene_lengths = (
        cds_lengths.sample(n=min(50, len(cds_lengths)), random_state=42)
        .astype(int)
        .tolist()
    )

    terminator_efficiencies = [0.85, 0.90, 0.95]
    rows: list[dict[str, float | int]] = []

    for rpu, tr, glen, teff in itertools.product(
        promoter_rpus, translation_rates, gene_lengths, terminator_efficiencies
    ):
        rows.append(
            {
                "promoter_rpu": round(float(rpu), 6),
                "translation_rate": round(float(tr), 6),
                "gene_length": int(glen),
                "terminator_efficiency": float(teff),
                "protein_yield": round(
                    _heuristic_yield(float(rpu), float(tr), int(glen), float(teff)), 4
                ),
            }
        )
        if len(rows) >= MAX_ROWS:
            break

    df = pd.DataFrame(rows)
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"Built {len(df)} circuit training rows -> {OUTPUT_CSV}")
    print(
        "Yield range: "
        f"{df['protein_yield'].min():.2f} – {df['protein_yield'].max():.2f} molecules/cell/hour"
    )


if __name__ == "__main__":
    main()
