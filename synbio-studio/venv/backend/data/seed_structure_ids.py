"""Seed pdb_id and uniprot_id columns in parts_master.csv from STRUCTURE_MAP."""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

PARTS_MASTER = Path("backend/data/parts_master.csv")

# Canonical iGEM parts — keys use exact BBa_* format from parts_master.csv.
# BBa_C0012 / BBa_C0040 / BBa_C0051 are not in the library; equivalent CDS parts are mapped below.
STRUCTURE_MAP: dict[str, dict[str, str | None]] = {
    "BBa_E0040": {"pdb_id": "1EMA", "uniprot_id": "P42212"},
    "BBa_E1010": {"pdb_id": "1G7K", "uniprot_id": "Q9U6Y8"},
    "BBa_K143033": {"pdb_id": "1LBH", "uniprot_id": "P00107"},  # LacI (replaces BBa_C0012)
    "BBa_K1401000": {"pdb_id": "1YSA", "uniprot_id": "P0A9E5"},  # TetR (replaces BBa_C0040)
    "BBa_K566038": {"pdb_id": "2R04", "uniprot_id": "P03034"},  # lambda cI (replaces BBa_C0051)
    "BBa_K1399002": {"pdb_id": "1G7K", "uniprot_id": "Q9U6Y8"},  # RFP
    "BBa_K863120": {"pdb_id": "1EMA", "uniprot_id": "P42212"},  # GFP
    "BBa_K2926053": {"pdb_id": "2H5Q", "uniprot_id": "X5DSL3"},  # mCherry
    "BBa_K2619105": {"pdb_id": "1LCI", "uniprot_id": "P08659"},  # nano luciferase
    "BBa_C0080": {"pdb_id": "2ARC", "uniprot_id": "P0A9E0"},  # araC
    "BBa_K1159112": {"pdb_id": "1OXD", "uniprot_id": "P42212"},  # CFP / YFP FRET reporter
    "BBa_K2984019": {"pdb_id": "1YFP", "uniprot_id": "P42212"},  # YFP
    "BBa_J23100": {"pdb_id": None, "uniprot_id": None},
    "BBa_J23101": {"pdb_id": None, "uniprot_id": None},
    "BBa_J23106": {"pdb_id": None, "uniprot_id": None},
    "BBa_B0034": {"pdb_id": None, "uniprot_id": None},
    "BBa_B0015": {"pdb_id": None, "uniprot_id": None},
}

# Ordered most-specific first. Used to auto-expand STRUCTURE_MAP from CSV name/description.
PROTEIN_KEYWORD_REFERENCE: list[tuple[str, str | None, str | None]] = [
    ("mCherry", "2H5Q", "X5DSL3"),
    ("mRFP", "1G7K", "Q9U6Y8"),
    ("luciferase", "1LCI", "P08659"),
    ("LacI", "1LBH", "P00107"),
    ("TetR", "1YSA", "P0A9E5"),
    ("araC", "2ARC", "P0A9E0"),
    ("chloramphenicol", None, None),
    ("kanamycin", None, None),
    ("ampicillin", None, None),
    ("GFP", "1EMA", "P42212"),
    ("RFP", "1G7K", "Q9U6Y8"),
    ("CFP", "1OXD", "P42212"),
    ("YFP", "1YFP", "P42212"),
    ("GUS", "3K46", "P05804"),
    ("CAT", "1Q23", "P62577"),
]

CDS_TYPES = {"cds", "gene", "CDS", "Gene", "coding", "protein"}


def _is_present(value: object) -> bool:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return False
    text = str(value).strip()
    return text != "" and text.lower() != "nan"


def _part_text(row: pd.Series) -> str:
    return f"{row.get('name', '')} {row.get('description', '')}".lower()


def _keyword_matches(text: str, keyword: str) -> bool:
    lowered = text.lower()
    kw = keyword.lower()

    if kw == "tetr":
        return bool(re.search(r"\btetr\b", lowered)) and (
            "repressor" in lowered or "tet repressor" in lowered
        )
    if kw == "laci":
        return bool(re.search(r"\blaci\b", lowered))
    if kw == "cat":
        return "chloramphenicol acetyltransferase" in lowered or bool(
            re.search(r"\bcat gene\b", lowered)
        )
    if kw == "gus":
        return "beta-glucuronidase" in lowered or bool(re.search(r"\bgus\b", lowered))
    return kw in lowered


