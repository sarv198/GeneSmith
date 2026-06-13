import gzip
import io
import re

import requests

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
r = requests.get(
    "https://parts.igem.org/partsdb/download.cgi",
    headers={"User-Agent": UA},
    timeout=300,
)
payload = r.content.lstrip(b"\n\r ")
buf = bytearray()
f = gzip.GzipFile(fileobj=io.BytesIO(payload))
try:
    while True:
        chunk = f.read(8 * 1024 * 1024)
        if not chunk:
            break
        buf.extend(chunk)
except Exception:
    pass
print("decompressed bytes", len(buf))
text = buf.decode("utf-8", "replace")
rows = re.findall(r"<row>(.*?)</row>", text, re.DOTALL)
print("rows found", len(rows))
if rows:
    fields = re.findall(
        r'<field name="([^"]+)">(.*?)</field>', rows[0], re.DOTALL
    )
    print("fields in row0", [name for name, _ in fields[:20]])

import xml.etree.ElementTree as ET

sanitized = re.sub(
    r'<field name="sequence_sha1">.*?</field>',
    '<field name="sequence_sha1"></field>',
    text,
    flags=re.DOTALL,
)
print("sanitized len", len(sanitized))
count = 0
for i, (_, elem) in enumerate(ET.iterparse(io.BytesIO(sanitized.encode("utf-8")), events=("end",))):
    if elem.tag == "row":
        count += 1
        elem.clear()
    if i > 200000:
        break
print("ET rows in first 200k events", count)
