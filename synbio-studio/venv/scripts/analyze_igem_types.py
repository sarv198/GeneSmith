import re
from collections import Counter
from pathlib import Path

text = Path("backend/data/igem_parts_raw.xml").read_bytes().decode("utf-8", "replace")
ROW_RE = re.compile(r"<row>(.*?)</row>", re.DOTALL)
FIELD_RE = re.compile(r'<field name="([^"]+)">(.*?)</field>', re.DOTALL)

types = Counter()
statuses = Counter()
with_seq = Counter()
no_status_pass = Counter()

for block in ROW_RE.findall(text):
    fields = {name.lower(): value.strip() for name, value in FIELD_RE.findall(block)}
    part_type = fields.get("part_type", "").lower()
    types[part_type] += 1
    status = fields.get("part_status", fields.get("status", "")).lower()
    statuses[status] += 1
    sequence = fields.get("dna", fields.get("sequence", "")).upper().replace(" ", "")
    if part_type in {"promoter", "rbs", "cds", "terminator"}:
        if sequence and re.fullmatch(r"[ATCG]+", sequence):
            with_seq[part_type] += 1
        if status in {"", "available", "released"}:
            no_status_pass[part_type] += 1

print("types top 25:", types.most_common(25))
print("statuses:", statuses.most_common(15))
print("valid ATCG seq by type:", dict(with_seq))
print("status-pass by type:", dict(no_status_pass))
