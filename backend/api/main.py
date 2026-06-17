"""GeneSmith API — expression prediction, parts library, and admin jobs."""

from __future__ import annotations

import html as html_module
import pickle
import re
import subprocess
import sys
import threading
from datetime import datetime, timezone
from difflib import SequenceMatcher
from io import StringIO
from pathlib import Path
from typing import Any
from uuid import uuid4

import numpy as np
import pandas as pd
import requests
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.prediction_engine.predictor import (
    ExpressionPredictor,
    _cds_expressibility_factor,
    _translate_dna,
)

app = FastAPI(title="GeneSmith API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _init_runtime() -> None:
    global predictor, PARTS_DF, circuit_model_bundle
    if predictor is not None:
        return
    predictor = ExpressionPredictor()
    PARTS_DF = _load_parts_df()
    circuit_model_bundle = _load_circuit_model()


@app.middleware("http")
async def _ensure_runtime_initialized(request: Request, call_next):
    if request.url.path != "/health":
        _init_runtime()
    return await call_next(request)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = str(PROJECT_ROOT / "prediction_engine/models/gbm_v1.pkl")
RBS_MODEL_PATH = str(PROJECT_ROOT / "prediction_engine/models/rbs_gbm_v1.pkl")
CIRCUIT_MODEL_PATH = str(PROJECT_ROOT / "prediction_engine/models/gbm_circuit_v1.pkl")
PARTS_MASTER_PATH = PROJECT_ROOT / "data/parts_master.csv"

JOBS: dict[str, dict[str, Any]] = {}
circuit_model_bundle: dict[str, Any] | None = None
predictor: ExpressionPredictor | None = None
PARTS_DF: pd.DataFrame | None = None

DEFAULT_CIRCUIT = [
    {
        "part_id": "BBa_J23100",
        "part_type": "promoter",
        "name": "J23100 strong promoter",
        "description": "Anderson constitutive promoter, RPU 1.0",
        "sequence": "TTGACGGCTAGCTCAGTCCTAGGTACAGTGCTAGC",
    },
    {
        "part_id": "BBa_B0034",
        "part_type": "rbs",
        "name": "B0034 RBS",
        "description": "Ribosome binding site",
        "sequence": "AAAGAGGAGAAA",
    },
    {
        "part_id": "BBa_E0040",
        "part_type": "cds",
        "name": "GFP",
        "description": "Green fluorescent protein coding sequence",
        "sequence": "ATGAGTAAAGGAGAAGAACTTTTCACTGGAGTTGTCCCAATTCTTGTTGAATTAGATGGTGATGTTAATGGGCACAAATTTTCTGTCAGTGGAGAGGGTGAAGGTGATGCAACATACGGAAAACTTACCCTTAAATTTATTTGCACTACTGGAAAACTACCTGTTCCATGGCCAACACTTGTCACTACTTTCTCTTATGGTGTTCAATGCTTTTCAAGATACCCAGATCATATGAAACGGCATGACTTTTTCAAGAGTGCCATGCCCGAAGGTTATGTACAGGAAAGAACTATATTTTTCAAAGATGACGGGAACTACAAGACACGTGCTGAAGTCAAGTTTGAAGGTGATACCCTTGTTAATAGAATCGAGTTAAAAGGTATTGATTTTAAAGAAGATGGAAACATTCTTGGACACAAATTGGAATACAACTATAACTCACACAATGTATACATCATGGCAGACAAACAAAAGAATGGAATCAAAGTTAACTTCAAAATTAGACACAACATTGAAGATGGAAGCGTTCAACTAGCAGACCATTATCAACAAAATACTCCAATTGGCGATGGCCCTGTCCTTTTACCAGACAACCATTACCTGTCCACACAATCTGCCCTTTCGAAAGATCCCAACGAAAAGAGAGACCACATGGTCCTTCTTGAGTTTGTAACAGCTGCTGGGATTACACATGGCATGGATGAACTATACAAATAA",
    },
    {
        "part_id": "BBa_B0015",
        "part_type": "terminator",
        "name": "B0015 terminator",
        "description": "Transcription terminator",
        "sequence": "AAAAACGAAAGGGCCTCGTGATACGCCTATTTTTATAGGTTAATGTCATGATAATAATGGTTTCTTAGACGTCAGGTGGCACTTTTCGGGGAAATGTGCGCGGAACCCCTATTTGTTTATTTTTCTAAATACATTCAAATATGTATCCGCTCATGAGACAATAACCCTGATAAATGCTTCAATAATATTGAAAAAGGAAGAGT",
    },
]

WARN_RBS = (
    "No RBS detected — translation rate defaulted to 0.5 (medium). "
    "Add an RBS part for accurate expression prediction."
)
WARN_CDS = (
    "No coding sequence detected — protein yield cannot be calculated. "
    "Add a gene part to enable yield prediction."
)
WARN_TERM = (
    "No terminator detected — assuming 90% termination efficiency. "
    "Add a terminator part for complete circuit validation."
)


def _load_parts_df() -> pd.DataFrame | None:
    if not PARTS_MASTER_PATH.exists():
        print(f"WARNING: {PARTS_MASTER_PATH} not found — parts library unavailable")
        return None
    try:
        df = pd.read_csv(PARTS_MASTER_PATH)
    except Exception as exc:
        print(f"WARNING: Could not load parts library ({exc})")
        return None
    for column in ("pdb_id", "uniprot_id"):
        if column not in df.columns:
            df[column] = pd.NA
    print(f"Loaded {len(df)} parts from {PARTS_MASTER_PATH}")
    return df


def _is_present(value: Any) -> bool:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return False
    text = str(value).strip()
    return text != "" and text.lower() != "nan"


def _load_circuit_model() -> dict[str, Any] | None:
    if not Path(CIRCUIT_MODEL_PATH).exists():
        return None
    try:
        with open(CIRCUIT_MODEL_PATH, "rb") as handle:
            return pickle.load(handle)
    except Exception as exc:
        print(f"WARNING: Could not load circuit model ({exc})")
        return None


def _lookup_part_row(part_id: str) -> pd.Series | None:
    if PARTS_DF is None:
        return None
    matches = PARTS_DF[PARTS_DF["part_id"].astype(str) == str(part_id)]
    if matches.empty:
        return None
    return matches.iloc[0]


def _part_detail_from_request(part: dict[str, Any]) -> dict[str, Any]:
    row = _lookup_part_row(str(part.get("part_id", "")))
    if row is not None:
        return {
            "part_id": str(row["part_id"]),
            "part_type": str(row.get("part_type", part.get("part_type", ""))),
            "name": str(row.get("name", part.get("part_id", ""))),
            "sequence": str(row.get("sequence", part.get("sequence", ""))),
        }
    return {
        "part_id": str(part.get("part_id", "")),
        "part_type": str(part.get("part_type", "")),
        "name": str(part.get("part_id", "")),
        "sequence": str(part.get("sequence", "")),
    }


def _build_circuit_svg(parts_detail: list[dict[str, Any]]) -> str:
    x = 10
    elements: list[str] = []
    for part in parts_detail:
        part_type = _normalize_type(str(part.get("part_type", "")))
        color = PART_TYPE_COLORS.get(part_type, "#cccccc")
        width = 90
        label = part_type[:3].upper()
        elements.append(
            f'<rect x="{x}" y="30" width="{width}" height="36" fill="{color}" '
            f'stroke="#334155" rx="6"/>'
        )
        elements.append(
            f'<text x="{x + width / 2}" y="52" text-anchor="middle" '
            f'font-family="monospace" font-size="11" fill="#1e293b">{label}</text>'
        )
        x += width + 8
    svg_width = max(x + 10, 120)
    body = "\n  ".join(elements)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{svg_width}" height="80" '
        f'viewBox="0 0 {svg_width} 80">\n  {body}\n</svg>'
    )


