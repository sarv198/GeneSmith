/** Strip HTML entities/tags from iGEM-style descriptions. */
export function stripDescription(html = "") {
  return String(html)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractOrganism(description, source = "") {
  const text = stripDescription(description);
  const match = text.match(
    /(?:in|from|for)\s+([A-Z][a-z]+(?:\.\s+[a-z]+)?(?:\s+and\s+[A-Z][a-z]+(?:\.\s+[a-z]+)?)?)/i,
  );
  if (match) return match[1].replace(/\s+and\s+/g, ", ");
  if (source && source !== "igem") return source;
  return "Escherichia coli";
}

export function extractTrait(description) {
  const text = stripDescription(description);
  if (!text) return "Synthetic biology part";
  const sentence = text.split(/[.—]/)[0]?.trim() || text;
  return sentence.length > 72 ? `${sentence.slice(0, 69)}…` : sentence;
}
