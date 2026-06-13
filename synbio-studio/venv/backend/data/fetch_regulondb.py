"""Fetch and filter RegulonDB promoter set for Task A (promoter strength)."""

from __future__ import annotations

import io
import random
import re
from pathlib import Path

import pandas as pd
import requests

MIRROR_URL = (
    "https://raw.githubusercontent.com/regulondb/regulondb-datasets/main/"
    "promoters/PromoterSet.txt"
)
GRAPHQL_URL = "https://regulondb.ccg.unam.mx/graphql"
ANDERSON_PATH = Path("backend/data/anderson_promoters.csv")
OUTPUT_PATH = Path("backend/data/regulondb_promoters.csv")
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

SIGMA_RPU = {
    "sigma70": 1.0,
    "sigma38": 0.6,
    "sigma32": 0.5,
    "sigma28": 0.4,
    "sigma24": 0.3,
    "sigma19": 0.2,
    "unknown": 0.3,
}

SIGMA_MUTATION_RANGES = {
    "sigma70": (0, 1),
    "sigma38": (1, 2),
    "sigma32": (2, 3),
    "sigma28": (2, 4),
    "sigma24": (3, 5),
    "sigma19": (4, 6),
}

GRAPHQL_QUERY = """
{
  getAllPromoter {
    promoterName
    sequence
    sigma
    bindsSigmaFactor { confidenceLevel }
  }
}
"""

BASES = "ATCG"
MIN35 = "TTGACA"
MIN10 = "TATAAT"


def _map_sigma(value: str) -> float:
    key = re.sub(r"[^a-z0-9]", "", value.strip().lower())
    for sigma_key, rpu in SIGMA_RPU.items():
        if sigma_key in key or key in sigma_key:
            return rpu
    return 0.3


def _filter_row(sequence: str, rpu: float, source: str) -> dict[str, object] | None:
    sequence = re.sub(r"\s+", "", sequence.upper())
    if not sequence or not re.fullmatch(r"[ATCG]+", sequence):
        return None
    if not (30 <= len(sequence) <= 300):
        return None
    return {
        "sequence": sequence,
        "rpu": rpu,
        "organism": "E. coli",
        "source": source,
    }


def _fetch_mirror_tsv() -> pd.DataFrame | None:
    try:
        response = requests.get(
            MIRROR_URL, headers={"User-Agent": USER_AGENT}, timeout=120
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        print(f"WARNING: RegulonDB mirror fetch failed: {exc}")
        return None

    content_type = response.headers.get("Content-Type", "")
    if content_type.startswith("text/html") or response.text.lstrip().startswith("<!"):
        print("WARNING: RegulonDB mirror returned HTML, not TSV")
        return None

    rows: list[dict[str, object]] = []
    total = 0
    for line in response.text.splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        total += 1
        parts = line.split("\t")
        if len(parts) < 6:
            continue
        strand = parts[2].strip().lower()
        sigma_raw = parts[4].strip()
        sequence = parts[5]
        if strand != "forward":
            continue
        parsed = _filter_row(sequence, _map_sigma(sigma_raw), "regulondb")
        if parsed:
            rows.append(parsed)

    if not rows:
        return None
    print(f"RegulonDB mirror TSV: {total} downloaded, {len(rows)} after filtering")
    return pd.DataFrame(rows)


def _fetch_graphql() -> pd.DataFrame | None:
    try:
        response = requests.post(
            GRAPHQL_URL,
            json={"query": GRAPHQL_QUERY},
            headers={"User-Agent": USER_AGENT, "Content-Type": "application/json"},
            timeout=120,
            verify=False,
        )
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        print(f"WARNING: RegulonDB GraphQL fetch failed: {exc}")
        return None

    promoters = payload.get("data", {}).get("getAllPromoter")
    if not promoters:
        print("WARNING: RegulonDB GraphQL returned no promoters")
        return None

    rows: list[dict[str, object]] = []
    for item in promoters:
        sequence = str(item.get("sequence", ""))
        sigma = str(item.get("sigma", "unknown"))
        parsed = _filter_row(sequence, _map_sigma(sigma), "regulondb")
        if parsed:
            rows.append(parsed)

    if not rows:
        return None
    print(f"RegulonDB GraphQL: {len(promoters)} downloaded, {len(rows)} after filtering")
    return pd.DataFrame(rows)


def _mutate_boxes(seed: str, sigma: str, idx: int) -> str:
    rng = random.Random(123 + idx)
    seq = list(seed.upper())
    minus35 = seed.upper().find(MIN35)
    minus10 = seed.upper().find(MIN10)
    if minus35 < 0:
        minus35 = 0
    if minus10 < 0:
        minus10 = max(0, len(seq) - 6)
    box35 = list(range(minus35, min(minus35 + 6, len(seq))))
    box10 = list(range(minus10, min(minus10 + 6, len(seq))))
    lo, hi = SIGMA_MUTATION_RANGES.get(sigma, (2, 4))
    n_mut = rng.randint(lo, hi)
    positions = rng.sample(box35 + box10, k=min(n_mut, len(box35 + box10)))
    for pos in positions:
        seq[pos] = rng.choice([b for b in BASES if b != seq[pos]])
    return "".join(seq)


def _build_synthetic() -> pd.DataFrame:
    print(
        "WARNING: RegulonDB fetch failed — using sigma-factor synthetic fallback.\n"
        "         All sequences derived from Anderson consensus mutations."
    )
    if ANDERSON_PATH.exists():
        anderson = pd.read_csv(ANDERSON_PATH)
        seed = str(anderson.iloc[0]["sequence"]).upper()
    else:
        seed = MIN35 + ("A" * 17) + MIN10

    rows: list[dict[str, object]] = []
    idx = 0
    for sigma in ("sigma70", "sigma38", "sigma32", "sigma28", "sigma24", "sigma19"):
        rpu = SIGMA_RPU[sigma]
        for _ in range(100):
            sequence = _mutate_boxes(seed, sigma, idx)
            idx += 1
            if len(sequence) < 30:
                sequence = (sequence + "A" * 30)[:30]
            parsed = _filter_row(sequence, rpu, "regulondb_synthetic")
            if parsed:
                rows.append(parsed)
    return pd.DataFrame(rows)


def _cap_rows(df: pd.DataFrame, limit: int = 800) -> pd.DataFrame:
    if len(df) > limit:
        return df.sample(n=limit, random_state=42).reset_index(drop=True)
    return df


def main() -> None:
    df = _fetch_mirror_tsv()
    if df is None:
        df = _fetch_graphql()
    if df is None:
        df = _build_synthetic()

    df = _cap_rows(df)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Total after filtering: {len(df)}")
    print(f"Saved {len(df)} rows to {OUTPUT_PATH}")
    if "source" in df.columns:
        print("Sources:", dict(df["source"].value_counts()))


if __name__ == "__main__":
    main()
