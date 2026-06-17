"""Fetch filtered iGEM parts registry for Task C (trait recommendation)."""

from __future__ import annotations

import gzip
import io
import re
from pathlib import Path

import pandas as pd
import requests

PRIMARY_URL = "https://parts.igem.org/partsdb/download.cgi"
FALLBACK_URL = "https://parts.igem.org/xml/parts.xml"
RAW_XML_PATH = Path("backend/data/igem_parts_raw.xml")
RAW_GZIP_PATH = Path("backend/data/igem_parts_raw.xml.gz")
OUTPUT_PATH = Path("backend/data/igem_parts_full.csv")
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

ALLOWED_TYPES = {"promoter", "rbs", "cds", "terminator"}
ALLOWED_STATUS = {"available", "released", ""}
CAPS = {"promoter": 500, "rbs": 300, "cds": 500, "terminator": 200}
MIN_DECOMPRESSED_BYTES = 50_000_000
FIELD_RE = re.compile(r'<field name="([^"]+)">(.*?)</field>', re.DOTALL)
ROW_RE = re.compile(r"<row>(.*?)</row>", re.DOTALL)


def _decompress_gzip_payload(payload: bytes) -> bytes:
    """Decompress first gzip member; iGEM dump may confuse gzip.open on trailing bytes."""
    data = payload.lstrip(b"\n\r ")
    if data[:2] != b"\x1f\x8b":
        return data

    buf = bytearray()
    handle = gzip.GzipFile(fileobj=io.BytesIO(data))
    try:
        while True:
            chunk = handle.read(8 * 1024 * 1024)
            if not chunk:
                break
            buf.extend(chunk)
    except gzip.BadGzipFile:
        pass
    if len(buf) < MIN_DECOMPRESSED_BYTES:
        raise gzip.BadGzipFile("decompressed payload too small")
    return bytes(buf)


def _download_gzip() -> bytes:
    errors: list[str] = []
    for url in (PRIMARY_URL, FALLBACK_URL):
        for attempt in range(3):
            try:
                response = requests.get(
                    url, headers={"User-Agent": USER_AGENT}, timeout=300
                )
                response.raise_for_status()
                content = response.content.lstrip(b"\n\r ")
                if content[:1] == b"<" and b"mysqldump" in content[:5000]:
                    return content
                if content[:2] == b"\x1f\x8b" and len(content) > 1_000_000:
                    RAW_GZIP_PATH.parent.mkdir(parents=True, exist_ok=True)
                    RAW_GZIP_PATH.write_bytes(content)
                    return _decompress_gzip_payload(content)
                errors.append(
                    f"{url}: unexpected content ({len(content)} bytes, attempt {attempt + 1})"
                )
            except requests.RequestException as exc:
                errors.append(f"{url}: {exc} (attempt {attempt + 1})")
            except (gzip.BadGzipFile, OSError) as exc:
                errors.append(f"{url}: gzip error {exc} (attempt {attempt + 1})")
    raise SystemExit(
        "Failed to download iGEM parts XML. " + "; ".join(errors)
    )


def _load_xml() -> bytes:
    if RAW_XML_PATH.exists() and RAW_XML_PATH.stat().st_size >= MIN_DECOMPRESSED_BYTES:
        print(f"Using cached XML at {RAW_XML_PATH}")
        return RAW_XML_PATH.read_bytes()

    if RAW_GZIP_PATH.exists():
        try:
            xml_bytes = _decompress_gzip_payload(RAW_GZIP_PATH.read_bytes())
            if len(xml_bytes) >= MIN_DECOMPRESSED_BYTES:
                print(f"Decompressed cached gzip at {RAW_GZIP_PATH}")
                return xml_bytes
        except (gzip.BadGzipFile, OSError):
            print(f"WARNING: cached gzip at {RAW_GZIP_PATH} is invalid, re-downloading")

    print("Downloading iGEM parts database...")
    return _download_gzip()


def _normalize_part_type(fields: dict[str, str]) -> str:
    part_type = fields.get("part_type", "").lower()
    categories = fields.get("categories", "").lower()
    if part_type in ALLOWED_TYPES:
        return part_type
    if part_type == "regulatory" and "promoter" in categories:
        return "promoter"
    if part_type == "coding":
        return "cds"
    return ""


def _status_ok(status: str) -> bool:
    if not status or status in ALLOWED_STATUS:
        return True
    return "released" in status or "available" in status


def _parse_row_block(row_block: str) -> dict[str, str] | None:
    fields = {
        name.lower(): value.strip()
        for name, value in FIELD_RE.findall(row_block)
    }

    part_type = _normalize_part_type(fields)
    sequence = fields.get("dna", fields.get("sequence", "")).upper().replace(" ", "")
    part_id = fields.get("part_name", fields.get("part_id", ""))
    description = fields.get("short_desc", fields.get("description", ""))
    status = fields.get("status", fields.get("part_status", "")).lower()

    if part_type not in ALLOWED_TYPES:
        return None
    if not sequence or not re.fullmatch(r"[ATCG]+", sequence):
        return None
    if not (description or part_id):
        return None
    if not _status_ok(status):
        return None

    return {
        "part_id": part_id,
        "part_type": part_type,
        "name": part_id,
        "sequence": sequence,
        "description": description or part_id,
        "source": "igem",
    }


def _parse_parts(xml_bytes: bytes) -> pd.DataFrame:
    # mysqldump XML embeds binary hashes; regex row parsing avoids invalid tokens.
    text = xml_bytes.decode("utf-8", "replace")
    rows: list[dict[str, str]] = []
    for row_block in ROW_RE.findall(text):
        parsed = _parse_row_block(row_block)
        if parsed:
            rows.append(parsed)
    return pd.DataFrame(rows)


def _apply_caps(df: pd.DataFrame) -> pd.DataFrame:
    capped: list[pd.DataFrame] = []
    for part_type, limit in CAPS.items():
        subset = df[df["part_type"] == part_type].copy()
        if len(subset) > limit:
            subset["desc_len"] = subset["description"].str.len()
            subset = subset.sort_values("desc_len", ascending=False).head(limit)
            subset = subset.drop(columns=["desc_len"])
        capped.append(subset)
    return pd.concat(capped, ignore_index=True) if capped else df


def main() -> None:
    xml_bytes = _load_xml()
    RAW_XML_PATH.parent.mkdir(parents=True, exist_ok=True)
    RAW_XML_PATH.write_bytes(xml_bytes)
    print(f"Saved raw XML to {RAW_XML_PATH} ({len(xml_bytes)} bytes)")

    df = _parse_parts(xml_bytes)
    filtered = _apply_caps(df)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    filtered.to_csv(OUTPUT_PATH, index=False)

    print("Count per part_type:")
    for part_type, count in filtered["part_type"].value_counts().items():
        print(f"  {part_type}: {count}")
    print(f"Total rows saved: {len(filtered)} -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