def _clean_amino_acid_sequence(amino_acid_sequence: str) -> str:
    return "".join(c for c in amino_acid_sequence.upper() if c.isalpha())


def _sequence_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def _uniprot_id_for_cds_row(
    row: pd.Series,
    *,
    allow_name_search: bool = False,
) -> str | None:
    if _is_present(row.get("uniprot_id")):
        return str(row["uniprot_id"]).strip()
    if allow_name_search:
        part_name = str(row.get("name", row.get("part_id", "")))
        return _search_uniprot_by_name(part_name)
    return None


def _fetch_pdb_text(pdb_url: str) -> str | None:
    try:
        response = requests.get(pdb_url, timeout=30)
        if response.status_code != 200:
            print(f"PDB download failed: HTTP {response.status_code} for {pdb_url}")
            return None
        text = response.text.strip()
        if text.startswith("HEADER") or text.startswith("ATOM"):
            return text
        return None
    except Exception as exc:
        print(f"PDB download error for {pdb_url}: {exc}")
        return None


def _sequence_from_part_id(part_id: str | None) -> str:
    if not part_id:
        return ""
    row = _lookup_part_row(part_id)
    if row is None:
        return ""
    if _normalize_type(str(row.get("part_type", ""))) != "cds":
        return ""
    return _translate_dna(str(row.get("sequence", "")))


def _alphafold_match_from_cds_row(
    row: pd.Series,
    *,
    match_type: str,
    identity: float | None = None,
) -> dict[str, Any] | None:
    uniprot_id = _uniprot_id_for_cds_row(row, allow_name_search=True)
    if not uniprot_id:
        return None
    pdb_url = _fetch_alphafold_pdb_url(uniprot_id)
    if not pdb_url:
        return None
    pdb_content = _fetch_pdb_text(pdb_url)
    part_name = str(row.get("name", row.get("part_id", "")))
    result: dict[str, Any] = {
        "pdb_url": pdb_url,
        "pdb_content": pdb_content,
        "uniprot_id": uniprot_id,
        "source": "alphafold",
        "match_type": match_type,
        "matched_protein_name": part_name,
        "matched_part_id": str(row.get("part_id", "")),
        "disclaimer": None,
    }
    if match_type == "closest" and identity is not None:
        pct = round(identity * 100, 1)
        result["match_identity"] = pct
        result["disclaimer"] = (
            "An exact AlphaFold model for your predicted amino acid sequence "
            "is unavailable. Showing the closest available AlphaFold structure "
            f"({part_name}, {pct:g}% sequence similarity) - "
            "the nearest accurate structural depiction for your circuit."
        )
    return result


