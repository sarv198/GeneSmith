"""Fetch and filter RegulonDB promoter set for Task A (promoter strength)."""

from __future__ import annotations

import io
import re
from pathlib import Path

import pandas as pd
import requests

PRIMARY_URL = "https://regulondb.ccg.unam.mx/menu/download/datasets/files/PromoterSet.txt"
FALLBACK_URL = (
    "https://media.githubusercontent.com/media/maalcantar/promoter_ML/master/"
    "data/RegulonDB/20191127_PromoterSet.txt"
)
OUTPUT_PATH = Path("backend/data/regulondb_promoters.csv")
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

STRENGTH_TO_RPU = {"strong": 1.0, "medium": 0.5, "weak": 0.2}
SIGMA70_FALLBACK_RPU = 0.5


def _download_text(url: str) -> str:
    try:
        response = requests.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=120,
            verify=False,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise SystemExit(f"Failed to download RegulonDB data from {url}: {exc}") from exc
    return response.text


def _load_promoter_set() -> str:
    text = _download_text(PRIMARY_URL)
    if text.lstrip().startswith("<!") or text.lstrip().startswith("<html"):
        print(
            "WARNING: Primary RegulonDB URL returned HTML (SPA redirect). "
            f"Using archived mirror of PromoterSet.txt from {FALLBACK_URL}"
        )
        text = _download_text(FALLBACK_URL)
    return text


def _map_strength(value: str) -> float | None:
    key = value.strip().lower()
    if key in STRENGTH_TO_RPU:
        return STRENGTH_TO_RPU[key]
    if key == "sigma70":
        return SIGMA70_FALLBACK_RPU
    return None


def parse_promoter_set(text: str) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    total = 0
    for line in text.splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        total += 1
        parts = line.split("\t")
        if len(parts) < 6:
            continue
        strand = parts[2].strip().lower()
        strength_raw = parts[4].strip()
        sequence = re.sub(r"\s+", "", parts[5].upper())
        if strand != "forward":
            continue
        if not sequence or not re.fullmatch(r"[ATCG]+", sequence):
            continue
        if not (30 <= len(sequence) <= 300):
            continue
        rpu = _map_strength(strength_raw)
        if rpu is None:
            continue
        rows.append(
            {
                "sequence": sequence,
                "rpu": rpu,
                "organism": "E. coli",
                "source": "regulondb",
            }
        )

    df = pd.DataFrame(rows)
    if len(df) > 800:
        df = df.sample(n=800, random_state=42).reset_index(drop=True)
    return df, total


def main() -> None:
    text = _load_promoter_set()
    df, total_downloaded = parse_promoter_set(text)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Total downloaded rows: {total_downloaded}")
    print(f"Total after filtering: {len(df)}")
    print(f"Saved {len(df)} rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
