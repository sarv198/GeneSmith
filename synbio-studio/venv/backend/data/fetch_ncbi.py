"""Fetch NCBI promoter sequences for multi-organism feature diversity (Task A/B)."""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd
from Bio import Entrez, SeqIO

OUTPUT_PATH = Path("backend/data/ncbi_promoters.csv")

ORGANISMS = (
    ("83333", "Escherichia coli K-12", "E. coli"),
    ("224308", "Bacillus subtilis 168", "B. subtilis"),
    ("160488", "Pseudomonas putida KT2440", "P. putida"),
)


def _promoter_from_record(record) -> str | None:
    for feature in record.features:
        if feature.type.lower() != "promoter":
            continue
        seq = str(feature.extract(record.seq)).upper()
        seq = re.sub(r"[^ATCG]", "", seq)
        if 20 <= len(seq) <= 250:
            return seq

    if "promoter" in record.description.lower():
        seq = re.sub(r"[^ATCG]", "", str(record.seq).upper())
        if 20 <= len(seq) <= 250:
            return seq
    return None


def fetch_for_organism(taxid: str, organism_name: str, label: str) -> list[dict[str, object]]:
    Entrez.email = "genesmith@demo.com"
    query = (
        f"(promoter[Title] OR sigma factor[Title]) AND "
        f"{organism_name}[Organism] AND 20:500[SLEN]"
    )
    try:
        search = Entrez.esearch(db="nucleotide", term=query, retmax=100)
        result = Entrez.read(search)
        ids = result.get("IdList", [])
        if not ids:
            return []
        fetch = Entrez.efetch(db="nucleotide", id=",".join(ids), rettype="gb", retmode="text")
        records = SeqIO.parse(fetch, "genbank")
    except Exception as exc:
        raise SystemExit(f"NCBI Entrez query failed for {organism_name}: {exc}") from exc

    rows: list[dict[str, object]] = []
    for record in records:
        sequence = _promoter_from_record(record)
        if sequence:
            rows.append(
                {
                    "sequence": sequence,
                    "rpu": None,
                    "organism": label,
                    "source": "ncbi",
                }
            )
    return rows


def main() -> None:
    all_rows: list[dict[str, object]] = []
    for taxid, organism_name, label in ORGANISMS:
        rows = fetch_for_organism(taxid, organism_name, label)
        all_rows.extend(rows)
        print(f"{label}: {len(rows)} promoters")

    df = pd.DataFrame(all_rows, columns=["sequence", "rpu", "organism", "source"])
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Total saved: {len(df)} -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
