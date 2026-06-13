"""Shared sampling helpers for dataset fetch scripts."""

from __future__ import annotations

import pandas as pd


def stratified_sample(
    df: pd.DataFrame,
    label_col: str,
    max_rows: int,
    n_buckets: int = 5,
) -> pd.DataFrame:
    """Sample up to max_rows with roughly equal counts per label bucket."""
    if len(df) <= max_rows:
        return df.reset_index(drop=True)

    per_bucket = max_rows // n_buckets
    labels = df[label_col]
    buckets = pd.cut(labels, bins=n_buckets, labels=False, include_lowest=True)
    sampled = (
        df.groupby(buckets, group_keys=False)
        .apply(lambda group: group.sample(n=min(len(group), per_bucket), random_state=42))
        .reset_index(drop=True)
    )
    if len(sampled) > max_rows:
        sampled = sampled.sample(n=max_rows, random_state=42).reset_index(drop=True)
    return sampled
