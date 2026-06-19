"""Build the Vite frontend and copy dist/ into static/ for Vercel."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "synbio-studio" / "venv" / "frontend"
DIST = FRONTEND / "dist"
PUBLIC = ROOT / "public"
STATIC = ROOT / "static"


def run(cmd: list[str], cwd: Path) -> None:
    print(f"Running {' '.join(cmd)} in {cwd}")
    subprocess.run(cmd, cwd=cwd, check=True)


def main() -> None:
    if not FRONTEND.exists():
        raise SystemExit(f"Frontend directory not found: {FRONTEND}")

    npm = "npm.cmd" if sys.platform == "win32" else "npm"
    run([npm, "install", "--legacy-peer-deps"], FRONTEND)
    run([npm, "run", "build"], FRONTEND)

    if not DIST.exists():
        raise SystemExit(f"Build output not found: {DIST}")

    logo = DIST / "genesmith-logo.png"
    js_assets = list((DIST / "assets").glob("*.js"))
    css_assets = list((DIST / "assets").glob("*.css"))
    if not logo.is_file() or not js_assets or not css_assets:
        raise SystemExit(
            "Build output is incomplete. Expected genesmith-logo.png, JS, and CSS in dist/."
        )

    for target in (PUBLIC, STATIC):
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(DIST, target)

    print(f"Frontend build OK: {DIST}")
    print(f"Copied dist -> {PUBLIC}")
    print(f"Copied dist -> {STATIC}")
    print(f"  logo={logo.name}, js={js_assets[0].name}, css={css_assets[0].name}")


if __name__ == "__main__":
    main()
