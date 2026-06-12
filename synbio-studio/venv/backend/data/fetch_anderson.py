"""Fetch and clean Anderson promoter collection from parts.igem.org."""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd
import requests
from bs4 import BeautifulSoup

ANDERSON_URL = "https://parts.igem.org/Promoters/Catalog/Anderson"
OUTPUT_PATH = Path(__file__).resolve().parent / "anderson_promoters.csv"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _parse_rpu(value: str) -> float | None:
    text = value.strip().lower()
    if not text or text in {"n/a", "na", "-", ""}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def fetch_anderson_promoters() -> pd.DataFrame:
    headers = {"User-Agent": USER_AGENT}
    try:
        response = requests.get(ANDERSON_URL, headers=headers, timeout=30)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise SystemExit(
            f"Failed to fetch Anderson promoters from {ANDERSON_URL}: {exc}"
        ) from exc

    soup = BeautifulSoup(response.text, "html.parser")
    table = soup.find("table")
    if table is None:
        raise SystemExit(f"No HTML table found at {ANDERSON_URL}")

    rows: list[dict[str, object]] = []
    for tr in table.find_all("tr")[1:]:
        cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
        if len(cells) < 3:
            continue
        part_id, sequence, rpu_raw = cells[0], cells[1], cells[2]
        sequence = re.sub(r"\s+", "", sequence).upper()
        rpu = _parse_rpu(rpu_raw)
        if not sequence or rpu is None:
            continue
        rows.append({"part_id": part_id, "sequence": sequence, "rpu": rpu})

    return pd.DataFrame(rows, columns=["part_id", "sequence", "rpu"])


def main() -> None:
    df = fetch_anderson_promoters()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Saved {len(df)} rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
