# E2E — Projeto 18, onda 2 (F2 next-action v2 · F3 prontidão honesta · F4 revisão fiel)
# Projeto 18 · onda 2 (F2/F3/F4) — rodar contra o dev server: python3 scripts/e2e/proj18_f24.py
# Fluxos: progress (prontidão honesta) · exam (revisar último simulado + blueprint)
# · read_fib_bank em prática · varredura 390×844 + axe nas rotas tocadas.

import asyncio
import json
import sys
from pathlib import Path

from playwright.async_api import async_playwright, Page

BASE = "http://localhost:8080"
OUT = Path("/tmp/browser/proj18-f24")
AXE = Path("/dev-server/node_modules/axe-core/axe.min.js")
BANK_DATA = json.loads(Path("/dev-server/src/data/pte/read_fib_bank.json").read_text())
ESSAY_DATA = json.loads(Path("/dev-server/src/data/pte/write_essay.json").read_text())
BANK_QS = BANK_DATA if isinstance(BANK_DATA, list) else BANK_DATA.get("questions", [])
ESSAY_QS = ESSAY_DATA if isinstance(ESSAY_DATA, list) else ESSAY_DATA.get("questions", [])

REPORT: dict[str, object] = {}
FAILURES: list[str] = []


def expect(name: str, ok: bool, detail: str = "") -> None:
    REPORT[name] = "ok" if ok else f"FALHOU: {detail}"
    if not ok:
        FAILURES.append(f"{name}: {detail}")


async def scan_route(context, errors: list[str], route: str) -> None:
    page = await context.new_page()
    await page.set_viewport_size({"width": 390, "height": 844})
    await page.goto(f"{BASE}{route}", wait_until="domcontentloaded")
    await page.wait_for_timeout(700)
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


async def seed_review_record(page: Page) -> None:
    """Semeia um simulado concluído COM causa/resposta (formato novo)."""
    essay = ESSAY_QS[0]
    bank = BANK_QS[0]
    await page.goto(BASE, wait_until="domcontentloaded")
    await page.evaluate(
        """(qids) => {
          const raw = JSON.parse(localStorage.getItem('pte-master-hub') ?? '{}');
          raw.version = 8; raw.sessions = [{
            id: 's-review-test',
            startedAt: 1700000000000,
            finishedAt: 1700000300000,
            kind: 'exam',
            label: 'Simulado completo',
            results: [
              { qid: qids[0], score: 62, wpm: null, cause: 'graded',
                answer: 'X'.repeat(1200) },
              { qid: qids[1], score: null, wpm: null, cause: 'skipped' },
            ],
          }];
          localStorage.setItem('pte-master-hub', JSON.stringify(raw));
        }""",
        [essay["id"], bank["id"]],
    )


async def flow_review(page: Page, errors: list[str]) -> None:
    await seed_review_record(page)
    await page.goto(f"{BASE}/exam", wait_until="domcontentloaded")
    await page.wait_for_timeout(700)
    body = await page.locator("body").inner_text()
    expect("revisão: cartão na escolha", "Revisar último simulado" in body, body[:200])
    await page.get_by_role("button", name="Abrir revisão").click()
    await page.wait_for_timeout(1200)
    body = await page.locator("body").inner_text()
    expect("revisão: resumo reconstruído", "Resumo do simulado" in body)
    expect("revisão: respostas enviadas", "Respostas enviadas" in body)
    expect("revisão: resposta integral persistida", "XXXXXXX" in body)
    await page.screenshot(path=str(OUT / "review.png"))


async def flow_bank_practice(page: Page, errors: list[str], qid: str) -> None:
    await page.goto(f"{BASE}/practice?q={qid}", wait_until="domcontentloaded")
    await page.wait_for_timeout(900)
    bank = page.get_by_role("region", name="Banco de palavras")
    chips = bank.get_by_role("button")
    first = chips.first
    word = (await first.inner_text()).strip()
    await first.click()
    gap = page.get_by_role("button", name="Lacuna 1, vazia")
    await gap.click()
    filled = await page.get_by_role("button", name=f"Lacuna 1, com a palavra {word}").count()
    expect("bank: atribuição por toque", filled == 1, f"word={word}")
    # preenche as lacunas restantes antes de corrigir
    gaps = page.get_by_role("button", name=r"Lacuna \d+, vazia")
    while True:
        remaining = bank.get_by_role("button")
        if await remaining.count() == 0:
            break
        await remaining.first.click()
        empty = page.get_by_role("button", name=r"Lacuna \d+, vazia")
        if await empty.count() == 0:
            break
        await empty.first.click()
    await page.get_by_role("button", name="Corrigir").click()
    await page.wait_for_timeout(600)
    body = await page.locator("body").inner_text()
    expect("bank: gabarito no resultado", "gabarito" in body.lower() and "lacunas corretas" in body)
    await page.screenshot(path=str(OUT / "bank.png"))


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        errors: list[str] = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        bank_qid = BANK_QS[0]["id"]

        # F3: prontidão honesta visível em /progress
        await page.goto(f"{BASE}/progress", wait_until="networkidle")
        await page.wait_for_timeout(1500)
        await page.get_by_text("Como interpretar o índice").click()
        await page.wait_for_timeout(400)
        body = await page.locator("body").inner_text()
        expect("F3: explicador da prontidão", "itens inéditos" in body)
        await page.screenshot(path=str(OUT / "progress.png"))

        # F4: escolha do simulado menciona o novo tipo no blueprint
        await page.goto(f"{BASE}/exam", wait_until="domcontentloaded")
        await page.wait_for_timeout(700)
        body = await page.locator("body").inner_text()
        expect("F4: blueprint no texto da escolha", "banco de palavras" in body)

        # F4: revisão reconstruída do registro persistido
        await flow_review(page, errors)

        # D18-6/D18-4: read_fib_bank em prática
        await flow_bank_practice(page, errors, bank_qid)

        # Varredura 390×844 + axe nas rotas tocadas
        for route in ["/", "/progress", "/exam", f"/practice?q={bank_qid}"]:
            await scan_route(context, errors, route)

        real_errors = [e for e in errors if "ERR_FAILED" not in e]
        expect("console limpo", not real_errors, "; ".join(real_errors[:3]))
        await page.screenshot(path=str(OUT / "final.png"))
        await browser.close()

    print(json.dumps(REPORT, indent=1, ensure_ascii=False))
    if FAILURES:
        print("FALHAS:", "; ".join(FAILURES), file=sys.stderr)
        sys.exit(1)


asyncio.run(main())
