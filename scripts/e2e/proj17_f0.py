# E2E — Fechamento do projeto 17, Fase 6 (D17-F6a) — versão 1
#
# Verificação em browser real (Playwright/Chromium headless). Rodar com o dev
# server no ar:
#
#     python3 scripts/e2e/proj17_f0.py
#
# Varredura de consistência (PRD §8.8, D17-F6a):
#
# 1. 11 rotas em 390×844: overflow horizontal 0, console limpo,
#    axe 0 violações.
# 2. Alvos de toque: todo `button`/`a` visível nas 11 rotas tem bounding box
#    ≥ 44×44 — exceção: link de texto corrido (âncora display:inline).
# 3. Sobreposição footer×TabBar = 0px no runner (/practice?q=<read_aloud>).
# 4. Screenshots light+dark de 5 rotas-chave.
# 5. Estados honestos: vazio (vocabulário sem itens), carregando (skeleton do
#    runner na 1ª carga do motor) e concluído (/session?done=1 → resumo).
#
# Saída: relatório JSON no stdout; qualquer falha retorna exit 1.

import asyncio
import json
import re
import sys
from pathlib import Path

from playwright.async_api import async_playwright, Page

BASE = "http://localhost:8080"
OUT = Path("/tmp/browser/e2e-proj17")
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
KEY_ROUTES = ["/", "/practice", "/session", "/vocabulary", "/progress"]
THEME_KEY = "ptehub:theme"
STORE_KEY = "pte-master-hub"

REPORT: dict[str, object] = {}
FAILURES: list[str] = []


def expect(name: str, ok: bool, detail: str = "") -> None:
    REPORT[name] = "ok" if ok else f"FALHOU: {detail}"
    if not ok:
        FAILURES.append(f"{name}: {detail}")


def qid_of(path: str) -> str:
    data = json.loads(Path(path).read_text())
    return data["questions"][0]["id"]


TARGET_CHECK = """
() => {
  const bad = [];
  for (const el of document.querySelectorAll('button, a')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const skipLink = el.tagName === 'A' && /^Pular/i.test((el.textContent || '').trim());
    if (skipLink) continue; // alvo de teclado oculto (sr-only), não é toque
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const inlineTextLink = el.tagName === 'A' && cs.display.startsWith('inline');
    if (inlineTextLink) continue;
    if (r.width < 44 || r.height < 44) {
      bad.push(`${el.tagName}:${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }
  return bad;
}
"""

OVERFLOW_CHECK = "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"


async def scan_route(page: Page, route: str, with_axe: bool) -> None:
    await page.goto(f"{BASE}{route}", wait_until="domcontentloaded")
    await page.wait_for_timeout(700)
    overflow = await page.evaluate(OVERFLOW_CHECK)
    expect(f"scan {route}: overflow 0", overflow <= 0, f"overflow={overflow}")
    bad = await page.evaluate(TARGET_CHECK)
    expect(f"scan {route}: alvos >=44px", not bad, "; ".join(bad[:4]))
    if with_axe and AXE.exists():
        await page.add_script_tag(path=str(AXE))
        res = await page.evaluate("() => axe.run({ resultTypes: ['violations'] })")
        viols = [(v["id"], [n["target"] for n in v["nodes"]][:2]) for v in res["violations"]]
        expect(f"scan {route}: axe 0", not viols, f"{viols}")


async def flow_footer_tabbar(page: Page, qid: str) -> None:
    """Runner da prática: footer ancorado na TabBar sem sobreposição (D17-8)."""
    await page.goto(f"{BASE}/practice?q={qid}", wait_until="domcontentloaded")
    await page.wait_for_timeout(900)
    overlap = await page.evaluate(
        """() => {
          const tabbar = document.querySelector('nav[aria-label="Navegação principal"]');
          const footer = document.querySelector('footer');
          if (!tabbar || !footer) return null;
          const a = tabbar.getBoundingClientRect();
          const b = footer.getBoundingClientRect();
          const top = Math.max(a.top, b.top);
          const bottom = Math.min(a.bottom, b.bottom);
          return Math.max(0, bottom - top);
        }"""
    )
    expect("footer x TabBar = 0px", overlap == 0, f"interseção={overlap}")
    expect("runner: footer e TabBar presentes", overlap is not None, "footer ou TabBar ausentes")


def seed_state(draft: dict) -> dict:
    """AppState v8 mínimo com um draft de sessão concluída (resumo do done)."""
    return {"version": 8, "draft": draft, "vocabulary": {"words": {}, "phrases": {}}}


