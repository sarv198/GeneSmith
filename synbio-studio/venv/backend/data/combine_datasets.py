# RUN ORDER:
# 1. python -m backend.data.fetch_anderson        (already exists)
# 2. python -m backend.data.fetch_salis           (already exists)
# 3. python -m backend.data.fetch_regulondb       (new)
# 4. python -m backend.data.fetch_urtecho         (new)
# 5. python -m backend.data.fetch_igem_full         (new)
# 6. python -m backend.data.fetch_ncbi            (new)
# 7. python -m backend.data.combine_datasets      (new)
# 8. python -m backend.prediction_engine.train    (retrain on expanded data)
# 9. python -m uvicorn backend.api.main:app --reload --port 8000

"""Merge filtered datasets into final training and recommendation tables."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from backend.data._sampling import stratified_sample

PROMOTER_SOURCES = (
    "backend/data/anderson_promoters.csv",
    "backend/data/regulondb_promoters.csv",
    "backend/data/urtecho_promoters.csv",
    "backend/data/ncbi_promoters.csv",
)
PROMOTER_OUTPUT = Path("backend/data/promoter_training_final.csv")
PARTS_IGEM = Path("backend/data/igem_parts_full.csv")
PARTS_ANDERSON = Path("backend/data/anderson_promoters.csv")
PARTS_OUTPUT = Path("backend/data/parts_master.csv")
MAX_PROMOTER_ROWS = 3000


def _load_promoter_frames() -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    for path in PROMOTER_SOURCES:
        file_path = Path(path)
        if not file_path.exists():
            print(f"WARNING: missing {path}, skipping")
            continue
        df = pd.read_csv(file_path)
        if "part_id" in df.columns and "organism" not in df.columns:
            df = df.rename(columns={"part_id": "part_id"})
            df["organism"] = "E. coli"
            df["source"] = "anderson"
        if "sequence" not in df.columns:
            continue
        keep = [col for col in ("sequence", "rpu", "organism", "source") if col in df.columns]
        frames.append(df[keep])
    if not frames:
        raise SystemExit("No promoter source files found. Run fetch scripts first.")
    return pd.concat(frames, ignore_index=True)


def combine_promoters() -> pd.DataFrame:
    combined = _load_promoter_frames()
    labeled = combined[combined["rpu"].notna()].copy()
    labeled["sequence"] = labeled["sequence"].astype(str).str.upper()
    labeled["rpu"] = pd.to_numeric(labeled["rpu"], errors="coerce")
    labeled = labeled.dropna(subset=["sequence", "rpu"])
    labeled = labeled.drop_duplicates(subset=["sequence"], keep="first")

    print("Labeled rows by source (before final cap):")
    for source, count in labeled["source"].value_counts().items():
        print(f"  {source}: {count}")

    labeled_sources = set(labeled["source"].unique())
    core_sources = {"anderson", "regulondb", "regulondb_synthetic", "urtecho", "geo_gse108535", "anderson_augmented"}
    active = labeled_sources & core_sources
    if len(active) < 2:
        print(
            f"WARNING: Only {len(active)} labeled source(s) present ({', '.join(sorted(active))}). "
            "Expected at least Anderson plus RegulonDB or Urtecho."
        )

    if len(labeled) > MAX_PROMOTER_ROWS:
        labeled = stratified_sample(labeled, "rpu", MAX_PROMOTER_ROWS)

    labeled.to_csv(PROMOTER_OUTPUT, index=False)
    print(f"Promoter training final rows: {len(labeled)}")
    print("Final labeled rows by source:")
    for source, count in labeled["source"].value_counts().items():
        print(f"  {source}: {count}")
    if len(labeled) < 200:
        print(
            f"WARNING: Training set is small ({len(labeled)} rows). Model accuracy will "
            "be limited. Consider adding more labeled data sources."
        )
    print(
        "RPU distribution — "
        f"min={labeled['rpu'].min():.4f}, max={labeled['rpu'].max():.4f}, "
        f"mean={labeled['rpu'].mean():.4f}, std={labeled['rpu'].std():.4f}"
    )
    return labeled


def combine_parts() -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    if PARTS_IGEM.exists():
        frames.append(pd.read_csv(PARTS_IGEM))
    if PARTS_ANDERSON.exists():
        anderson = pd.read_csv(PARTS_ANDERSON)
        anderson = anderson.rename(columns={"part_id": "part_id"})
        anderson["part_type"] = "promoter"
        anderson["name"] = "Anderson promoter"
        anderson["description"] = "Constitutive promoter with measured RPU"
        anderson["source"] = "anderson"
        frames.append(anderson[["part_id", "part_type", "name", "sequence", "description", "source"]])

    if not frames:
        raise SystemExit("No parts files found for parts_master.csv")

    parts = pd.concat(frames, ignore_index=True)
    parts = parts.drop_duplicates(subset=["part_id"], keep="first")
    parts.to_csv(PARTS_OUTPUT, index=False)
    print(f"Parts master total: {len(parts)}")
    print("Count per part_type:")
    for part_type, count in parts["part_type"].value_counts().items():
        print(f"  {part_type}: {count}")
    return parts


def main() -> None:
    combine_promoters()
    combine_parts()
    from backend.data.seed_structure_ids import seed_structure_ids

    seed_structure_ids(PARTS_OUTPUT)


if __name__ == "__main__":
    main()
