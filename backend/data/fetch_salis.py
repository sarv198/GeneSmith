"""Fetch and clean Salis Lab RBS dataset.

The RBS Calculator source code lives at:
  https://github.com/hsalis/Ribosome-Binding-Site-Calculator-v1.0

That repository ships Python calculator code only (no bundled CSV).
Published RBS measurements used to train/validate the calculator are hosted
in the companion SalisLabCode repository as supplementary XLS files.
This module downloads those files via HTTP, assembles a unified CSV, and cleans it.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import requests

RBS_CALCULATOR_REPO = (
    "https://github.com/hsalis/Ribosome-Binding-Site-Calculator-v1.0"
)
SALISLAB_DATASETS_BASE = (
    "https://github.com/hsalis/SalisLabCode/raw/master/"
    "ModelTestSystem/examples/RBS/datasets"
)
DATASET_FILES = (
    "Salis_Nat_Biotech_2009.xls",
    "EspahBorujeni_NAR_2013.xls",
    "EspahBorujeni_NAR_2013_extended.xls",
)
RAW_OUTPUT_PATH = Path(__file__).resolve().parent / "salis_rbs_raw.csv"
CLEAN_OUTPUT_PATH = Path(__file__).resolve().parent / "salis_rbs_clean.csv"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

SEQUENCE_COLUMN_HINTS = (
    "rbs sequence",
    "rbs_sequence",
    "sequence",
    "5putr",
    "5p utr",
    "mrna",
    "rbs",
)
RATE_COLUMN_HINTS = (
    "translation initiation rate",
    "translation_rate",
    "translation rate",
    "tir",
    "measured translation",
    "prot.mean",
    "protein expression",
    "expression",
    "fluorescence",
)


def _normalize_column_name(name: str) -> str:
    return name.strip().lower().replace(".", "").replace("_", " ")


def _find_column(columns: list[str], hints: tuple[str, ...]) -> str | None:
    normalized = {_normalize_column_name(col): col for col in columns}
    for hint in hints:
        for norm, original in normalized.items():
            if hint in norm:
                return original
    return None


def _open_xls(content: bytes):
    try:
        import xlrd
    except ImportError as exc:
        raise SystemExit(
            "xlrd is required to read Salis Lab .xls supplementary files. "
            "Install with: pip install xlrd"
        ) from exc
    return xlrd.open_workbook(file_contents=content)


def _load_2009(content: bytes) -> pd.DataFrame:
    sheet = _open_xls(content).sheet_by_index(0)
    rows = []
    for ridx in range(3, sheet.nrows):
        row = sheet.row_values(ridx)
        if len(row) < 6:
            continue
        sequence = str(row[3]).strip().upper()
        rate = row[4]
        if sequence and sequence != "NAN" and isinstance(rate, (int, float)):
            rows.append(
                {"RBS Sequence": sequence, "Translation Initiation Rate": rate}
            )
    return pd.DataFrame(rows)


def _load_nar_2013(content: bytes) -> pd.DataFrame:
    sheet = _open_xls(content).sheet_by_index(0)
    rows = []
    for ridx in range(5, sheet.nrows):
        row = sheet.row_values(ridx)
        if len(row) < 10:
            continue
        utr = str(row[5]).strip().upper()
        cds = str(row[6]).strip().upper()
        rate = row[8]
        sequence = utr + cds
        if sequence and isinstance(rate, (int, float)):
            rows.append(
                {"RBS Sequence": sequence, "Translation Initiation Rate": rate}
            )
    return pd.DataFrame(rows)


def _load_nar_2013_ext(content: bytes) -> pd.DataFrame:
    sheet = _open_xls(content).sheet_by_index(0)
    rows = []
    for ridx in range(3, sheet.nrows):
        row = sheet.row_values(ridx)
        if len(row) < 10:
            continue
        utr = str(row[3]).strip().upper()
        cds = str(row[5]).strip().upper()
        rate = row[8]
        sequence = utr + cds
        if sequence and isinstance(rate, (int, float)):
            rows.append(
                {"RBS Sequence": sequence, "Translation Initiation Rate": rate}
            )
    return pd.DataFrame(rows)


_DATASET_LOADERS = {
    "Salis_Nat_Biotech_2009.xls": _load_2009,
    "EspahBorujeni_NAR_2013.xls": _load_nar_2013,
    "EspahBorujeni_NAR_2013_extended.xls": _load_nar_2013_ext,
}


def fetch_raw_dataset() -> pd.DataFrame:
    """Download published Salis RBS measurements and assemble a unified table."""
    headers = {"User-Agent": USER_AGENT}
    frames: list[pd.DataFrame] = []

    for filename in DATASET_FILES:
        url = f"{SALISLAB_DATASETS_BASE}/{filename}"
        try:
            response = requests.get(url, headers=headers, timeout=60)
            response.raise_for_status()
        except requests.RequestException as exc:
            raise SystemExit(
                f"Failed to fetch Salis RBS dataset file {url} "
                f"(companion data for {RBS_CALCULATOR_REPO}): {exc}"
            ) from exc

        loader = _DATASET_LOADERS[filename]
        frame = loader(response.content)
        print(f"Loaded {len(frame)} rows from {filename}")
        frames.append(frame)

    if not frames:
        raise SystemExit("No Salis RBS dataset rows were loaded.")

    return pd.concat(frames, ignore_index=True)


def identify_columns(df: pd.DataFrame) -> tuple[str, str]:
    print("Columns in raw Salis dataset:")
    for column in df.columns:
        print(f"  - {column}")

    sequence_col = _find_column(list(df.columns), SEQUENCE_COLUMN_HINTS)
    rate_col = _find_column(list(df.columns), RATE_COLUMN_HINTS)

    if sequence_col is None or rate_col is None:
        raise SystemExit(
            "Could not identify sequence and translation-rate columns. "
            f"Found columns: {list(df.columns)}"
        )
    return sequence_col, rate_col


def clean_dataset(df: pd.DataFrame, sequence_col: str, rate_col: str) -> pd.DataFrame:
    cleaned = df[[sequence_col, rate_col]].copy()
    cleaned.columns = ["sequence", "translation_rate"]
    cleaned["sequence"] = (
        cleaned["sequence"]
        .astype(str)
        .str.replace(r"\s+", "", regex=True)
        .str.upper()
    )
    cleaned["translation_rate"] = pd.to_numeric(
        cleaned["translation_rate"], errors="coerce"
    )
    cleaned = cleaned.dropna(subset=["sequence", "translation_rate"])
    cleaned = cleaned[cleaned["sequence"].str.len() > 0]
    return cleaned.reset_index(drop=True)


def main() -> None:
    print(f"RBS Calculator code repo: {RBS_CALCULATOR_REPO}")
    print("Fetching published measurement datasets from SalisLabCode ...")

    raw_df = fetch_raw_dataset()
    RAW_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    raw_df.to_csv(RAW_OUTPUT_PATH, index=False)
    print(f"Saved raw CSV ({len(raw_df)} rows) to {RAW_OUTPUT_PATH}")

    sequence_col, rate_col = identify_columns(raw_df)
    print(f"Using sequence column: {sequence_col}")
    print(f"Using translation-rate column: {rate_col}")

    cleaned = clean_dataset(raw_df, sequence_col, rate_col)
    cleaned.to_csv(CLEAN_OUTPUT_PATH, index=False)
    print(f"Cleaned shape: {cleaned.shape}")
    print("First 3 rows:")
    print(cleaned.head(3).to_string(index=False))


if __name__ == "__main__":
    main()
