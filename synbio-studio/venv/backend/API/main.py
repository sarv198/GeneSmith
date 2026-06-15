"""GeneSmith API — expression prediction, parts library, and admin jobs."""

from __future__ import annotations

import os
import pickle
import re
import subprocess
import sys
import threading
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path
from typing import Any
from uuid import uuid4

import numpy as np
import pandas as pd
import requests
from fastapi import FastAPI, HTTPException, Query
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

predictor = ExpressionPredictor()
MODEL_PATH = "backend/prediction_engine/models/gbm_v1.pkl"
RBS_MODEL_PATH = "backend/prediction_engine/models/rbs_gbm_v1.pkl"
CIRCUIT_MODEL_PATH = "backend/prediction_engine/models/gbm_circuit_v1.pkl"
PARTS_MASTER_PATH = Path("backend/data/parts_master.csv")
PROJECT_ROOT = Path(__file__).resolve().parents[2]

JOBS: dict[str, dict[str, Any]] = {}
circuit_model_bundle: dict[str, Any] | None = None

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
    df = pd.read_csv(PARTS_MASTER_PATH)
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


def _extract_alphafold_id(uniprot_payload: dict[str, Any]) -> str | None:
    for xref in uniprot_payload.get("uniProtKBCrossReferences", []):
        if xref.get("database") != "AlphaFoldDB":
            continue
        for prop in xref.get("properties", []):
            if prop.get("key") == "id" and _is_present(prop.get("value")):
                return str(prop["value"]).strip()
        if _is_present(xref.get("id")):
            return str(xref["id"]).strip()
    return None


def _fetch_alphafold_pdb_url(uniprot_id: str) -> tuple[str | None, str | None]:
    url = f"https://rest.uniprot.org/uniprotkb/{uniprot_id}.json"
    response = requests.get(url, timeout=30)
    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail={
                "error": f"UniProt lookup failed for {uniprot_id}",
                "detail": f"HTTP {response.status_code}",
            },
        )
    payload = response.json()
    if payload.get("primaryAccession") != uniprot_id:
        raise HTTPException(
            status_code=502,
            detail={
                "error": f"UniProt accession mismatch for {uniprot_id}",
                "detail": f"Got {payload.get('primaryAccession')}",
            },
        )
    alphafold_id = _extract_alphafold_id(payload)
    if not alphafold_id:
        return None, None
    pdb_url = f"https://alphafold.ebi.ac.uk/files/AF-{alphafold_id}-F1-model_v4.pdb"
    return alphafold_id, pdb_url


def _load_circuit_model() -> dict[str, Any] | None:
    if not Path(CIRCUIT_MODEL_PATH).exists():
        return None
    with open(CIRCUIT_MODEL_PATH, "rb") as handle:
        return pickle.load(handle)


PARTS_DF: pd.DataFrame | None = _load_parts_df()
circuit_model_bundle = _load_circuit_model()


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
    status = _validate_and_classify(parts)
    flags = status["flags"]

    promoter = _find_part(parts, "promoter")
    rbs = _find_part(parts, "rbs")
    cds = _find_part(parts, "cds")
    terminator = _find_part(parts, "terminator")

    promoter_rpu = round(predictor._predict_promoter(str(promoter.get("sequence", ""))), 4)

    translation_rate: float | None = None
    translation_model = None
    if flags["rbs"] and rbs:
        translation_rate = round(predictor._predict_rbs(str(rbs.get("sequence", ""))), 4)
        translation_model = "RBS-GBM-v1" if predictor.rbs_model else "default"
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
        "model": predictor.mode,
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


