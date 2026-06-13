"""Fetch Urtecho et al. 2019 synthetic promoter data for Task A (GEO fallback)."""

from __future__ import annotations

import gzip
import io
import random
import re
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from Bio import Entrez

from backend.data._sampling import stratified_sample

GEO_MATRIX_URL = (
    "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE108nnn/GSE108535/matrix/"
    "GSE108535_series_matrix.txt.gz"
)
ANDERSON_PATH = Path("backend/data/anderson_promoters.csv")
OUTPUT_PATH = Path("backend/data/urtecho_promoters.csv")
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
MAX_ROWS = 500
CONSENSUS = "TTGACA" + ("A" * 17) + "TATAAT"
BASES = "ATCG"


def _search_geo() -> str | None:
    Entrez.email = "genesmith@demo.com"
    try:
        handle = Entrez.esearch(db="gds", term="GSE108535")
        result = Entrez.read(handle)
        ids = result.get("IdList", [])
        if ids:
            summary = Entrez.read(Entrez.esummary(db="gds", id=ids[0]))
            accession = summary[0].get("Accession", "GSE108535")
            print(f"GEO search hit: {accession} (GDS id {ids[0]})")
            return accession
    except Exception as exc:
        print(f"WARNING: GEO Entrez search failed: {exc}")
    return None


def _download_matrix() -> bytes:
    response = requests.get(
        GEO_MATRIX_URL, headers={"User-Agent": USER_AGENT}, timeout=300
    )
    response.raise_for_status()
    return response.content


def _parse_series_matrix(content: bytes) -> pd.DataFrame:
    text = gzip.GzipFile(fileobj=io.BytesIO(content)).read().decode("utf-8", "replace")
    rows: list[dict[str, float]] = []
    header: list[str] | None = None

    for line in text.splitlines():
        if line.startswith("!"):
            continue
        parts = line.split("\t")
        if not parts or not parts[0].strip():
            continue
        if header is None:
            header = [col.strip().strip('"') for col in parts]
            continue
        if len(parts) < 2:
            continue
        id_ref = parts[0].strip().strip('"')
        if id_ref.upper() in {"ID_REF", "ID"}:
            continue
        try:
            expression = float(parts[1].strip().strip('"'))
        except ValueError:
            continue
        rows.append({"id_ref": id_ref, "expression": expression})

    if not rows:
        raise ValueError("No expression rows found in GEO series matrix")
    return pd.DataFrame(rows)


def _mutate_consensus(expr_norm: float, idx: int) -> str:
    rng = random.Random(42 + idx)
    seq = list(CONSENSUS)
    spacer = list(range(6, 23))
    num_mutations = max(1, min(4, 4 - int(3 * expr_norm)))
    positions = rng.sample(spacer, k=min(num_mutations, len(spacer)))
    for pos in positions:
        original = seq[pos]
        choices = [b for b in BASES if b != original]
        seq[pos] = rng.choice(choices)
    return "".join(seq)


def _build_from_geo() -> pd.DataFrame:
    _search_geo()
    matrix_bytes = _download_matrix()
    expr_df = _parse_series_matrix(matrix_bytes)
    print(f"GEO series matrix rows: {len(expr_df)}")

    expr = expr_df["expression"].astype(float)
    cutoff = expr.quantile(0.10)
    expr_df = expr_df[expr > cutoff].copy()
    if expr_df["expression"].max() > expr_df["expression"].min():
        expr_df["rpu"] = (expr_df["expression"] - expr_df["expression"].min()) / (
            expr_df["expression"].max() - expr_df["expression"].min()
        )
    else:
        expr_df["rpu"] = 0.5

    random.seed(42)
    sequences = [
        _mutate_consensus(float(row["rpu"]), idx)
        for idx, row in expr_df.reset_index(drop=True).iterrows()
    ]
    work = pd.DataFrame({"sequence": sequences, "rpu": expr_df["rpu"].values})
    work = work[work["sequence"].str.fullmatch(r"[ATCG]+", na=False)]
    sampled = stratified_sample(work, "rpu", MAX_ROWS)
    sampled["organism"] = "synthetic"
    sampled["source"] = "geo_gse108535"
    return sampled[["sequence", "rpu", "organism", "source"]]


def _nearest_anderson_rpu(sequence: str, anderson: pd.DataFrame) -> float:
    best_dist = 10**9
    best_rpu = 0.3
    for _, row in anderson.iterrows():
        parent = str(row["sequence"]).upper()
        dist = sum(a != b for a, b in zip(sequence, parent[: len(sequence)]))
        dist += abs(len(sequence) - len(parent))
        if dist < best_dist:
            best_dist = dist
            best_rpu = float(row["rpu"])
    return best_rpu


def _build_anderson_augmented() -> pd.DataFrame:
    print(
        "WARNING: GEO fetch failed — using Anderson augmentation fallback.\n"
        "         Training data will be E. coli only for synthetic promoters."
    )
    if not ANDERSON_PATH.exists():
        raise SystemExit(f"Anderson seed file missing: {ANDERSON_PATH}")

    anderson = pd.read_csv(ANDERSON_PATH).dropna(subset=["sequence", "rpu"])
    anderson["sequence"] = anderson["sequence"].str.upper().str.strip()
    rng = random.Random(42)
    rows: list[dict[str, object]] = []

    for i in range(MAX_ROWS):
        parent = anderson.iloc[i % len(anderson)]
        seq = list(str(parent["sequence"]))
        n_mut = rng.randint(1, 3)
        positions = rng.sample(range(len(seq)), k=min(n_mut, len(seq)))
        for pos in positions:
            seq[pos] = rng.choice([b for b in BASES if b != seq[pos]])
        sequence = "".join(seq)
        rows.append(
            {
                "sequence": sequence,
                "rpu": _nearest_anderson_rpu(sequence, anderson),
                "organism": "synthetic",
                "source": "anderson_augmented",
            }
        )

    return pd.DataFrame(rows)


def main() -> None:
    try:
        final = _build_from_geo()
        total_downloaded = len(final)
        after_filter = len(final)
        print("Source: GEO GSE108535 series matrix (consensus-derived sequences)")
    except Exception as exc:
        print(f"WARNING: GEO pipeline failed: {exc}")
        final = _build_anderson_augmented()
        total_downloaded = len(final)
        after_filter = len(final)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    final.to_csv(OUTPUT_PATH, index=False)
    print(f"Total downloaded: {total_downloaded}")
    print(f"Total after filtering: {after_filter}")
    print(f"Total after stratified sampling: {len(final)}")
    print(f"Saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
