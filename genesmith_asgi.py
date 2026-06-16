"""Vercel ASGI entrypoint for the GeneSmith FastAPI backend."""

from __future__ import annotations

import importlib
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "synbio-studio" / "venv"
ROOT_STR = str(ROOT)

if ROOT_STR not in sys.path:
    sys.path.insert(0, ROOT_STR)

os.chdir(ROOT)


def _load_app():
    for module_name in ("backend.api.main", "backend.API.main"):
        try:
            module = importlib.import_module(module_name)
        except ModuleNotFoundError:
            continue
        fastapi_app = getattr(module, "app", None)
        if fastapi_app is not None:
            return fastapi_app
    raise RuntimeError("Could not import GeneSmith FastAPI app from backend")


app = _load_app()
