"""Sequence feature extraction for promoter and RBS parts."""

from __future__ import annotations

import numpy as np


def _build_features(seq: str, part_type: str) -> dict:
    """Convert a DNA sequence string into a numerical feature dict."""
    length = len(seq)

    gc_content = (seq.count("G") + seq.count("C")) / length
    at_content = 1 - gc_content

    dinucs = [
        "AA", "AT", "AC", "AG", "TA", "TT", "TC", "TG",
        "CA", "CT", "CC", "CG", "GA", "GT", "GC", "GG",
    ]
    dinuc_freq = {}
    for d in dinucs:
        count = sum(1 for i in range(len(seq) - 1) if seq[i : i + 2] == d)
        dinuc_freq[f"dinuc_{d}"] = count / max(len(seq) - 1, 1)

    promoter_features = {}
    if part_type == "promoter":
        minus10_consensus = "TATAAT"
        minus35_consensus = "TTGACA"

        def hamming_similarity(s1: str, s2: str) -> float:
            matches = sum(a == b for a, b in zip(s1, s2))
            return matches / len(s1)

        best_minus10 = max(
            (hamming_similarity(seq[i : i + 6], minus10_consensus) for i in range(len(seq) - 6)),
            default=0,
        )
        best_minus35 = max(
            (hamming_similarity(seq[i : i + 6], minus35_consensus) for i in range(len(seq) - 6)),
            default=0,
        )
        promoter_features = {
            "minus10_match": best_minus10,
            "minus35_match": best_minus35,
            "spacer_gc": gc_content,
        }

    rbs_features = {}
    if part_type == "rbs":
        sd_consensus = "AGGAGG"
        best_sd = max(
            (
                sum(seq[i + j] == sd_consensus[j] for j in range(6)) / 6
                for i in range(len(seq) - 6)
            ),
            default=0,
        )
        rbs_features = {"sd_match": best_sd}

    return {
        "gc_content": gc_content,
        "at_content": at_content,
        "length": length,
        "length_normalized": min(length / 1000, 1.0),
        **dinuc_freq,
        **promoter_features,
        **rbs_features,
    }


def extract_features(sequence: str, part_type: str) -> dict:
    """
    Convert a DNA sequence string into a numerical feature vector.
    Returns a flat dict of named numerical features; never None.
    """
    part_type = part_type.lower()
    seq = "".join(base for base in sequence.upper().strip() if base in "ATCG")

    if not seq:
        template = _build_features("AAAA", part_type)
        return {key: 0.0 for key in template}

    return _build_features(seq, part_type)


def circuit_feature_vector(parts: list) -> np.ndarray:
    """
    Takes a list of part dicts (each with sequence, part_type, known_expression)
    and returns a single flat numpy array for the circuit-level prediction.
    """
    features = []

    for part in parts:
        feat_dict = extract_features(part["sequence"], part["part_type"])
        features.append(list(feat_dict.values()))

    if not features:
        return np.zeros(25)

    stacked = np.array(features)
    return np.concatenate(
        [
            stacked.mean(axis=0),
            stacked.max(axis=0),
            [sum(f["length"] for f in (extract_features(p["sequence"], p["part_type"]) for p in parts))],
        ]
    )
