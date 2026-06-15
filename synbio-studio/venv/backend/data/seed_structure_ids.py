"""Seed pdb_id and uniprot_id columns in parts_master.csv from STRUCTURE_MAP."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

PARTS_MASTER = Path("backend/data/parts_master.csv")

# Hardcoded part → structure identifiers. Never resolved via live UniProt search.
STRUCTURE_MAP: dict[str, dict[str, str | None]] = {
    # Fluorescent proteins (CDS)
    "BBa_E0040": {"pdb_id": "1EMA", "uniprot_id": "P42212"},  # GFP
    "BBa_E1010": {"pdb_id": None, "uniprot_id": "P55127"},  # mCherry (DsRed family)
    "BBa_E0020": {"pdb_id": None, "uniprot_id": "P42212"},  # GFP reporter variant
    "BBa_E0030": {"pdb_id": None, "uniprot_id": "P42212"},  # GFP reporter variant
    "BBa_E0060": {"pdb_id": None, "uniprot_id": "P42212"},  # GFP reporter variant
    "BBa_E0070": {"pdb_id": None, "uniprot_id": "P42212"},  # GFP reporter variant
    "BBa_E0079": {"pdb_id": None, "uniprot_id": "P42212"},  # GFP reporter variant
    "BBa_E0240": {"pdb_id": None, "uniprot_id": "P42212"},  # GFP reporter variant
    # Demo circuit non-structural parts
    "BBa_J23100": {"pdb_id": None, "uniprot_id": None},
    "BBa_B0034": {"pdb_id": None, "uniprot_id": None},
    "BBa_B0015": {"pdb_id": None, "uniprot_id": None},
}


def seed_structure_ids(parts_path: Path = PARTS_MASTER) -> pd.DataFrame:
    if not parts_path.exists():
        raise SystemExit(f"Parts file not found: {parts_path}")

    df = pd.read_csv(parts_path)
    if "pdb_id" not in df.columns:
        df["pdb_id"] = pd.NA
    if "uniprot_id" not in df.columns:
        df["uniprot_id"] = pd.NA

    updated = 0
    for part_id, ids in STRUCTURE_MAP.items():
        mask = df["part_id"] == part_id
        if not mask.any():
            continue
        df.loc[mask, "pdb_id"] = ids.get("pdb_id")
        df.loc[mask, "uniprot_id"] = ids.get("uniprot_id")
        updated += int(mask.sum())

    df.to_csv(parts_path, index=False)
    mapped = df["uniprot_id"].notna().sum()
    print(f"Seeded structure IDs for {updated} rows ({mapped} with uniprot_id)")
    return df


def main() -> None:
    seed_structure_ids()


if __name__ == "__main__":
    main()
