import gzip
import io
import re
import requests

UA = "Mozilla/5.0"

counts = gzip.GzipFile(
    fileobj=io.BytesIO(
        requests.get(
            "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE108nnn/GSE108535/suppl/GSE108535_barcode_counts_normalized.txt.gz",
            headers={"User-Agent": UA},
            timeout=300,
        ).content
    )
)
header = counts.readline().decode().strip()
print("counts header:", header[:200])
for i in range(3):
    print(counts.readline().decode()[:200])

counts.close()

map_f = gzip.GzipFile(
    fileobj=io.BytesIO(
        requests.get(
            "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE108nnn/GSE108535/suppl/GSE108535_barcode_mapping.txt.gz",
            headers={"User-Agent": UA},
            timeout=120,
        ).content
    )
)
print("map header:", map_f.readline().decode().strip())
barcode_to_seq = {}
for _ in range(50000):
    line = map_f.readline().decode()
    if not line:
        break
    m = re.match(r"^(\S+)\s+([ATCG]+)\s+(.+)$", line.strip())
    if m:
        barcode_to_seq[m.group(1)] = m.group(2)
print("barcodes mapped", len(barcode_to_seq))
