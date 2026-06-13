import gzip
import io
import xml.etree.ElementTree as ET

import requests

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
r = requests.get(
    "https://parts.igem.org/partsdb/download.cgi",
    headers={"User-Agent": UA},
    timeout=300,
)
xml = gzip.GzipFile(fileobj=io.BytesIO(r.content.lstrip(b"\n\r "))).read()
idx = xml.find(b'<table_data name="parts">')
print("idx", idx)
end = xml.find(b"</table_data>", idx)
chunk = xml[idx : end + len(b"</table_data>")]
root = ET.fromstring(chunk)
rows = root.findall("row")
print("rows in chunk sample", len(rows))
for row in rows[:2]:
    print("---row---")
    for field in row.findall("field"):
        print(field.attrib, (field.text or "")[:80])
