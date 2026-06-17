"""Vercel ASGI entrypoint for the GeneSmith FastAPI backend."""

from __future__ import annotations

import importlib
import os
import sys
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ROOT_STR = str(ROOT)

if ROOT_STR not in sys.path:
    sys.path.insert(0, ROOT_STR)

os.environ.setdefault("GENESMITH_PROJECT_ROOT", ROOT_STR)


def _error_app(detail: str):
    from fastapi import FastAPI
    from fastapi.responses import PlainTextResponse

    fallback = FastAPI(title="GeneSmith API (startup error)")

    @fallback.api_route(
        "/{full_path:path}",
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    )
    async def startup_failed(full_path: str):
        return PlainTextResponse(
            f"GeneSmith API failed to start:\n\n{detail}",
            status_code=500,
        )

    return fallback


def _load_app():
    errors: list[str] = []
    for module_name in ("backend.api.main", "backend.API.main"):
        try:
            module = importlib.import_module(module_name)
        except Exception as exc:
            errors.append(f"{module_name}:\n{traceback.format_exc()}")
            continue
        fastapi_app = getattr(module, "app", None)
        if fastapi_app is not None:
            return fastapi_app
        errors.append(f"{module_name}: no app export found")
    detail = "\n\n".join(errors) if errors else "unknown import failure"
    print(detail)
    return _error_app(detail)


app = _load_app()