def _find_closest_alphafold_match(
    query_seq: str,
    part_id: str | None = None,
) -> dict[str, Any] | None:
    if PARTS_DF is None or len(query_seq) < 8:
        return None

    query_len = len(query_seq)
    best: dict[str, Any] | None = None
    best_score = 0.0
    seen: set[str] = set()
    rows_to_check: list[pd.Series] = []

    if part_id:
        circuit_row = _lookup_part_row(part_id)
        if circuit_row is not None:
            rows_to_check.append(circuit_row)

    cds_mask = PARTS_DF["part_type"].apply(
        lambda t: _normalize_type(str(t)) == "cds",
    )
    for _, row in PARTS_DF.loc[cds_mask].iterrows():
        rows_to_check.append(row)

    for row in rows_to_check:
        pid = str(row.get("part_id", ""))
        if not pid or pid in seen:
            continue
        seen.add(pid)

        reference_aa = _translate_dna(str(row.get("sequence", "")))
        if len(reference_aa) < 8:
            continue

        len_ratio = min(query_len, len(reference_aa)) / max(query_len, len(reference_aa))
        if len_ratio < 0.25:
            continue

        identity = _sequence_similarity(query_seq, reference_aa)
        if identity <= best_score:
            continue

        uniprot_id = _uniprot_id_for_cds_row(row, allow_name_search=False)
        if not uniprot_id:
            continue

        best_score = identity
        best = {
            "identity": identity,
            "part_id": pid,
            "part_name": str(row.get("name", pid)),
            "uniprot_id": uniprot_id,
            "reference_sequence": reference_aa,
        }

    if not best or best_score < 0.3:
        return None

    if part_id:
        circuit_row = _lookup_part_row(part_id)
        if circuit_row is not None and _normalize_type(str(circuit_row.get("part_type", ""))) == "cds":
            circuit_aa = _translate_dna(str(circuit_row.get("sequence", "")))
            if len(circuit_aa) >= 8:
                circuit_identity = _sequence_similarity(query_seq, circuit_aa)
                circuit_uid = _uniprot_id_for_cds_row(circuit_row, allow_name_search=True)
                if (
                    circuit_uid
                    and circuit_identity >= 0.7
                    and circuit_identity >= best_score - 0.08
                ):
                    return {
                        "identity": circuit_identity,
                        "part_id": str(circuit_row.get("part_id", part_id)),
                        "part_name": str(circuit_row.get("name", part_id)),
                        "uniprot_id": circuit_uid,
                        "reference_sequence": circuit_aa,
                    }

    return best


def _search_uniprot_by_sequence(amino_acid_sequence: str) -> str | None:
    seq = _clean_amino_acid_sequence(amino_acid_sequence)
    if len(seq) < 8:
        return None
    try:
        query = requests.utils.quote(f"sequence:{seq}")
        url = (
            "https://rest.uniprot.org/uniprotkb/search"
            f"?query={query}&format=json&size=1"
        )
        response = requests.get(url, timeout=STRUCTURE_API_TIMEOUT)
        if response.status_code != 200:
            return None
        results = response.json().get("results", [])
        if not results:
            return None
        return results[0].get("primaryAccession")
    except Exception as exc:
        print(f"UniProt sequence search error: {exc}")
        return None


def _fetch_esmfold_pdb(amino_acid_sequence: str) -> str | None:
    seq = "".join(c for c in amino_acid_sequence.upper() if c.isalpha())
    if not seq or len(seq) > 400:
        return None
    try:
        response = requests.post(
            "https://api.esmatlas.com/foldSequence/v1/pdb/",
            json={"sequence": seq},
            headers={"Content-Type": "application/json"},
            timeout=ESMFOLD_TIMEOUT,
        )
        if response.status_code != 200:
            print(f"ESMFold failed: HTTP {response.status_code}")
            return None
        text = response.text.strip()
        return text if text.startswith("HEADER") or text.startswith("ATOM") else None
    except Exception as exc:
        print(f"ESMFold error: {exc}")
        return None


def _resolve_regulatory_structure(
    part_type: str,
    part_name: str,
    row: pd.Series | None = None,
) -> tuple[str | None, str]:
    normalized = _normalize_type(part_type)
    seed = REGULATORY_PDB_SEEDS.get(normalized)
    if seed:
        pdb_id, label = seed
        return f"https://files.rcsb.org/download/{pdb_id}.pdb", label

    search_terms = {
        "promoter": "promoter DNA RNA polymerase",
        "rbs": "ribosome binding site 30S",
        "terminator": "intrinsic terminator RNA hairpin",
    }
    term = search_terms.get(normalized, part_name)
    if row is not None:
        description = str(row.get("description", "")).strip()
        if description:
            term = description[:80]
    pdb_url = _search_rcsb_pdb(term)
    return pdb_url, term


def _search_uniprot_by_name(part_name: str) -> str | None:
    try:
        query = requests.utils.quote(part_name)
        url = (
            "https://rest.uniprot.org/uniprotkb/search"
            f"?query={query}&format=json&size=1"
        )
        response = requests.get(url, timeout=STRUCTURE_API_TIMEOUT)
        if response.status_code != 200:
            print(f"UniProt search failed for {part_name!r}: HTTP {response.status_code}")
            return None
        results = response.json().get("results", [])
        if not results:
            return None
        return results[0].get("primaryAccession")
    except Exception as exc:
        print(f"UniProt search error for {part_name!r}: {exc}")
        return None


def _fetch_alphafold_pdb_url(uniprot_id: str) -> str | None:
    try:
        url = f"https://alphafold.ebi.ac.uk/api/prediction/{uniprot_id}"
        response = requests.get(url, timeout=STRUCTURE_API_TIMEOUT)
        if response.status_code == 404:
            return None
        if response.status_code != 200:
            print(f"AlphaFold lookup failed for {uniprot_id}: HTTP {response.status_code}")
            return None
        payload = response.json()
        if isinstance(payload, list) and payload:
            return payload[0].get("pdbUrl")
        if isinstance(payload, dict):
            return payload.get("pdbUrl")
        return None
    except Exception as exc:
        print(f"AlphaFold lookup error for {uniprot_id}: {exc}")
        return None


def _search_rcsb_pdb(part_name: str) -> str | None:
    try:
        body = {
            "query": {
                "type": "terminal",
                "service": "text",
                "parameters": {"value": part_name},
            },
            "return_type": "entry",
            "request_options": {"paginate": {"start": 0, "rows": 1}},
        }
        response = requests.post(
            "https://search.rcsb.org/rcsbsearch/v2/query",
            json=body,
            timeout=STRUCTURE_API_TIMEOUT,
        )
        if response.status_code != 200:
            print(f"RCSB search failed for {part_name!r}: HTTP {response.status_code}")
            return None
        result_set = response.json().get("result_set", [])
        if not result_set:
            return None
        identifier = result_set[0].get("identifier")
        if not identifier:
            return None
        return f"https://files.rcsb.org/download/{identifier}.pdb"
    except Exception as exc:
        print(f"RCSB search error for {part_name!r}: {exc}")
        return None


