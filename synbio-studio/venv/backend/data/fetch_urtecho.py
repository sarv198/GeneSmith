"""Fetch Urtecho et al. 2019 synthetic promoter data for Task A."""

from __future__ import annotations

import gzip
import io
import re
from pathlib import Path

import numpy as np
import pandas as pd
import requests

from backend.data._sampling import stratified_sample

PRIMARY_URL = (
    "https://raw.githubusercontent.com/rebeccajohnson88/promoter_ML/master/data/promoters.csv"
)
GEO_MAPPING_URL = (
    "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE108nnn/GSE108535/suppl/"
    "GSE108535_barcode_mapping.txt.gz"
)
GEO_COUNTS_URL = (
    "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE108nnn/GSE108535/suppl/"
    "GSE108535_barcode_counts_normalized.txt.gz"
)
OUTPUT_PATH = Path("backend/data/urtecho_promoters.csv")
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
MAX_ROWS = 2000


def _get_bytes(url: str) -> bytes:
    try:
        response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=300)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise SystemExit(f"Failed to download Urtecho data from {url}: {exc}") from exc
    return response.content


def _load_primary_csv() -> pd.DataFrame | None:
    try:
        response = requests.get(PRIMARY_URL, headers={"User-Agent": USER_AGENT}, timeout=60)
        if response.status_code != 200:
            return None
        return pd.read_csv(io.StringIO(response.text))
    except requests.RequestException:
        return None


def _load_geo_fallback() -> pd.DataFrame:
    print(
        "WARNING: Primary GitHub URL unavailable. "
        "Using Urtecho et al. 2019 GEO accession GSE108535 (barcode mapping + RNA counts)."
    )
    mapping = gzip.GzipFile(
        fileobj=io.BytesIO(_get_bytes(GEO_MAPPING_URL))
    ).read().decode("utf-8", "replace")
    counts = gzip.GzipFile(
        fileobj=io.BytesIO(_get_bytes(GEO_COUNTS_URL))
    ).read().decode("utf-8", "replace")

    barcode_to_seq: dict[str, str] = {}
    for line in mapping.splitlines()[1:]:
        match = re.match(r"^(\S+)\s+([ATCG]+)\s+(.+)$", line.strip())
        if match:
            barcode_to_seq[match.group(1)] = match.group(2).upper()

    rows: list[dict[str, object]] = []
    header = counts.splitlines()[0].split()
    rna_cols = [col for col in header if "RNA" in col]
    for line in counts.splitlines()[1:]:
        parts = line.split()
        if len(parts) < 2:
            continue
        barcode = parts[0]
        seq = barcode_to_seq.get(barcode)
        if not seq:
            continue
        rna_vals = []
        for col in rna_cols:
            idx = header.index(col)
            if idx < len(parts):
                val = parts[idx]
                if val not in {"NA", "nan", ""}:
                    try:
                        rna_vals.append(float(val))
                    except ValueError:
                        pass
        if not rna_vals:
            continue
        rows.append({"sequence": seq, "fluorescence": float(np.mean(rna_vals))})

    return pd.DataFrame(rows)


def _filter_and_sample(df: pd.DataFrame) -> tuple[pd.DataFrame, int, int]:
    seq_col = next((c for c in df.columns if c.lower() == "sequence"), None)
    flu_col = next(
        (c for c in df.columns if c.lower() in {"fluorescence", "rna_exp_average", "expression"}),
        None,
    )
    if seq_col is None or flu_col is None:
        raise SystemExit(f"Could not find sequence/fluorescence columns in: {list(df.columns)}")

    work = df[[seq_col, flu_col]].copy()
    work.columns = ["sequence", "fluorescence"]
    work["sequence"] = work["sequence"].astype(str).str.upper().str.replace(r"\s+", "", regex=True)
    work["fluorescence"] = pd.to_numeric(work["fluorescence"], errors="coerce")
    after_download = len(work)

    valid = work["sequence"].str.fullmatch(r"[ATCG]+", na=False)
    work = work[valid]
    work = work[(work["sequence"].str.len() >= 30) & (work["sequence"].str.len() <= 200)]
    work = work.dropna(subset=["fluorescence"])

    cutoff = work["fluorescence"].quantile(0.10)
    work = work[work["fluorescence"] > cutoff]
    after_filter = len(work)

    if work["fluorescence"].max() > work["fluorescence"].min():
        work["rpu"] = (work["fluorescence"] - work["fluorescence"].min()) / (
            work["fluorescence"].max() - work["fluorescence"].min()
        )
    else:
        work["rpu"] = 0.0

    sampled = stratified_sample(work, "rpu", MAX_ROWS)
    sampled = sampled[["sequence", "rpu"]].copy()
    sampled["organism"] = "synthetic"
    sampled["source"] = "urtecho"
    return sampled, after_download, after_filter


def main() -> None:
    df = _load_primary_csv()
    if df is None:
        df = _load_geo_fallback()
    else:
        print("Columns in raw Urtecho dataset:")
        for column in df.columns:
            print(f"  - {column}")

    final, total_downloaded, after_filter = _filter_and_sample(df)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    final.to_csv(OUTPUT_PATH, index=False)
    print(f"Total downloaded: {total_downloaded}")
    print(f"Total after filtering: {after_filter}")
    print(f"Total after stratified sampling: {len(final)}")
    print(f"Saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
