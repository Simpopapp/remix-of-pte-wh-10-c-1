// Fase 5 (projeto 13, PRD §4.5): precache gerado pelo build.
// Roda após `vite build` e escreve dist/client/sw-assets.json com TODOS os
// assets emitidos (chunks de rotas, motores e dependências + arquivos públicos).
// O service worker lê esse manifesto na instalação — o precache nunca diverge
// do artefato publicado (nada de lista manual).
//
// D15-5a: identidade por build — o sw.js de SAÍDA recebe a versão derivada do
// manifesto + do próprio código (sw-version.mjs); builds diferentes têm
// cache-names diferentes, então o activate apaga caches antigos em toda
// publicação (deploy novo nunca serve shell velho).
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { applySwVersion, swVersionFrom } from "./sw-version.mjs";

const CLIENT_DIR = "dist/client";
const EXCLUDE = new Set(["sw.js", "sw-assets.json", "_headers", "_routes.json"]);

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(CLIENT_DIR).filter((f) => {
  const rel = relative(CLIENT_DIR, f);
  return !EXCLUDE.has(rel) && !rel.includes(`${sep}_headers`);
});

if (files.length === 0) {
  console.error("gen-sw-assets: dist/client vazio ou ausente — rode `vite build` antes.");
  process.exit(1);
}

const assets = files.map((f) => "/" + relative(CLIENT_DIR, f).split(sep).join("/")).sort();

// D15-5a: versão do SW derivada do build (manifesto + código do SW) e gravada
// no sw.js de SAÍDA — o arquivo-fonte fica sem literal fixo.
const swSourcePath = join(CLIENT_DIR, "sw.js");
let swSource;
try {
  swSource = readFileSync(swSourcePath, "utf8");
} catch {
  console.error("gen-sw-assets: dist/client/sw.js ausente — rode `vite build` antes.");
  process.exit(1);
}
const version = swVersionFrom(assets, swSource);
writeFileSync(swSourcePath, applySwVersion(swSource, version));

writeFileSync(join(CLIENT_DIR, "sw-assets.json"), JSON.stringify(assets));

const total = files.reduce((n, f) => n + statSync(f).size, 0);
console.log(
  `gen-sw-assets: ${assets.length} assets no precache (${(total / 1024).toFixed(0)} kB) · sw ${version} → dist/client/sw-assets.json`,
);
