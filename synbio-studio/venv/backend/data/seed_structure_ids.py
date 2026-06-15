"""Seed pdb_id and uniprot_id columns in parts_master.csv from STRUCTURE_MAP."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

PARTS_MASTER = Path("backend/data/parts_master.csv")

STRUCTURE_MAP = {
    "BBa_E0040": {"pdb_id": "1EMA", "uniprot_id": "P42212"},
    "BBa_E1010": {"pdb_id": "1G7K", "uniprot_id": "Q9U6Y8"},
    "BBa_C0012": {"pdb_id": "1LBH", "uniprot_id": "P00107"},
    "BBa_C0040": {"pdb_id": "1YSA", "uniprot_id": "P0A9E5"},
    "BBa_C0051": {"pdb_id": "2R04", "uniprot_id": "P03034"},
    "BBa_J23100": {"pdb_id": None, "uniprot_id": None},
    "BBa_J23101": {"pdb_id": None, "uniprot_id": None},
    "BBa_J23106": {"pdb_id": None, "uniprot_id": None},
    "BBa_B0034": {"pdb_id": None, "uniprot_id": None},
    "BBa_B0015": {"pdb_id": None, "uniprot_id": None},
}


def _is_present(value: object) -> bool:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return False
    text = str(value).strip()
    return text != "" and text.lower() != "nan"


def seed_structure_ids(parts_path: Path = PARTS_MASTER) -> pd.DataFrame:
    if not parts_path.exists():
        raise SystemExit(f"Parts file not found: {parts_path}")

    df = pd.read_csv(parts_path)

    if "pdb_id" not in df.columns:
        df["pdb_id"] = None
    if "uniprot_id" not in df.columns:
        df["uniprot_id"] = None

    seeded = 0
    for part_id, ids in STRUCTURE_MAP.items():
        mask = df["part_id"] == part_id
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


def main() -> None:
    seed_structure_ids()


if __name__ == "__main__":
    main()
