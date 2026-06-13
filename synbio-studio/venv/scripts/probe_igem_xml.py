import gzip
import io
import requests
import xml.etree.ElementTree as ET

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
r = requests.get("https://parts.igem.org/partsdb/download.cgi", headers={"User-Agent": UA}, timeout=300)
payload = r.content.lstrip(b"\n\r ")
f = gzip.GzipFile(fileobj=io.BytesIO(payload))
raw = f.read(500000).decode("latin-1", "replace")
print(raw[:800])
for tag in ["part", "Part", "part_list", "rs:part", "part_record"]:
    print(tag, raw.lower().count(f"<{tag}"))

stream = gzip.GzipFile(fileobj=io.BytesIO(payload))
tags = {}
for i, (_, elem) in enumerate(ET.iterparse(stream, events=("end",))):
    t = elem.tag.split("}")[-1]
    tags[t] = tags.get(t, 0) + 1
    if i > 50000:
        break
print("top tags", sorted(tags.items(), key=lambda x: -x[1])[:25])
