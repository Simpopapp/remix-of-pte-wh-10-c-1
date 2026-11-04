// D15-5a: identidade do service worker POR BUILD.
// A versão/cache-name do sw.js é derivada do conteúdo do precache (manifesto de
// assets) + do próprio código do SW — builds diferentes produzem cache-names
// diferentes, então o activate apaga caches antigos em toda publicação.
// O arquivo-fonte `public/sw.js` mantém o placeholder `__SW_VERSION__`; este
// módulo é importado tanto pelo build (gen-sw-assets.mjs) quanto pelos testes.

/** FNV-1a de 32 bits — hash estável, sem dependências. */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // >>> 0 garante unsigned (determinístico entre engines).
  return h >>> 0;
}

/**
 * Versão do SW a partir da lista de assets (ordem-insensível) e do código do SW.
 * Assets iguais + código igual → mesma versão (instalação idempotente).
 */
export function swVersionFrom(assets, swSource = "") {
  const normalized = [...assets].sort().join("\n");
  const hash = fnv1a(`${normalized}\u0000${swSource}`);
  return `b${hash.toString(36)}`;
}

/** Substitui o placeholder de versão no código do sw.js. */
export function applySwVersion(swSource, version) {
  if (!swSource.includes("__SW_VERSION__")) {
    throw new Error("gen-sw-assets: placeholder __SW_VERSION__ ausente em public/sw.js");
  }
  return swSource.replace("__SW_VERSION__", version);
}
