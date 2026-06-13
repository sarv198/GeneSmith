"""Fetch NCBI promoter sequences for multi-organism feature diversity (Task A/B)."""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd
from Bio import Entrez, SeqIO

OUTPUT_PATH = Path("backend/data/ncbi_promoters.csv")
UPSTREAM_BP = 100
MAX_GENES = 200
MAX_UPSTREAM_PER_ORG = 50

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


def fetch_annotated_promoters(organism_name: str, label: str) -> list[dict[str, object]]:
    Entrez.email = "genesmith@demo.com"
    query = f"promoter[Title] AND sigma[Title] AND {organism_name}[Organism]"
    try:
        search = Entrez.esearch(db="nucleotide", term=query, retmax=100)
        result = Entrez.read(search)
        ids = result.get("IdList", [])
        if not ids:
            return []
        fetch = Entrez.efetch(
            db="nucleotide", id=",".join(ids), rettype="gb", retmode="text"
        )
        records = SeqIO.parse(fetch, "genbank")
    except Exception as exc:
        raise SystemExit(f"NCBI annotated promoter query failed for {organism_name}: {exc}") from exc

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


def _load_chromosome(accession: str):
    Entrez.email = "genesmith@demo.com"
    handle = Entrez.efetch(
        db="nucleotide", id=accession, rettype="fasta", retmode="text"
    )
    return SeqIO.read(handle, "fasta")


def _gene_summaries(organism_name: str) -> list[dict[str, object]]:
    Entrez.email = "genesmith@demo.com"
    search = Entrez.esearch(
        db="gene",
        term=f"{organism_name}[Organism] AND alive[prop]",
        retmax=MAX_GENES,
    )
    ids = Entrez.read(search).get("IdList", [])
    if not ids:
        return []

    summary = Entrez.read(Entrez.esummary(db="gene", id=",".join(ids)))
    doc_set = summary["DocumentSummarySet"]["DocumentSummary"]
    if not isinstance(doc_set, list):
        doc_set = [doc_set]
    return doc_set


def fetch_upstream_proxies(organism_name: str, label: str) -> list[dict[str, object]]:
    try:
        genes = _gene_summaries(organism_name)
    except Exception as exc:
        print(f"WARNING: NCBI gene query failed for {organism_name}: {exc}")
        return []

    chrom_cache: dict[str, object] = {}
    gene_intervals: dict[str, list[tuple[int, int]]] = {}
    rows: list[dict[str, object]] = []
    seen: set[str] = set()

    for gene in genes:
        genomic = gene.get("GenomicInfo")
        if not genomic:
            continue
        info = genomic[0] if isinstance(genomic, list) else genomic
        accession = info.get("ChrAccVer")
        start = int(info.get("ChrStart", 0))
        stop = int(info.get("ChrStop", 0))
        if not accession or start <= 0 or stop <= 0:
            continue
        if start >= stop:
            continue

        gene_lo = min(start, stop)
        gene_hi = max(start, stop)
        gene_intervals.setdefault(accession, []).append((gene_lo, gene_hi))

    for gene in genes:
        if len(rows) >= MAX_UPSTREAM_PER_ORG:
            break
        genomic = gene.get("GenomicInfo")
        if not genomic:
            continue
        info = genomic[0] if isinstance(genomic, list) else genomic
        accession = info.get("ChrAccVer")
        start = int(info.get("ChrStart", 0))
        stop = int(info.get("ChrStop", 0))
        if not accession or start <= 0 or stop <= 0 or start >= stop:
            continue

        upstream_start = max(1, start - UPSTREAM_BP)
        upstream_end = start - 1
        if upstream_end - upstream_start + 1 < 20:
            continue

        overlaps = False
        for gene_lo, gene_hi in gene_intervals.get(accession, []):
            if gene_lo < upstream_end and gene_hi > upstream_start:
                if not (gene_lo == min(start, stop) and gene_hi == max(start, stop)):
                    overlaps = True
                    break
        if overlaps:
            continue

        if accession not in chrom_cache:
            try:
                chrom_cache[accession] = _load_chromosome(accession)
            except Exception as exc:
                print(f"WARNING: Could not load chromosome {accession}: {exc}")
                continue

        chrom = chrom_cache[accession]
        region = str(chrom.seq[upstream_start - 1 : upstream_end]).upper()
        region = re.sub(r"[^ATCG]", "", region)
        if not region or not re.fullmatch(r"[ATCG]+", region):
            continue
        if region in seen:
            continue
        seen.add(region)
        rows.append(
            {
                "sequence": region,
                "rpu": None,
                "organism": label,
                "source": "ncbi_upstream",
            }
        )

    return rows


def main() -> None:
    annotated_rows: list[dict[str, object]] = []
    upstream_rows: list[dict[str, object]] = []

    for _taxid, organism_name, label in ORGANISMS:
        annotated = fetch_annotated_promoters(organism_name, label)
        upstream = fetch_upstream_proxies(organism_name, label)
        annotated_rows.extend(annotated)
        upstream_rows.extend(upstream)
        print(f"{label}: {len(annotated)} annotated, {len(upstream)} upstream proxies")

    all_rows = annotated_rows + upstream_rows
    df = pd.DataFrame(all_rows, columns=["sequence", "rpu", "organism", "source"])
    if not df.empty:
        df = df.drop_duplicates(subset=["sequence"], keep="first")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)

    print(f"Annotated promoters: {len(annotated_rows)}")
    print(f"Upstream proxy regions: {len(upstream_rows)}")
    print(f"Total saved: {len(df)}")
    print(
        "Note: all NCBI rows have rpu=None and are used for feature diversity only, "
        "not as labeled training examples"
    )
    print(f"Saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