def _resolve_protein_structure(
    part_name: str,
    dna_sequence: str,
    row: pd.Series | None = None,
) -> tuple[str | None, str | None, str]:
    uniprot_id = _search_uniprot_by_name(part_name)
    if not uniprot_id and row is not None and _is_present(row.get("uniprot_id")):
        uniprot_id = str(row["uniprot_id"]).strip()

    pdb_url: str | None = None
    if uniprot_id:
        pdb_url = _fetch_alphafold_pdb_url(uniprot_id)

    if not pdb_url and row is not None and _is_present(row.get("pdb_id")):
        pdb_url = f"https://files.rcsb.org/download/{str(row['pdb_id']).strip()}.pdb"

    if not pdb_url:
        search_name = part_name
        if row is not None:
            description = str(row.get("description", ""))
            if description and not part_name.lower().startswith("bba_"):
                search_name = description
            elif description:
                search_name = description[:80]
        pdb_url = _search_rcsb_pdb(search_name)

    amino_acids = _translate_dna(dna_sequence) if dna_sequence else ""
    sequence = amino_acids if amino_acids else dna_sequence
    return pdb_url, uniprot_id, sequence


def _part_color(part_type: str) -> str:
    return PART_TYPE_COLORS.get(_normalize_type(part_type), "#cccccc")


def _clip_part_regions(
    parts_layout: list[dict[str, Any]],
    full_length: int,
) -> list[dict[str, Any]]:
    """Map part spans onto a trimmed 300bp display (150 + ... + 150)."""
    if full_length <= 300:
        return parts_layout

    display_regions = [(0, 150), (full_length - 150, full_length)]
    mapped: list[dict[str, Any]] = []
    display_offset = 0
    for region_start, region_end in display_regions:
        if display_offset == 150:
            display_offset += 3  # ellipsis
        for part in parts_layout:
            overlap_start = max(part["start"], region_start)
            overlap_end = min(part["end"], region_end)
            if overlap_start >= overlap_end:
                continue
            mapped.append(
                {
                    "part_id": part["part_id"],
                    "part_type": part["part_type"],
                    "start": display_offset + (overlap_start - region_start),
                    "end": display_offset + (overlap_end - region_start),
                    "color": part["color"],
                }
            )
        display_offset += region_end - region_start
    return mapped


def _assemble_dna_structure(
    part_ids: list[str],
    *,
    preview: bool = False,
) -> dict[str, Any]:
    parts_input = [{"part_id": pid} for pid in part_ids]
    return _assemble_dna_structure_from_parts(parts_input, preview=preview)


def _assemble_dna_structure_from_parts(
    parts_input: list[dict[str, Any]],
    *,
    preview: bool = False,
) -> dict[str, Any]:
    full_sequence = ""
    parts_layout: list[dict[str, Any]] = []
    for part in parts_input:
        part_id = str(part.get("part_id", ""))
        sequence = str(part.get("sequence", "")).strip()
        part_type = str(part.get("part_type", "")).strip()

        if not sequence and part_id:
            row = _lookup_part_row(part_id)
            if row is not None:
                sequence = str(row.get("sequence", ""))
                if not part_type:
                    part_type = str(row.get("part_type", "unknown"))

        normalized = _normalize_type(part_type) if part_type else "unknown"
        start = len(full_sequence)
        full_sequence += sequence
        color = part.get("color") or _part_color(normalized)
        parts_layout.append(
            {
                "part_id": part_id,
                "part_type": part_type or normalized,
                "start": start,
                "end": len(full_sequence),
                "color": color,
            }
        )

    total_length = len(full_sequence)
    trim_threshold = 2000 if preview else 300
    trimmed = total_length > trim_threshold
    if trimmed:
        head = 150 if not preview else min(400, total_length // 2)
        tail = 150 if not preview else min(400, total_length - head)
        assembled_sequence = f"{full_sequence[:head]}...{full_sequence[-tail:]}"
        parts_map = _clip_part_regions(parts_layout, total_length)
    else:
        assembled_sequence = full_sequence
        parts_map = parts_layout

    return {
        "assembled_sequence": assembled_sequence,
        "total_length": total_length,
        "trimmed": trimmed,
        "parts_map": parts_map,
    }


def _require_predictor() -> ExpressionPredictor:
    _init_runtime()
    assert predictor is not None
    return predictor


class Part(BaseModel):
    part_id: str
    part_type: str
    sequence: str


class PredictRequest(BaseModel):
    parts: list[Part]


class RecommendRequest(BaseModel):
    trait: str


class YieldRequest(BaseModel):
    promoter_rpu: float | None = Field(default=None, ge=0.0, le=1.0)
    translation_rate: float | None = Field(default=None, ge=0.0, le=1.0)
    gene_length: int = Field(default=0, ge=0)
    terminator_efficiency: float = Field(default=0.90, ge=0.0, le=1.0)


class RetrainRequest(BaseModel):
    models: list[str] | None = None


class DnaStructurePart(BaseModel):
    part_id: str
    part_type: str = ""
    sequence: str = ""
    color: str | None = None


class DnaStructureRequest(BaseModel):
    part_ids: list[str] | None = None
    parts: list[DnaStructurePart] | None = None
    preview: bool = False


class ProteinStructureRequest(BaseModel):
    amino_acid_sequence: str = ""
    part_id: str | None = None


PART_TYPE_COLORS = {
    "promoter": "#ff9999",
    "rbs": "#99ccff",
    "cds": "#99ff99",
    "gene": "#99ff99",
    "terminator": "#ffcc99",
}

STRUCTURE_API_TIMEOUT = 10
ESMFOLD_TIMEOUT = 90

REGULATORY_PDB_SEEDS: dict[str, tuple[str, str]] = {
    "promoter": ("5GGA", "RNA polymerase open complex on promoter DNA"),
    "rbs": ("1SEM", "30S ribosomal subunit (Shine-Dalgarno binding context)"),
    "terminator": ("2KX8", "RNA hairpin stem-loop"),
}


def _normalize_type(part_type: str) -> str:
    part_type = part_type.lower()
    if part_type in {"gene", "cds"}:
        return "cds"
    return part_type


def _score_part(description: str, tokens: list[str]) -> int:
    text = description.lower()
    return sum(1 for token in tokens if token in text)


def _circuit_parts_flags(parts: list[dict[str, Any]]) -> dict[str, bool]:
    types = {_normalize_type(str(p.get("part_type", ""))) for p in parts}
    return {
        "promoter": "promoter" in types,
        "rbs": "rbs" in types,
        "cds": "cds" in types,
        "terminator": "terminator" in types,
    }


def _prediction_scope(flags: dict[str, bool]) -> str:
    if flags["promoter"] and flags["rbs"] and flags["cds"] and flags["terminator"]:
        return "full"
    if flags["promoter"] and flags["rbs"] and not flags["cds"]:
        return "promoter_rbs_only"
    if flags["promoter"] and not flags["rbs"]:
        return "promoter_only"
    return "partial"


def _validate_and_classify(parts: list[dict[str, Any]]) -> dict[str, Any]:
    flags = _circuit_parts_flags(parts)
    missing = [key for key, present in flags.items() if not present]
    warnings: list[str] = []

    if not flags["promoter"]:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Circuit requires at least one promoter for prediction",
                "missing": ["promoter"],
            },
        )

    if not flags["rbs"]:
        warnings.append(WARN_RBS)
    if not flags["cds"]:
        warnings.append(WARN_CDS)
    if not flags["terminator"]:
        warnings.append(WARN_TERM)

    is_complete = all(flags.values())
    return {
        "is_complete": is_complete,
        "missing_parts": missing,
        "warnings": warnings,
        "prediction_scope": _prediction_scope(flags),
        "flags": flags,
    }


