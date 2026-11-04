# E2E — Fechamento AAA do projeto 15, Fase 7 (D15-7a) — versão 1
#
# Verificação em browser real (Playwright/Chromium headless). Rodar com o dev
# server no ar:
#
#     python3 scripts/e2e/proj15_f7.py
#
# Fluxos (PRD §F7 / roadmap D15-7a):
#
# 1. Recomendação por lapso (D15-2a) — backup com piora recente (90 → 50) no
#    Read Aloud e fraqueza flat no WFD: o "Próximo passo" em /progress aponta o
#    TIPO com lapso ("piora recente de 40 pts"), não o best histórico pior, e o
#    botão "Começar" abre a prática da questão com pior ÚLTIMA nota.
# 2. Ciclo erro → correção → retry → transferência (D15-1b/1c) — backup com
#    tentativa WFD reprovada: /session habilita "Revisar erros (1)"; a sessão
#    abre com banner "Sessão · 1 de 2" (a 2ª é a questão NUNCA vista do mesmo
#    tipo — verificação de transferência); resposta errada reprova, "Tentar de
#    novo" com a resposta correta aprova; "Próxima da sessão" leva à questão de
#    transferência (qid diferente do erro).
# 3. Undo de exclusão de vocabulário (D15-4c) — backup com 1 palavra: remover
#    com confirmação cria o toast com "Desfazer"; clicar em Desfazer restaura
#    o item na lista.
# 4. Varredura de consistência final — 11 rotas em 390×844: sem overflow
#    horizontal, console limpo, axe 0 violações (D15-7b).
#
# Saída: relatório JSON no stdout; qualquer falha retorna exit 1.

import asyncio
import json
import re
import sys
import time
from pathlib import Path

from playwright.async_api import async_playwright, Page

BASE = "http://localhost:8080"
OUT = Path("/tmp/browser/e2e-f7")
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

REPORT: dict[str, object] = {}
FAILURES: list[str] = []


def expect(name: str, ok: bool, detail: str = "") -> None:
    REPORT[name] = "ok" if ok else f"FALHOU: {detail}"
    if not ok:
        FAILURES.append(f"{name}: {detail}")


WFD_QID = "pte-wfd-d03e133f"
WFD_ANSWER = "A balanced diet and regular exercise are necessary for good health."
RA_QID = "pte-ra-01ef7205"

NOW = None  # preenchido em backup_payloads()


def backup_payloads() -> dict[str, bytes]:
    now = int(time.time() * 1000)
    day = 86_400_000

    # F2 — lapso recente no Read Aloud (90 → 50) vs. fraqueza flat no WFD (40).
    # need(ra) = (40 fraqueza + 2·40 lapso) · recência ≫ need(wfd) = 50 · recência:
    # o tipo com LAPSE vence mesmo tendo best histórico melhor que o do WFD.
    lapse = {
        "app": "pte-master-hub",
        "version": 7,
        "exportedAt": "2026-11-03T00:00:00.000Z",
        "attempts": [
            {
                "qid": RA_QID,
                "ts": now - 2 * day,
                "taskType": "read_aloud",
                "mode": "manual",
                "contentScore": 90,
                "score": 90,
                "wpm": None,
                "durationMs": 1000,
            },
            {
                "qid": RA_QID,
                "ts": now - 1 * day,
                "taskType": "read_aloud",
                "mode": "manual",
                "contentScore": 50,
                "score": 50,
                "wpm": None,
                "durationMs": 1000,
            },
            {
                "qid": WFD_QID,
                "ts": now - 3 * 60_000,
                "taskType": "wfd",
                "mode": "manual",
                "contentScore": 40,
                "score": 40,
                "wpm": None,
                "durationMs": 1000,
            },
        ],
        "bookmarks": [],
    }

    # F1 — erro recente no WFD (30 < limiar 70): habilita a fila de correção.
    corr = {
        "app": "pte-master-hub",
        "version": 7,
        "exportedAt": "2026-11-03T00:00:00.000Z",
        "attempts": [
            {
                "qid": WFD_QID,
                "ts": now - 30 * 60_000,
                "taskType": "wfd",
                "mode": "manual",
                "contentScore": 30,
                "score": 30,
                "wpm": None,
                "durationMs": 1000,
            }
        ],
        "bookmarks": [],
    }

    # F4 — 1 palavra de vocabulário para o fluxo remover → Desfazer.
    vocab = {
        "app": "pte-master-hub",
        "version": 7,
        "exportedAt": "2026-11-03T00:00:00.000Z",
        "attempts": [],
        "bookmarks": [],
        "vocabulary": {
            "words": {
                "serenity": {
                    "word": "serenity",
                    "literal": "serenidade",
                    "contextual": "estado de calma e tranquilidade",
                    "savedAt": now - day,
                    "lastSeenAt": now - day,
                    "seenCount": 1,
                    "sources": [{"type": "read_aloud", "qid": RA_QID}],
                    "box": 0,
                    "dueAt": 0,
                }
            },
            "phrases": {},
        },
    }

    return {
        "backup-lapse.json": json.dumps(lapse).encode(),
        "backup-corr.json": json.dumps(corr).encode(),
        "backup-vocab.json": json.dumps(vocab).encode(),
    }


