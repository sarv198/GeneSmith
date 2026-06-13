import re
from collections import Counter
from pathlib import Path

text = Path("backend/data/igem_parts_raw.xml").read_bytes().decode("utf-8", "replace")
ROW_RE = re.compile(r"<row>(.*?)</row>", re.DOTALL)
FIELD_RE = re.compile(r'<field name="([^"]+)">(.*?)</field>', re.DOTALL)

cats = Counter()
reg_with_seq = 0
coding_with_seq = 0

for block in ROW_RE.findall(text):
    fields = {name.lower(): value.strip() for name, value in FIELD_RE.findall(block)}
    part_type = fields.get("part_type", "").lower()
    sequence = fields.get("dna", fields.get("sequence", "")).upper().replace(" ", "")
    if not sequence or not re.fullmatch(r"[ATCG]+", sequence):
        continue
    categories = fields.get("categories", "").lower()
    if part_type == "regulatory":
        reg_with_seq += 1
        if "promoter" in categories:
            cats["regulatory+promoter_cat"] += 1
        elif "rbs" in categories:
            cats["regulatory+rbs_cat"] += 1
        else:
            cats["regulatory+other"] += 1
    if part_type == "coding":
        coding_with_seq += 1

print("regulatory with seq", reg_with_seq)
print("coding with seq", coding_with_seq)
print("category breakdown", cats.most_common(10))
