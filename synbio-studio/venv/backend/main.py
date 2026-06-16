"""Minimal ASGI entrypoint for the GeneSmith backend.

This module exposes a small FastAPI `app` so the server can run
even when deeper application modules (database, ML) are not yet
configured or fail to import. If `backend.API.main` can be
imported successfully, it will be mounted at `/api`.
"""

from fastapi import FastAPI

app = FastAPI(title="GeneSmith API")


@app.get("/")
def root():
	return {"status": "GeneSmith backend is running"}


# Try to mount the more featureful API if it's importable.
try:
	import importlib

	api_main = None
	for module_name in ("backend.api.main", "backend.API.main"):
		try:
			api_main = importlib.import_module(module_name)
			break
		except ModuleNotFoundError:
			continue
	if api_main is not None and hasattr(api_main, "app"):
		app.mount("/api", api_main.app)
except Exception:
	# fail gracefully if deeper modules are missing or erroring
	pass