async def import_backup(page: Page, path: Path) -> None:
    """Importa um backup em /settings substituindo o progresso (caminho do usuário)."""
    # O HTML vem do SSR: o input existe ANTES da hidratação. Um upload cedo
    # dispara o change num DOM sem listeners (evento perdido, valor retido) e
    # os uploads seguintes não re-disparam (arquivos iguais). Esperar a rede
    # estabilizar + intervalo curto faz o primeiro upload cair pós-hidratação.
    await page.goto(f"{BASE}/settings", wait_until="networkidle")
    await page.wait_for_timeout(1500)
    card = page.get_by_text("Revisar importação").first
    ok = False
    for _ in range(5):
        await page.set_input_files('input[type="file"]', path)
        try:
            await card.wait_for(state="visible", timeout=4_000)
            ok = True
            break
        except Exception:
            # Última saída: os arquivos já estão no input (evento perdido
            # pré-hidratação) — re-dispara o change manualmente.
            await page.evaluate(
                "() => document.querySelector('input[type=file]')"
                "?.dispatchEvent(new Event('change', { bubbles: true }))"
            )
    if not ok:
        body = await page.evaluate("() => document.body.innerText")
        expect("import: cartão 'Revisar importação' apareceu", False, body[:400])
        return
    await page.get_by_role("button", name=re.compile("Substituir progresso", re.I)).first.click()
    await page.wait_for_timeout(600)
    sem = page.get_by_role("button", name=re.compile("Importar mesmo assim", re.I))
    if await sem.count():
        await sem.first.click()
        await page.wait_for_timeout(600)


async def flow_lapse(page: Page, errors: list[str], backup: Path) -> None:
    errors.clear()
    await import_backup(page, backup)
    await page.goto(f"{BASE}/progress", wait_until="domcontentloaded")
    await page.wait_for_timeout(1200)
    body = await page.evaluate("() => document.body.innerText")

    # D15-2a: o cartão aponta o tipo com lapso, não o best histórico pior.
    expect("lapse: cartão 'Próximo passo' presente", "Próximo passo" in body, body[:300])
    expect("lapse: recomenda o tipo com lapso (Read Aloud)", "Treinar Read Aloud" in body, body[:400])
    expect("lapse: cita a piora recente (40 pts)", "piora recente de 40 pts" in body, body[:400])

    comecar = page.get_by_role("button", name=re.compile("Começar", re.I)).first
    if await comecar.count():
        await comecar.scroll_into_view_if_needed()
        await comecar.click()
        try:
            await page.wait_for_url(re.compile(rf"/practice\?q={RA_QID}"), timeout=10_000)
            await page.wait_for_timeout(1200)
            expect(
                "lapse: Começar abre a prática da questão com pior última nota",
                RA_QID in page.url,
                page.url,
            )
        except Exception as e:
            expect("lapse: Começar abre a prática da questão com pior última nota", False, str(e))
    else:
        expect("lapse: botão Começar presente", False, "botão ausente")
    await page.screenshot(path=str(OUT / "1-lapse.png"))
    expect("lapse: console limpo", len(errors) == 0, "; ".join(errors[:3]))


