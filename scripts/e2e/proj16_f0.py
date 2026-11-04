# E2E — Fechamento do projeto 16, Fase 6 (D16-F6a) — versão 1
#
# Verificação em browser real (Playwright/Chromium headless). Rodar com o dev
# server no ar:
#
#     python3 scripts/e2e/proj16_f0.py
#
# Fluxos (PRD §9, D16-F6a):
#
# 1. Captura com recorte — /practice com tradução por palavra ligada: clicar
#    numa palavra do glossário grava o item COM o recorte (a frase do gesto).
# 2. Vocabulário → sheet completo — /vocabulary abre a versão completa
#    (Recorte → Tradução → Fontes → Ações) com o recorte e o token destacado.
# 3. Tradução do recorte — demanda via cache IA (seed local; honesto, offline)
#    com chip "Cache IA" e NADA gravado no store (D16-C).
# 4. Áudio de estudo — 🔊 palavra + 🔊 recorte no card/sheet + sequência.
# 5. Sessão com recorte — o lado de TRÁS do cartão mostra o recorte (D16-4a).
# 6. Varredura de consistência — 11 rotas em 390×844: sem overflow horizontal,
#    console limpo, axe 0 violações (D16-5c/d).
#
# Saída: relatório JSON no stdout; qualquer falha retorna exit 1.

import asyncio
import json
import sys
from pathlib import Path

from playwright.async_api import async_playwright, Page

BASE = "http://localhost:8080"
OUT = Path("/tmp/browser/e2e-proj16")
AXE = Path("/dev-server/node_modules/axe-core/axe.min.js")
ROUTES = [
    "/",
    "/practice",
    "/session",
    "/exam",
    "/progress",
    "/vocabulary",
    "/listening",
    "/reading",
    "/speaking",
    "/writing",
    "/settings",
]

SNIPPET = "The transition from agriculture-based economies"
TRANSLATION = "A comissão conduziu um exame minucioso dos registros."

REPORT: dict[str, object] = {}
FAILURES: list[str] = []


def expect(name: str, ok: bool, detail: str = "") -> None:
    REPORT[name] = "ok" if ok else f"FALHOU: {detail}"
    if not ok:
        FAILURES.append(f"{name}: {detail}")


def fnv1a(text: str) -> str:
    h = 0x811C9DC5
    for ch in text:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return format(h, "08x")


def seed_state(word: str, literal: str, snippet: str, task_type: str) -> dict:
    """Estado semeado: tradução por palavra + captura ligadas, áudio ligado."""
    return {
        "version": 8,
        # aiTranslation off: captura estática determinística (sem rede); a
        # tradução do recorte vem do cache IA semeado — honesto e offline.
        "settings": {"plus": {"wordTranslation": True, "vocabCapture": True, "plusAudio": True, "aiTranslation": False}},
        "vocabulary": {"words": {}, "phrases": {}},
    }


def seed_cache(snippet: str, task_type: str, translation: str) -> dict:
    key = f"p:{task_type}::{fnv1a(snippet)}::{fnv1a('')}"
    return {
        "version": 3,
        "words": {},
        "phrases": {key: {"result": {"translation": translation, "tips": []}, "at": 1700000000000}},
        "grades": {},
    }


async def vocab_words(page: Page) -> dict:
    raw = await page.evaluate("() => localStorage.getItem('pte-master-hub') ?? '{}'")
    return ((json.loads(raw).get("vocabulary") or {}).get("words")) or {}


async def flow_capture(page: Page, errors: list[str], qid: str) -> tuple[str, str] | None:
    """Clica palavras até capturar um item do glossário COM recorte."""
    await page.goto(f"{BASE}/practice?q={qid}", wait_until="domcontentloaded")
    await page.wait_for_timeout(800)
    buttons = page.get_by_role("button", name="Traduzir")
    count = await buttons.count()
    expect("captura: botões de palavra visíveis", count > 0, f"count={count}")
    tried: set[str] = set()
    for i in range(min(count, 14)):
        b = buttons.nth(i)
        name = (await b.get_attribute("aria-label") or "").replace("Traduzir e ouvir ", "").replace("Traduzir ", "")
        if not name or name in tried:
            continue
        tried.add(name)
        await b.click()
        await page.wait_for_timeout(500)
        words = await vocab_words(page)
        for key, w in words.items():
            if w.get("snippet"):
                await page.keyboard.press("Escape")
                expect("captura com recorte", True)
                print(f"  palavra capturada: {key} (recorte: {w['snippet'][:60]}…)")
                return key, w["snippet"]
        if await page.get_by_role("dialog").count():
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(200)
    expect("captura com recorte", False, f"nenhuma palavra do glossário capturada em {len(tried)} tentativas")
    return None