def _expand_structure_map(df: pd.DataFrame) -> dict[str, dict[str, str | None]]:
    expanded = dict(STRUCTURE_MAP)
    cds_rows = df[df["part_type"].isin(CDS_TYPES)]

    for _, row in cds_rows.iterrows():
        part_id = str(row["part_id"])
        if part_id in expanded:
            continue
        text = _part_text(row)
        for keyword, pdb_id, uniprot_id in PROTEIN_KEYWORD_REFERENCE:
            if _keyword_matches(text, keyword):
                expanded[part_id] = {"pdb_id": pdb_id, "uniprot_id": uniprot_id}
                break

    return expanded


def seed_structure_ids(parts_path: Path = PARTS_MASTER) -> pd.DataFrame:
    if not parts_path.exists():
        raise SystemExit(f"Parts file not found: {parts_path}")

    df = pd.read_csv(parts_path)

    if "pdb_id" not in df.columns:
        df["pdb_id"] = None
    if "uniprot_id" not in df.columns:
        df["uniprot_id"] = None

    structure_map = _expand_structure_map(df)
    seeded = 0
    for part_id, ids in structure_map.items():
        mask = df["part_id"].astype(str) == part_id
        if not mask.any():
            continue
        df.loc[mask, "pdb_id"] = ids["pdb_id"]
        df.loc[mask, "uniprot_id"] = ids["uniprot_id"]
        seeded += int(mask.sum())

    df.to_csv(parts_path, index=False)

    with_pdb = sum(df["pdb_id"].map(_is_present))
    without_pdb = len(df) - with_pdb
    print(f"Seeded structure IDs for {seeded} parts")
    print(f"Parts with pdb_id: {with_pdb}")
    print(f"Parts without pdb_id (DNA-only rendering): {without_pdb}")
    return df


def _print_verification(df: pd.DataFrame) -> None:
    total = len(df)
    pdb_mask = df["pdb_id"].map(_is_present)
    uniprot_mask = df["uniprot_id"].map(_is_present)

    print(f"\n=== Verification ===")
    print(f"1. Total parts in parts_master.csv: {total}")

    seeded_pdb = df[pdb_mask][["part_id", "name", "pdb_id", "uniprot_id"]]
    print(f"2. Parts with pdb_id seeded (not null): {len(seeded_pdb)}")
    for _, row in seeded_pdb.iterrows():
        print(f"   - {row['part_id']} | {row['name']} | pdb={row['pdb_id']}")

    print(f"3. Parts with uniprot_id seeded (not null): {int(uniprot_mask.sum())}")
    print(f"4. Parts with pdb_id = null (DNA-only rendering): {int((~pdb_mask).sum())}")

    print("5. Breakdown by part_type:")
    type_groups = {
        "promoter": {"promoter"},
        "rbs": {"rbs"},
        "cds/gene": CDS_TYPES,
        "terminator": {"terminator"},
    }
    for label, types in type_groups.items():
        subset = df[df["part_type"].isin(types)]
        seeded_count = int(subset["pdb_id"].map(_is_present).sum())
        unseeded_count = len(subset) - seeded_count
        if label in {"promoter", "rbs", "terminator"}:
            print(f"   {label}: {seeded_count} seeded (expected — DNA only)")
        else:
            print(f"   {label}: {seeded_count} seeded, {unseeded_count} unseeded")

    if int(pdb_mask.sum()) < 5:
        print(
            "\nWARNING: Fewer than 5 parts have structure IDs. This may mean\n"
            "   the CSV contains few or no CDS/gene parts with recognized names.\n"
            "   Visualization will fall back to dna_helix rendering for all parts."
        )
        cds_names = (
            df[df["part_type"].isin(CDS_TYPES)][["part_id", "name"]]
            .drop_duplicates()
            .sort_values("name")
        )
        print("   CDS/gene part names in library:")
        for _, row in cds_names.iterrows():
            print(f"   - {row['part_id']} | {row['name']}")


def main() -> None:
    df = seed_structure_ids()
    _print_verification(df)


if __name__ == "__main__":
    main()
