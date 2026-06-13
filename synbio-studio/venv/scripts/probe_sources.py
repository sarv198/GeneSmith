import gzip
import io
import re
import requests

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

# Urtecho: merge mapping + expression
map_text = gzip.decompress(
    requests.get(
        "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE108nnn/GSE108535/suppl/GSE108535_barcode_mapping.txt.gz",
        headers={"User-Agent": UA},
        timeout=120,
    ).content
).decode("utf-8", "replace")

expr_text = gzip.decompress(
    requests.get(
        "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE108nnn/GSE108535/suppl/GSE108535_sigma70_variant_data.txt.gz",
        headers={"User-Agent": UA},
        timeout=60,
    ).content
).decode("utf-8", "replace")

expr = {}
for line in expr_text.splitlines()[1:]:
    cols = line.split("\t")
    if len(cols) >= 7:
        expr[cols[0].lower().replace("-", "_")] = float(cols[-1])

rows = []
for line in map_text.splitlines()[1:]:
    m = re.match(r"^(\S+)\s+([ATCG]+)\s+(.+)$", line.strip())
    if not m:
        continue
    name = m.group(3).lower().replace("-", "_")
    seq = m.group(2)
    flu = expr.get(name)
    if flu is None:
        continue
    if 30 <= len(seq) <= 200 and re.fullmatch(r"[ATCG]+", seq):
        rows.append((seq, flu, name))

print("urtecho joined", len(rows))

# iGEM
r = requests.get(
    "https://parts.igem.org/partsdb/download.cgi",
    headers={"User-Agent": UA},
    timeout=180,
)
print("igem", r.status_code, r.content[:4], len(r.content))
if r.content[:2] == b"\x1f\x8b":
    xml = gzip.decompress(r.content).decode("latin-1", "replace")
    print("xml len", len(xml))
    print(xml[:300])
