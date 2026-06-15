"""Verify external APIs used for 3D molecular visualization."""

from __future__ import annotations

import sys

import requests

TIMEOUT = 10

ALPHAFOLD_URL = "https://alphafold.ebi.ac.uk/api/prediction/P42212"
UNIPROT_URL = (
    "https://rest.uniprot.org/uniprotkb/search?query=GFP&format=json&size=1"
)
RCSB_PDB_URL = "https://files.rcsb.org/download/1EMA.pdb"


def verify_alphafold() -> tuple[bool, str]:
    try:
        response = requests.get(ALPHAFOLD_URL, timeout=TIMEOUT)
        if response.status_code != 200:
            return False, f"HTTP {response.status_code}"
        payload = response.json()
        if isinstance(payload, list):
            has_pdb_url = any("pdbUrl" in item for item in payload if isinstance(item, dict))
        elif isinstance(payload, dict):
            has_pdb_url = "pdbUrl" in payload
        else:
            has_pdb_url = False
        if not has_pdb_url:
            return False, "response JSON missing pdbUrl"
        return True, ""
    except requests.RequestException as exc:
        return False, str(exc)


def verify_uniprot() -> tuple[bool, str]:
    try:
        response = requests.get(UNIPROT_URL, timeout=TIMEOUT)
        if response.status_code != 200:
            return False, f"HTTP {response.status_code}"
        payload = response.json()
        results = payload.get("results", [])
        if not results:
            return False, "results list is empty"
        return True, ""
    except requests.RequestException as exc:
        return False, str(exc)


def verify_rcsb_pdb() -> tuple[bool, str]:
    try:
        response = requests.get(RCSB_PDB_URL, timeout=TIMEOUT)
        if response.status_code != 200:
            return False, f"HTTP {response.status_code}"
        first_line = response.text.splitlines()[0] if response.text else ""
        if not first_line.startswith("HEADER"):
            return False, "first line does not start with HEADER"
        return True, ""
    except requests.RequestException as exc:
        return False, str(exc)


def main() -> None:
    working: list[str] = []
    failed: list[str] = []

    ok, error = verify_alphafold()
    if ok:
        print("AlphaFold API: OK")
        working.append("AlphaFold")
    else:
        print(f"AlphaFold API: FAILED — {error}")
        failed.append("AlphaFold")

    ok, error = verify_uniprot()
    if ok:
        print("UniProt API: OK")
        working.append("UniProt")
    else:
        print(f"UniProt API: FAILED — {error}")
        failed.append("UniProt")

    ok, error = verify_rcsb_pdb()
    if ok:
        print("RCSB PDB API: OK")
        working.append("RCSB PDB")
    else:
        print(f"RCSB PDB API: FAILED — {error}")
        failed.append("RCSB PDB")

    print(f"APIs ready for visualization: {working}")
    print(f"APIs unavailable: {failed}")
    print("Visualization will degrade gracefully for unavailable APIs")

    if not working:
        sys.exit(1)


if __name__ == "__main__":
    main()