def done_draft(qids: list[str]) -> dict:
    return {
        "kind": "srs",
        "label": "Sessão",
        "queue": qids,
        "index": len(qids),
        "startedAt": 1700000000000,
        "results": [{"qid": q, "score": 82} for q in qids],
        "skips": 0,
    }


async def flow_states(page: Page, qids: list[str], errors: list[str]) -> None:
    # --- concluído: draft de sessão concluída + /session?done=1 → resumo ---
    await page.goto(BASE, wait_until="domcontentloaded")
    await page.evaluate(
        "v => localStorage.setItem('pte-master-hub', JSON.stringify(v))",
        seed_state(done_draft(qids)),
    )
    await page.goto(f"{BASE}/session?done=1", wait_until="domcontentloaded")
    await page.locator('[aria-label="Resumo da sessão"]').first.wait_for(timeout=8000)
    expect("estado concluído: resumo visível", True)
    await page.screenshot(path=str(OUT / "estado-concluido.png"))

    # --- vazio: store zerado → vocabulário no estado vazio ---
    await page.evaluate(f"localStorage.removeItem('{STORE_KEY}')")
    await page.goto(f"{BASE}/vocabulary", wait_until="domcontentloaded")
    await page.get_by_text("Seu vocabulário começa quando você traduz").wait_for(timeout=8000)
    expect("estado vazio: vocabulário", True)
    await page.screenshot(path=str(OUT / "estado-vazio.png"))

    # --- carregando: 1ª carga do chunk do motor mostra o skeleton ---
    seen = False
    pattern = "Carregando questão"

    async def slow_chunk(route):
        print(f"  chunk atrasado: {route.request.url}")
        await asyncio.sleep(1.2)
        try:
            await route.continue_()
        except Exception:
            pass  # unroute durante o atraso: a rota já foi resolvida

    chunk_re = re.compile(r"data/pte/read_aloud\.json")
    await page.goto(f"{BASE}/practice", wait_until="domcontentloaded")
    await page.wait_for_timeout(600)
    await page.route(chunk_re, slow_chunk)
    # navegação client-side: o loader da rota espera o módulo atrasado →
    # pendingComponent (SkeletonPage) entra em cena — estado de carregamento real
    await page.locator('a[href*="q="]').first.click()
    for _ in range(60):
        body = await page.locator("body").inner_text()
        if pattern in body:
            seen = True
            break
        await page.wait_for_timeout(50)
    await page.unroute(chunk_re)
    expect("estado carregando: skeleton do runner", seen, "skeleton não capturado")
    if seen:
        await page.screenshot(path=str(OUT / "estado-carregando.png"))

    # restaura store vazio honesto para o resto da varredura
    await page.evaluate(f"localStorage.removeItem('{STORE_KEY}')")


async def flow_screenshots(context, errors: list[str]) -> None:
    """5 rotas-chave em light + dark (PRD §10, fases 0/3/6)."""
    page = await context.new_page()
    await page.set_viewport_size({"width": 390, "height": 844})
    for mode in ("light", "dark"):
        await page.goto(BASE, wait_until="domcontentloaded")
        await page.evaluate(f"localStorage.setItem('{THEME_KEY}', '{mode}')")
        for route in KEY_ROUTES:
            await page.goto(f"{BASE}{route}", wait_until="domcontentloaded")
            await page.wait_for_timeout(600)
            await page.screenshot(path=str(OUT / f"{mode}{route.replace('/', '-') or '-home'}.png"))
        await page.evaluate(f"localStorage.setItem('{THEME_KEY}', 'light')")
    await page.close()


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 390, "height": 844})
        page = await context.new_page()
        errors: list[str] = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        await page.goto(BASE, wait_until="domcontentloaded")
        await page.evaluate(f"localStorage.removeItem('{STORE_KEY}')")

        ra_qid = qid_of("/dev-server/src/data/pte/read_aloud.json")
        fib_qid = qid_of("/dev-server/src/data/pte/lst_fib.json")
        qids = [ra_qid, fib_qid]

        await flow_states(page, qids, errors)
        await flow_footer_tabbar(page, ra_qid)
        for route in ROUTES:
            await scan_route(page, route, with_axe=True)
        await flow_screenshots(context, errors)

        real_errors = [e for e in errors if "ERR_FAILED" not in e]
        expect("console limpo", not real_errors, "; ".join(real_errors[:3]))
        await page.screenshot(path=str(OUT / "final.png"))
        await browser.close()

    REPORT["rotas_varridas"] = len(ROUTES)
    REPORT["viewport"] = "390x844"
    print(json.dumps(REPORT, indent=1, ensure_ascii=False))
    if FAILURES:
        print("FALHAS:", "; ".join(FAILURES), file=sys.stderr)
        sys.exit(1)


asyncio.run(main())