def _run_subprocess_job(job_id: str, commands: list[list[str]]) -> None:
    job = JOBS[job_id]
    buffer = job["output_buffer"]
    try:
        for cmd in commands:
            buffer.write(f"$ {' '.join(cmd)}\n")
            proc = subprocess.Popen(
                cmd,
                cwd=str(PROJECT_ROOT),
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
    return {
        "model_loaded": predictor.promoter_model is not None,
        "rbs_model_loaded": predictor.rbs_model is not None,
        "circuit_model_loaded": circuit_model_bundle is not None,
        "mode": predictor.mode,
        "promoter_model_path": MODEL_PATH,
        "rbs_model_path": RBS_MODEL_PATH,
        "circuit_model_path": CIRCUIT_MODEL_PATH,
        "promoter_features_count": len(predictor.promoter_feature_names),
        "rbs_features_count": len(predictor.rbs_feature_names),
        "parts_count": len(PARTS_DF) if PARTS_DF is not None else 0,
    }


@app.get("/parts")
def list_parts(
    type: str | None = Query(default=None, alias="type"),
    search: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    if PARTS_DF is None:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Parts library not loaded. Run combine_datasets.py first.",
            },
        )

    work = PARTS_DF.copy()
    if type:
        normalized = _normalize_type(type)
        if normalized == "gene":
            normalized = "cds"
        work = work[work["part_type"].map(_normalize_type) == normalized]

    if search:
        pattern = search.strip()
        name_match = work["name"].fillna("").str.contains(pattern, case=False, na=False)
        desc_match = work["description"].fillna("").str.contains(
            pattern, case=False, na=False
        )
        work = work[name_match | desc_match]

    total_matches = len(work)
    limited = work.head(limit)
    parts = limited[
        ["part_id", "part_type", "name", "description", "sequence"]
    ].to_dict(orient="records")

    for part in parts:
        if _normalize_type(part["part_type"]) == "cds":
            part["part_type"] = part.get("part_type", "cds")

    return {"parts": parts, "total_matches": total_matches}


@app.get("/parts/{part_id}/structure")
def get_part_structure(part_id: str) -> dict[str, Any]:
    if PARTS_DF is None:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Parts library not loaded. Run combine_datasets.py first.",
            },
        )

    matches = PARTS_DF[PARTS_DF["part_id"] == part_id]
    if matches.empty:
        raise HTTPException(
            status_code=404,
            detail={"error": f"Part not found: {part_id}"},
        )

    row = matches.iloc[0]
    sequence = str(row.get("sequence", ""))
    uniprot_id = row.get("uniprot_id")
    pdb_id = row.get("pdb_id")

    if not _is_present(uniprot_id):
        return {
            "part_id": part_id,
            "part_type": str(row.get("part_type", "")),
            "render_mode": "dna_helix",
            "sequence": sequence,
            "uniprot_id": None,
            "pdb_id": str(pdb_id).strip() if _is_present(pdb_id) else None,
            "alphafold_id": None,
            "pdb_url": None,
        }

    uniprot_id = str(uniprot_id).strip()
    alphafold_id, pdb_url = _fetch_alphafold_pdb_url(uniprot_id)
    return {
        "part_id": part_id,
        "part_type": str(row.get("part_type", "")),
        "render_mode": "alphafold",
        "sequence": sequence,
        "uniprot_id": uniprot_id,
        "pdb_id": str(pdb_id).strip() if _is_present(pdb_id) else None,
        "alphafold_id": alphafold_id,
        "pdb_url": pdb_url,
    }


@app.post("/recommend")
def recommend(body: RecommendRequest) -> dict[str, Any]:
    recommended_parts = recommend_parts(body.trait)
    return {"recommended_parts": recommended_parts}


@app.post("/circuits/predict")
def predict_circuit(body: PredictRequest) -> dict[str, Any]:
    parts = [part.model_dump() for part in body.parts]
    prediction = _predict_with_validation(parts)
    return {"parts": parts, "prediction": prediction}


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
        build_script = PROJECT_ROOT / "backend" / "data" / "build_circuit_training.py"
        train_circuit_script = (
            PROJECT_ROOT / "backend" / "prediction_engine" / "train_circuit.py"
        )
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
