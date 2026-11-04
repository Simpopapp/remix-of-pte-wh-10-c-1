/** Helpers puros do recorte do vocabulário (PRD projeto 16, D16-1b). */

/** Divide o recorte em [antes, token, depois] na 1ª ocorrência com fronteira lexical. */
export function snippetParts(snippet: string, token?: string): [string, string?, string?] {
  const word = (token ?? "").trim();
  if (!word || !snippet) return [snippet];
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu");
  const at = snippet.search(re);
  if (at < 0) return [snippet];
  const match = snippet.slice(at).match(re);
  if (!match) return [snippet];
  const hit = match[0] ?? "";
  const end = at + hit.length;
  return [snippet.slice(0, at), hit, snippet.slice(end)];
}