def _find_part(parts: list[dict[str, Any]], part_type: str) -> dict[str, Any] | None:
    target = _normalize_type(part_type)
    for part in parts:
        if _normalize_type(str(part.get("part_type", ""))) == target:
            return part
    return None


def _predict_with_validation(parts: list[dict[str, Any]]) -> dict[str, Any]:
    active_predictor = _require_predictor()
    status = _validate_and_classify(parts)
    flags = status["flags"]

    promoter = _find_part(parts, "promoter")
    rbs = _find_part(parts, "rbs")
    cds = _find_part(parts, "cds")
    terminator = _find_part(parts, "terminator")

    promoter_rpu = round(
        active_predictor._predict_promoter(str(promoter.get("sequence", ""))), 4
    )

    translation_rate: float | None = None
    translation_model = None
    if flags["rbs"] and rbs:
        translation_rate = round(
            active_predictor._predict_rbs(str(rbs.get("sequence", ""))), 4
        )
        translation_model = "RBS-GBM-v1" if active_predictor.rbs_model else "default"
    elif not flags["rbs"]:
        translation_rate = None

    protein_yield_value: float | None = None
    amino_acids = ""
    cds_factor: float | None = None
    if flags["cds"] and cds:
        cds_sequence = str(cds.get("sequence", ""))
        amino_acids = _translate_dna(cds_sequence)
        cds_factor = round(_cds_expressibility_factor(cds_sequence), 4)
        if translation_rate is not None:
            protein_yield_value = round(
                float(np.clip(promoter_rpu * translation_rate * cds_factor, 0.0, 1.0)), 4
            )
    elif flags["rbs"] and translation_rate is not None and not flags["cds"]:
        protein_yield_value = None

    term_eff = 0.90 if not flags["terminator"] else 0.95

    confidence: list[float] | None = None
    if protein_yield_value is not None:
        confidence = [
            round(protein_yield_value * 0.85, 4),
            round(min(protein_yield_value * 1.15, 1.0), 4),
        ]

    response: dict[str, Any] = {
        "circuit_status": {
            "is_complete": status["is_complete"],
            "missing_parts": status["missing_parts"],
            "warnings": status["warnings"],
            "prediction_scope": status["prediction_scope"],
        },
        "expression_level": protein_yield_value,
        "unit": "relative_yield" if protein_yield_value is not None else None,
        "model": active_predictor.mode,
        "promoter_strength": {"rpu": promoter_rpu, "unit": "RPU"},
        "translation_rate": (
            {
                "value": translation_rate,
                "unit": "normalized",
                "model": translation_model,
            }
            if translation_rate is not None
            else None
        ),
        "protein_yield": (
            {
                "relative_yield": protein_yield_value,
                "amino_acid_length": len(amino_acids) if amino_acids else None,
                "amino_acid_sequence": (
                    amino_acids[:100] + ("…" if len(amino_acids) > 100 else "")
                    if amino_acids
                    else None
                ),
                "cds_expressibility_factor": cds_factor,
                "terminator_efficiency": term_eff,
                "calibrated": False,
            }
            if flags["cds"]
            else None
        ),
        "confidence_interval": confidence,
    }
    return response


def _heuristic_yield(
    promoter_rpu: float,
    translation_rate: float,
    gene_length: int,
    terminator_efficiency: float,
) -> float:
    safe_length = max(gene_length, 1)
    return float(
        promoter_rpu
        * (translation_rate * 100_000)
        * terminator_efficiency
        * (1.0 / np.log1p(safe_length))
        * 1000
    )