async def flow_correction_cycle(page: Page, errors: list[str], backup: Path) -> None:
    errors.clear()
    await import_backup(page, backup)

    # Antes: sem erros ⇒ "Revisar erros" desabilitado. Depois do backup: habilitado.
    await page.goto(f"{BASE}/session", wait_until="domcontentloaded")
    await page.wait_for_timeout(1200)
    btn = page.get_by_role("button", name=re.compile("Revisar erros", re.I)).first
    expect("correção: botão 'Revisar erros' presente", await btn.count() > 0, "ausente")
    enabled = await btn.is_enabled() if await btn.count() else False
    expect("correção: 'Revisar erros' habilitado pelo erro recente", enabled, "seguir desabilitado")
    body = await page.evaluate("() => document.body.innerText")
    expect("correção: resumo cita questão com erro recente", "questão com erro recente" in body, body[:400])

    await btn.scroll_into_view_if_needed()
    await btn.click()
    try:
        await page.wait_for_url(re.compile(rf"/practice\?q={WFD_QID}"), timeout=10_000)
    except Exception as e:
        expect("correção: sessão abre a questão com erro", False, f"{e} · url={page.url}")
        return
    await page.wait_for_timeout(1200)

    # D15-1c: a fila da sessão tem 2 — o erro + a questão NUNCA vista do tipo.
    banner_text = await page.evaluate(
        "() => (document.querySelector('[aria-label], [class*=session]')?.textContent ?? '')"
    )
    body = await page.evaluate("() => document.body.innerText")
    expect("correção: banner mostra sessão de 2 (erro + transferência)", "Sessão · 0 de 2" in body, body[:300])

    # Retry direcionado DENTRO da prática: resposta errada reprova…
    textarea = page.locator("textarea").first
    await textarea.fill("banana")
    await page.get_by_role("button", name=re.compile("^Corrigir$", re.I)).click()
    await page.wait_for_timeout(900)
    body = await page.evaluate("() => document.body.innerText")
    expect("correção: resposta errada reprova (0%)", "0%" in body, body[:300])
    expect("correção: feedback marca a palavra extra", "banana" in body, body[:300])

    # …e "Tentar de novo" com a resposta correta aprova.
    await page.get_by_role("button", name=re.compile("Tentar de novo", re.I)).click()
    await page.wait_for_timeout(400)
    await textarea.fill(WFD_ANSWER)
    await page.get_by_role("button", name=re.compile("^Corrigir$", re.I)).click()
    await page.wait_for_timeout(900)
    body = await page.evaluate("() => document.body.innerText")
    expect("correção: retry aprovado (11/11 palavras)", "11/11 palavras" in body, body[:400])
    expect("correção: retry aprovado (100%)", "100%" in body, body[:400])
    await page.screenshot(path=str(OUT / "2-correcao.png"))

    # A 2ª da fila é a verificação de transferência: questão nova, nunca vista.
    proxima = page.get_by_role("button", name=re.compile("Próxima da sessão", re.I)).first
    expect("correção: botão 'Próxima da sessão' presente", await proxima.count() > 0, "ausente")
    if await proxima.count():
        await proxima.scroll_into_view_if_needed()
        await proxima.click()
        await page.wait_for_timeout(1200)
        qid = re.search(r"q=([\w-]+)", page.url)
        expect(
            "transferência: próxima da sessão é questão nova do mesmo tipo",
            bool(qid) and qid.group(1) != WFD_QID and qid.group(1).startswith("pte-wfd-"),
            page.url,
        )
    expect("correção: console limpo", len(errors) == 0, "; ".join(errors[:3]))


