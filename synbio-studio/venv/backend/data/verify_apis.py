"""Smoke-test external APIs used by GeneSmith."""

from __future__ import annotations

import sys

import requests

UNIPROT_TEST_ACCESSION = "P42212"
UNIPROT_URL = f"https://rest.uniprot.org/uniprotkb/{UNIPROT_TEST_ACCESSION}.json"
TIMEOUT = 30


def verify_uniprot_direct_accession() -> bool:
    """UniProt must be queried by accession only — never the search endpoint."""
    response = requests.get(UNIPROT_URL, timeout=TIMEOUT)
    if response.status_code != 200:
        print(f"FAIL UniProt: HTTP {response.status_code} for {UNIPROT_URL}")
        return False

    payload = response.json()
    accession = payload.get("primaryAccession")
    if accession != UNIPROT_TEST_ACCESSION:
        print(
            f"FAIL UniProt: primaryAccession={accession!r}, "
            f"expected {UNIPROT_TEST_ACCESSION!r}"
        )
        return False

    print(f"OK UniProt direct accession lookup ({UNIPROT_TEST_ACCESSION})")
    return True


def main() -> None:
    ok = verify_uniprot_direct_accession()
    if not ok:
        sys.exit(1)
    print("All API checks passed.")


if __name__ == "__main__":
    main()