def _yield_level(value: float) -> str:
    if value < 200:
        return "low"
    if value <= 600:
        return "medium"
    return "high"


def _compute_yield(body: YieldRequest) -> dict[str, Any]:
    if body.promoter_rpu is None or body.translation_rate is None:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "promoter_rpu and translation_rate are required",
                "detail": "Both values must be provided as floats between 0 and 1",
            },
        )

    method = "heuristic"
    warning: str | None = (
        "Circuit GBM model not loaded — using heuristic yield formula"
    )
    gene_length = body.gene_length if body.gene_length > 0 else 1

    if circuit_model_bundle is not None:
        try:
            model = circuit_model_bundle["model"]
            scaler = circuit_model_bundle["scaler"]
            feature_names = circuit_model_bundle["feature_names"]
            row = [
                body.promoter_rpu,
                body.translation_rate,
                gene_length,
                body.terminator_efficiency,
            ]
            while len(row) < len(feature_names):
                row.append(0.0)
            X = scaler.transform(np.array([row[: len(feature_names)]]))
            protein_yield = float(model.predict(X)[0])
            method = "GBM-circuit-v1"
            warning = None
        except Exception:
            protein_yield = _heuristic_yield(
                body.promoter_rpu,
                body.translation_rate,
                gene_length,
                body.terminator_efficiency,
            )
    else:
        protein_yield = _heuristic_yield(
            body.promoter_rpu,
            body.translation_rate,
            gene_length,
            body.terminator_efficiency,
        )

    return {
        "protein_yield": round(protein_yield, 4),
        "protein_yield_level": _yield_level(protein_yield),
        "computation_method": method,
        "inputs_used": {
            "promoter_rpu": body.promoter_rpu,
            "translation_rate": body.translation_rate,
            "gene_length": gene_length,
            "terminator_efficiency": body.terminator_efficiency,
        },
        "warning": warning,
    }


def recommend_parts(trait: str) -> list[dict[str, Any]]:
    tokens = [t for t in re.findall(r"[a-z0-9]+", trait.lower()) if len(t) > 2]
    target_types = ["promoter", "rbs", "cds", "terminator"]
    results: list[dict[str, Any]] = []

    if PARTS_DF is None or PARTS_DF.empty:
        return DEFAULT_CIRCUIT

    work = PARTS_DF.copy()
    work["part_type"] = work["part_type"].map(_normalize_type)
    work["description"] = work["description"].fillna("").astype(str)
    work["score"] = work["description"].apply(lambda d: _score_part(d, tokens))

    any_match = work["score"].max() > 0
    for part_type in target_types:
        subset = work[work["part_type"] == part_type]
        if subset.empty:
            continue
        ranked = subset.sort_values("score", ascending=False) if any_match else subset
        for _, row in ranked.head(2).iterrows():
            results.append(
                {
                    "part_id": row["part_id"],
                    "part_type": part_type if part_type != "cds" else "gene",
                    "name": row.get("name", row["part_id"]),
                    "description": row["description"],
                    "sequence": row["sequence"],
                }
            )

    if not results or not any_match:
        return DEFAULT_CIRCUIT

    return results


REPO_ROOT = PROJECT_ROOT.parent


def _run_subprocess_job(job_id: str, commands: list[list[str]]) -> None:
    job = JOBS[job_id]
    buffer = job["output_buffer"]
    try:
        for cmd in commands:
            buffer.write(f"$ {' '.join(cmd)}\n")
            proc = subprocess.Popen(
                cmd,
                cwd=str(REPO_ROOT),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )
            assert proc.stdout is not None
            for line in proc.stdout:
                buffer.write(line)
            code = proc.wait()
            if code != 0:
                job["status"] = "failed"
                job["error"] = buffer.getvalue()[-2000:]
                job["finished_at"] = datetime.now(timezone.utc).isoformat()
                return
        job["status"] = "complete"
        job["error"] = None
    except Exception as exc:
        job["status"] = "failed"
        job["error"] = str(exc)
    finally:
        job["finished_at"] = datetime.now(timezone.utc).isoformat()


def _start_job(commands: list[list[str]]) -> str:
    job_id = str(uuid4())
    JOBS[job_id] = {
        "job_id": job_id,
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "finished_at": None,
        "output_buffer": StringIO(),
        "error": None,
    }
    thread = threading.Thread(
        target=_run_subprocess_job, args=(job_id, commands), daemon=True
    )
    thread.start()
    return job_id


def _reload_runtime_state() -> None:
    global predictor, PARTS_DF, circuit_model_bundle
    predictor = ExpressionPredictor()
    PARTS_DF = _load_parts_df()
    circuit_model_bundle = _load_circuit_model()


@app.get("/model/status")
def model_status() -> dict[str, Any]:
    active_predictor = _require_predictor()
    return {
        "model_loaded": active_predictor.promoter_model is not None,
        "rbs_model_loaded": active_predictor.rbs_model is not None,
        "circuit_model_loaded": circuit_model_bundle is not None,
        "mode": active_predictor.mode,
        "promoter_model_path": MODEL_PATH,
        "rbs_model_path": RBS_MODEL_PATH,
        "circuit_model_path": CIRCUIT_MODEL_PATH,
        "promoter_features_count": len(active_predictor.promoter_feature_names),
        "rbs_features_count": len(active_predictor.rbs_feature_names),
        "parts_count": len(PARTS_DF) if PARTS_DF is not None else 0,
    }


