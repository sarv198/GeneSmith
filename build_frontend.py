"""Build the Vite frontend and copy dist/ into public/ for Vercel CDN."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "synbio-studio" / "venv" / "frontend"
PUBLIC = ROOT / "public"
BACKEND_STATIC = ROOT / "backend" / "static"


def run(cmd: list[str], cwd: Path) -> None:
    print(f"Running {' '.join(cmd)} in {cwd}")
    subprocess.run(cmd, cwd=cwd, check=True)


def main() -> None:
    if not FRONTEND.exists():
        raise SystemExit(f"Frontend directory not found: {FRONTEND}")

    npm = "npm.cmd" if sys.platform == "win32" else "npm"
    run([npm, "install", "--legacy-peer-deps"], FRONTEND)
    run([npm, "run", "build"], FRONTEND)

    dist = FRONTEND / "dist"
    if not dist.exists():
        raise SystemExit(f"Build output not found: {dist}")

    if PUBLIC.exists():
        shutil.rmtree(PUBLIC)
    if BACKEND_STATIC.exists():
        shutil.rmtree(BACKEND_STATIC)
    shutil.copytree(dist, PUBLIC)
    shutil.copytree(dist, BACKEND_STATIC)

    logo = BACKEND_STATIC / "genesmith-logo.png"
    js_assets = list((BACKEND_STATIC / "assets").glob("*.js"))
    if not logo.is_file() or not js_assets:
        raise SystemExit(
            "Build output is incomplete. Expected genesmith-logo.png and bundled JS assets."
        )

    print(f"Copied {dist} -> {PUBLIC}")
    print(f"Copied {dist} -> {BACKEND_STATIC}")
    print(f"Static bundle: logo={logo.name}, js={js_assets[0].name}")


if __name__ == "__main__":
    main()