async def flow_vocab_undo(page: Page, errors: list[str], backup: Path) -> None:
    errors.clear()
    await import_backup(page, backup)
    await page.goto(f"{BASE}/vocabulary", wait_until="domcontentloaded")
    await page.wait_for_timeout(1200)
    body = await page.evaluate("() => document.body.innerText")
    expect("vocab: palavra importada aparece na lista", "serenity" in body, body[:400])

    # Remover: 🗑 → confirmação em linha → item sai.
    await page.get_by_role("button", name="Remover do vocabulário").first.click()
    await page.wait_for_timeout(400)
    await page.get_by_role("button", name="Confirmar remoção").first.click()
    await page.wait_for_timeout(600)
    body = await page.evaluate("() => document.body.innerText")
    # O toast de remoção cita a palavra ("serenity" removido do vocabulário),
    # então o critério correto é a LISTA (nenhum item removível restante),
    # não o texto inteiro da página.
    rows = page.get_by_role("button", name="Remover do vocabulário")
    expect("vocab: item sai da lista após remoção", (await rows.count()) == 0, body[:400])

    # D15-4c: toast com Desfazer restaura o item.
    undo = page.get_by_role("button", name=re.compile("Desfazer", re.I)).first
    expect("vocab: toast com Desfazer aparece", await undo.count() > 0, "toast ausente")
    if await undo.count():
        await undo.click()
        await page.wait_for_timeout(800)
        body = await page.evaluate("() => document.body.innerText")
        expect("vocab: Desfazer restaura o item na lista", "serenity" in body, body[:400])
    await page.screenshot(path=str(OUT / "3-vocab-undo.png"))
    expect("vocab: console limpo", len(errors) == 0, "; ".join(errors[:3]))


async def flow_scan(context, errors: list[str]) -> None:
    for route in ROUTES:
        errors.clear()
        page = await context.new_page()
        page.on("console", lambda m, e=errors: e.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda ex, e=errors: e.append(str(ex)))
        await page.set_viewport_size({"width": 390, "height": 844})
        await page.goto(f"{BASE}{route}", wait_until="domcontentloaded")
        await page.wait_for_timeout(1300)
        overflow = await page.evaluate(
            "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
        )
        expect(f"scan {route}: 390px sem overflow horizontal", overflow <= 1, f"overflow {overflow}px")
        expect(f"scan {route}: console limpo", len(errors) == 0, "; ".join(errors[:3]))
        if AXE.exists():
            await page.add_script_tag(path=str(AXE))
            try:
                result = await page.evaluate(
                    """
                    () => axe.run(document, {
                      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }
                    }).then(r => r.violations.map(v =>
                      v.id + ':' + v.nodes.length + ':' + (v.nodes[0] ? v.nodes[0].target.join(' ') + ' «' + (v.nodes[0].html || '').slice(0, 160) + '»' : '')
                    ).join(' | '))
                    """
                )
                expect(f"scan {route}: axe 0 violações", not result, result or "")
            except Exception as e:
                expect(f"scan {route}: axe 0 violações", False, str(e))
        await page.close()


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    payloads = backup_payloads()
    paths = {name: OUT / name for name in payloads}
    for name, data in payloads.items():
        paths[name].write_bytes(data)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        errors: list[str] = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        await flow_lapse(page, errors, paths["backup-lapse.json"])
        await flow_correction_cycle(page, errors, paths["backup-corr.json"])
        await flow_vocab_undo(page, errors, paths["backup-vocab.json"])
        await flow_scan(context, errors)

        await browser.close()

    print(json.dumps(REPORT, indent=1, ensure_ascii=False))
    if FAILURES:
        print("FALHAS: " + " | ".join(FAILURES))
        sys.exit(1)


asyncio.run(main())