@app.get("/parts")
def list_parts(
    type: str | None = Query(default=None, alias="type"),
    types: str | None = Query(
        default=None,
        description="Comma-separated part types, e.g. promoter,rbs,cds",
    ),
    search: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    if PARTS_DF is None:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Parts library not loaded. Run combine_datasets.py first.",
            },
        )

    work = PARTS_DF.copy()

    type_filters: list[str] = []
    if types:
        type_filters = [t.strip() for t in types.split(",") if t.strip()]
    elif type:
        type_filters = [type]

    if type_filters:
        normalized_filters: set[str] = set()
        for raw in type_filters:
            normalized = _normalize_type(raw)
            if normalized == "gene":
                normalized = "cds"
            normalized_filters.add(normalized)
        work = work[work["part_type"].map(_normalize_type).isin(normalized_filters)]

    if search:
        pattern = search.strip()
        desc_plain = (
            work["description"]
            .fillna("")
            .map(lambda value: html_module.unescape(str(value)))
        )
        name_match = work["name"].fillna("").str.contains(pattern, case=False, na=False)
        desc_match = desc_plain.str.contains(pattern, case=False, na=False)
        id_match = work["part_id"].fillna("").str.contains(pattern, case=False, na=False)
        work = work[name_match | desc_match | id_match]

    work = work.sort_values("part_id").reset_index(drop=True)
    total_matches = len(work)
    limited = work.iloc[offset : offset + limit]
    parts = limited[
        ["part_id", "part_type", "name", "description", "sequence"]
    ].to_dict(orient="records")

    for part in parts:
        if _normalize_type(part["part_type"]) == "cds":
            part["part_type"] = part.get("part_type", "cds")

    return {
        "parts": parts,
        "total_matches": total_matches,
        "offset": offset,
        "limit": limit,
    }


@app.get("/parts/{part_id}/structure")
def get_part_structure(part_id: str) -> dict[str, Any]:
    if PARTS_DF is None:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Parts library not loaded. Run combine_datasets.py first.",
            },
        )

    row = _lookup_part_row(part_id)
    if row is None:
        raise HTTPException(status_code=404, detail={"error": "Part not found"})

    part_type = str(row.get("part_type", ""))
    normalized = _normalize_type(part_type)
    dna_sequence = str(row.get("sequence", ""))
    part_name = str(row.get("name", part_id))

    if normalized == "cds":
        pdb_url, uniprot_id, sequence = _resolve_protein_structure(
            part_name, dna_sequence, row
        )
        return {
            "part_id": part_id,
            "part_type": part_type,
            "render_mode": "protein",
            "pdb_url": pdb_url,
            "uniprot_id": uniprot_id,
            "sequence": sequence,
        }

    if normalized in {"promoter", "rbs", "terminator"}:
        pdb_url, structure_label = _resolve_regulatory_structure(
            part_type, part_name, row
        )
        return {
            "part_id": part_id,
            "part_type": part_type,
            "render_mode": "pdb" if pdb_url else "dna_linear",
            "pdb_url": pdb_url,
            "uniprot_id": None,
            "sequence": dna_sequence,
            "structure_label": structure_label,
        }

    return {
        "part_id": part_id,
        "part_type": part_type,
        "render_mode": "dna_helix",
        "pdb_url": None,
        "uniprot_id": None,
        "sequence": dna_sequence,
    }


@app.post("/circuits/dna-structure")
def circuit_dna_structure(body: DnaStructureRequest) -> dict[str, Any]:
    if PARTS_DF is None and not body.parts:
        raise HTTPException(
            status_code=503,
            detail={"error": "Parts library not loaded. Run combine_datasets.py first."},
        )
    if body.parts:
        parts_input = [p.model_dump() for p in body.parts]
        return _assemble_dna_structure_from_parts(parts_input, preview=body.preview)
    if body.part_ids:
        return _assemble_dna_structure(body.part_ids, preview=body.preview)
    raise HTTPException(
        status_code=422,
        detail={"error": "Provide part_ids or parts for DNA structure assembly"},
    )


@app.post("/circuits/protein-structure")
def circuit_protein_structure(body: ProteinStructureRequest) -> dict[str, Any]:
    seq = _clean_amino_acid_sequence(body.amino_acid_sequence)
    if not seq and body.part_id:
        seq = _clean_amino_acid_sequence(_sequence_from_part_id(body.part_id))
    if not seq:
        raise HTTPException(
            status_code=422,
            detail={"error": "A valid amino acid sequence or CDS part_id is required"},
        )

    uniprot_id: str | None = None
    pdb_url: str | None = None
    pdb_content: str | None = None
    source = "unknown"
    match_type = "none"
    match_identity: float | None = None
    matched_protein_name: str | None = None
    matched_part_id: str | None = None
    disclaimer: str | None = None

    def _apply_structure_result(result: dict[str, Any]) -> None:
        nonlocal pdb_url, pdb_content, uniprot_id, source, match_type
        nonlocal match_identity, matched_protein_name, matched_part_id, disclaimer
        pdb_url = result.get("pdb_url")
        pdb_content = result.get("pdb_content")
        uniprot_id = result.get("uniprot_id")
        source = str(result.get("source", "alphafold"))
        match_type = str(result.get("match_type", "exact"))
        match_identity = result.get("match_identity")
        matched_protein_name = result.get("matched_protein_name")
        matched_part_id = result.get("matched_part_id")
        disclaimer = result.get("disclaimer")

    uniprot_id = _search_uniprot_by_sequence(seq)
    if uniprot_id:
        candidate_url = _fetch_alphafold_pdb_url(uniprot_id)
        if candidate_url:
            _apply_structure_result(
                {
                    "pdb_url": candidate_url,
                    "pdb_content": _fetch_pdb_text(candidate_url),
                    "uniprot_id": uniprot_id,
                    "source": "alphafold",
                    "match_type": "exact",
                }
            )

    if not pdb_url and body.part_id:
        circuit_row = _lookup_part_row(body.part_id)
        if circuit_row is not None and _normalize_type(str(circuit_row.get("part_type", ""))) == "cds":
            circuit_aa = _translate_dna(str(circuit_row.get("sequence", "")))
            identity = _sequence_similarity(seq, circuit_aa) if circuit_aa else 0.0
            homolog = _alphafold_match_from_cds_row(
                circuit_row,
                match_type="closest" if identity < 0.98 else "exact",
                identity=identity if identity < 0.98 else None,
            )
            if homolog:
                _apply_structure_result(homolog)

    if not pdb_url:
        closest = _find_closest_alphafold_match(seq, body.part_id)
        if closest:
            closest_row = _lookup_part_row(str(closest["part_id"]))
            if closest_row is not None:
                homolog = _alphafold_match_from_cds_row(
                    closest_row,
                    match_type="closest",
                    identity=float(closest["identity"]),
                )
                if homolog:
                    _apply_structure_result(homolog)

    if not pdb_url and not pdb_content:
        pdb_content = _fetch_esmfold_pdb(seq)
        if pdb_content:
            source = "esmfold"
            match_type = "predicted"
            disclaimer = (
                "No close AlphaFold homolog was found. Showing an ESMFold prediction "
                "computed directly from your amino acid sequence."
            )

    if not pdb_url and not pdb_content:
        raise HTTPException(
            status_code=404,
            detail={"error": "Could not resolve a 3D structure for this protein sequence"},
        )

    if pdb_url and not pdb_content:
        pdb_content = _fetch_pdb_text(pdb_url)

    return {
        "amino_acid_sequence": seq,
        "amino_acid_length": len(seq),
        "pdb_url": pdb_url,
        "pdb_content": pdb_content,
        "uniprot_id": uniprot_id,
        "source": source,
        "match_type": match_type,
        "match_identity": match_identity,
        "matched_protein_name": matched_protein_name,
        "matched_part_id": matched_part_id,
        "disclaimer": disclaimer,
        "part_id": body.part_id,
    }