async def flow_vocabulary(page: Page, errors: list[str], word: str, snippet: str) -> None:
    await page.goto(f"{BASE}/vocabulary", wait_until="domcontentloaded")
    await page.get_by_role("button", name=f"Ver detalhe completo de {word}").click()
    dialog = page.get_by_role("dialog")
    await dialog.get_by_text("No contexto").wait_for()
    expect("sheet: seção No contexto", True)
    expect("sheet: recorte exibido", snippet[:40] in (await dialog.inner_text()))
    expect("sheet: gesto de demanda", await dialog.get_by_text("Traduzir este recorte").count() == 1)
    # D16-2b: demanda servida pelo cache IA (seed local) — chip honesto, sem store
    await dialog.get_by_role("button", name="Traduzir este recorte").click()
    await dialog.get_by_text(TRANSLATION).wait_for()
    expect("demanda: tradução exibida", True)
    expect("demanda: chip Cache IA", await dialog.get_by_text("Cache IA").count() == 1)
    raw = page.evaluate("() => localStorage.getItem('pte-master-hub') ?? '{}'")
    saved = (await vocab_words(page)).get(word) or {}
    expect("D16-C: demanda NÃO grava no store", "snippetInContext" not in saved)
    # D16-3a: bloco de áudio do sheet
    expect("sheet: áudio palavra", await dialog.get_by_role("button", name="Ouvir palavra", exact=True).count() == 1)
    expect("sheet: áudio recorte", await dialog.get_by_role("button", name="Ouvir frase em contexto").count() == 1)
    expect("sheet: sequência", await dialog.get_by_role("button", name="Ouvir palavra e recorte").count() == 1)
    await page.keyboard.press("Escape")
    await page.wait_for_timeout(300)


async def flow_session(page: Page, errors: list[str], word: str, snippet: str) -> None:
    await page.goto(f"{BASE}/vocabulary", wait_until="domcontentloaded")
    await page.get_by_role("button", name="Revisar hoje").click()
    await page.wait_for_timeout(400)
    # frente: sem recorte
    expect("sessão: frente sem recorte", snippet[:40] not in (await page.locator("body").inner_text()))
    await page.get_by_role("button", name=word).click()
    await page.get_by_text("No contexto").wait_for()
    expect("sessão: verso com recorte", snippet[:40] in (await page.locator("body").inner_text()))
    expect("sessão: áudio pós-virada", await page.get_by_role("button", name="Ouvir frase em contexto").count() == 1)


async def flow_scan(context, errors: list[str]) -> None:
    page = await context.new_page()
    await page.set_viewport_size({"width": 390, "height": 844})
    for route in ROUTES:
        await page.goto(f"{BASE}{route}", wait_until="domcontentloaded")
        await page.wait_for_timeout(600)
        overflow = await page.evaluate(
            "document.documentElement.scrollWidth - document.documentElement.clientWidth"
        )
        expect(f"scan {route}: overflow 0", overflow <= 0, f"overflow={overflow}")
        if AXE.exists():
            await page.add_script_tag(path=str(AXE))
            res = await page.evaluate("() => axe.run({resultTypes:['violations']})")
            viols = [(v["id"], [n["target"] for n in v["nodes"]][:2]) for v in res["violations"]]
            expect(f"scan {route}: axe 0", not viols, f"{viols}")
    await page.close()


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        errors: list[str] = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        # seeds: settings + cache IA (tradução do recorte já paga — offline honesto)
        state = seed_state("exam", "exame", SNIPPET, "read_aloud")
        cache = seed_cache(SNIPPET, "read_aloud", TRANSLATION)
        await page.goto(BASE, wait_until="domcontentloaded")
        await page.evaluate(
            "(v) => { localStorage.setItem('pte-master-hub', JSON.stringify(v[0])); localStorage.setItem('pte-plus-ai-cache', JSON.stringify(v[1])); }",
            [state, cache],
        )

        # questões read_aloud do catálogo local
        data = json.loads(Path("/dev-server/src/data/pte/read_aloud.json").read_text())
        qids = [q["id"] for q in data.get("questions", [])][:12]

        captured = None
        for qid in qids:
            REPORT.clear()  # mantém apenas a última tentativa de captura legível
            FAILURES[:] = [f for f in FAILURES if not f.startswith("captura")]
            captured = await flow_capture(page, errors, qid)
            if captured:
                REPORT["captura_questao"] = qid
                break
        if captured:
            word, snippet = captured
            # cache IA semeado para o recorte REAL capturado (chave = tipo + frase)
            words_now = await vocab_words(page)
            src_type = ((words_now[word].get("sources") or [{}])[-1].get("type")) or "read_aloud"
            cache = seed_cache(snippet, src_type, TRANSLATION)
            await page.evaluate(
                "c => localStorage.setItem('pte-plus-ai-cache', JSON.stringify(c))", cache
            )
            await flow_vocabulary(page, errors, word, snippet)
            await flow_session(page, errors, word, snippet)
        await flow_scan(context, errors)

        real_errors = [e for e in errors if "ERR_FAILED" not in e]
        expect("console limpo", not real_errors, "; ".join(real_errors[:3]))
        await page.screenshot(path=str(OUT / "final.png"))
        await browser.close()

    print(json.dumps(REPORT, indent=1, ensure_ascii=False))
    if FAILURES:
        print("FALHAS:", "; ".join(FAILURES), file=sys.stderr)
        sys.exit(1)


asyncio.run(main())