@app.post("/recommend")
def recommend(body: RecommendRequest) -> dict[str, Any]:
    recommended_parts = recommend_parts(body.trait)
    return {"recommended_parts": recommended_parts}


@app.post("/circuits/predict")
def predict_circuit(body: PredictRequest) -> dict[str, Any]:
    parts = [part.model_dump() for part in body.parts]
    prediction = _predict_with_validation(parts)
    parts_detail = [_part_detail_from_request(part) for part in parts]
    circuit_svg = _build_circuit_svg(parts_detail)
    amino_acid_sequence: str | None = None
    cds_part = _find_part(parts, "cds")
    if cds_part:
        amino_acid_sequence = _translate_dna(str(cds_part.get("sequence", "")))
    return {
        "parts": [part["part_id"] for part in parts],
        "parts_detail": parts_detail,
        "circuit_svg": circuit_svg,
        "amino_acid_sequence": amino_acid_sequence,
        "prediction": prediction,
    }


@app.post("/circuits/yield")
def predict_yield(body: YieldRequest) -> dict[str, Any]:
    return _compute_yield(body)


# TODO: add API key auth before any production deployment
@app.post("/admin/refresh-parts")
def admin_refresh_parts() -> dict[str, str]:
    commands = [
        [sys.executable, "-m", "backend.data.fetch_igem_full"],
        [sys.executable, "-m", "backend.data.combine_datasets"],
        [sys.executable, "-m", "backend.data.seed_structure_ids"],
    ]
    job_id = _start_job(commands)

    def _reload_when_done() -> None:
        while JOBS[job_id]["status"] == "running":
            threading.Event().wait(1)
        if JOBS[job_id]["status"] == "complete":
            global PARTS_DF
            PARTS_DF = _load_parts_df()

    threading.Thread(target=_reload_when_done, daemon=True).start()
    return {"status": "refresh_started", "job_id": job_id}


@app.post("/admin/retrain")
def admin_retrain(body: RetrainRequest | None = None) -> dict[str, Any]:
    requested = (body.models if body and body.models else ["promoter", "rbs", "circuit"])
    commands: list[list[str]] = []
    models_queued: list[str] = []

    if "promoter" in requested or "rbs" in requested:
        commands.append([sys.executable, "-m", "backend.prediction_engine.train"])
        if "promoter" in requested:
            models_queued.append("promoter")
        if "rbs" in requested:
            models_queued.append("rbs")

    if "circuit" in requested:
        build_script = PROJECT_ROOT / "data" / "build_circuit_training.py"
        train_circuit_script = PROJECT_ROOT / "prediction_engine" / "train_circuit.py"
        if build_script.exists():
            commands.append([sys.executable, "-m", "backend.data.build_circuit_training"])
        if train_circuit_script.exists():
            commands.append(
                [sys.executable, "-m", "backend.prediction_engine.train_circuit"]
            )
        models_queued.append("circuit")

    if not commands:
        raise HTTPException(status_code=400, detail={"error": "No valid models requested"})

    job_id = _start_job(commands)

    def _reload_models_when_done() -> None:
        while JOBS[job_id]["status"] == "running":
            threading.Event().wait(1)
        if JOBS[job_id]["status"] == "complete":
            _reload_runtime_state()

    threading.Thread(target=_reload_models_when_done, daemon=True).start()
    return {
        "status": "training_started",
        "job_id": job_id,
        "models_queued": models_queued,
    }


@app.get("/admin/job/{job_id}")
def admin_job_status(job_id: str) -> dict[str, Any]:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail={"error": f"Job {job_id} not found"})

    output_lines = job["output_buffer"].getvalue().splitlines()
    return {
        "job_id": job_id,
        "status": job["status"],
        "started_at": job["started_at"],
        "finished_at": job["finished_at"],
        "output": "\n".join(output_lines[-50:]),
        "error": job["error"],
    }
