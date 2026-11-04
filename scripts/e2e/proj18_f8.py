# E2E — Fechamento do projeto 18, Fase 8 (D18-F8) — versão 1
#
# Verificação em browser real (Playwright/Chromium headless). Rodar com o dev
# server no ar:
#
#     python3 scripts/e2e/proj18_f8.py
#
# Fluxos (PRD §F8 / roadmap D18-F8a):
#
# 1. HIW corrigido end-to-end (D18-0a) — item com transcript FALADO distinto do
#    texto exibido; ouvir a gravação e destacar os erros produce nota honesta.
# 2. Retry de IA universal (D18-0c) — a chamada IA é bloqueada: estado
#    "Análise IA indisponível agora" com botão "Tentar novamente"; o retry
#    reexecuta a análise (nova chamada contada) e, liberada, conclui com
#    rótulo honesto (IA real ou fallback).
# 3. SST com IA (D18-1) — resumo submetido recebe análise IA com a dimensão
#    Ortografia (e NUNCA Coesão inventada); nota local preservada.
# 4. Revisão fiel do simulado (D18-4) — registro semeado, reload, revisão
#    reconstruída da forma persistida (resumo + resposta integral).
# 5. Rotação de sentidos no estudo de vocabulário (D18-5a) — checagem typed
#    com cursor: a 2ª aparição do cartão na MESMA fila pede o próximo sentido.
# 6. read_fib_bank em prática (D18-6) e blueprint do simulado.
# 7. Varredura final — rotas tocadas em 390×844: sem overflow, console limpo,
#    axe 0 violações.
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
OUT = Path("/tmp/browser/e2e-f8")
AXE = Path("/dev-server/node_modules/axe-core/axe.min.js")

HIW_DATA = json.loads(Path("/dev-server/src/data/pte/lst_hiw.json").read_text())
HIW_QS = HIW_DATA if isinstance(HIW_DATA, list) else HIW_DATA.get("questions", [])
BANK_DATA = json.loads(Path("/dev-server/src/data/pte/read_fib_bank.json").read_text())
BANK_QS = BANK_DATA if isinstance(BANK_DATA, list) else BANK_DATA.get("questions", [])
ESSAY_QID = "79score-essay-01"
SST_QID = "pte-sst-2f5c3b5c"

REPORT: dict[str, object] = {}
FAILURES: list[str] = []


def expect(name: str, ok: bool, detail: str = "") -> None:
    REPORT[name] = "ok" if ok else f"FALHOU: {detail}"
    if not ok:
        FAILURES.append(f"{name}: {detail}")


def backup_payload() -> bytes:
    """F5 — 1 palavra com 2 sentidos (literal + sentido acumulado) para a rotação."""
    now = int(time.time() * 1000)
    return json.dumps(
        {
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
                        "contextual": "tranquilidade profunda",
                        "savedAt": now - 86_400_000,
                        "lastSeenAt": now - 86_400_000,
                        "seenCount": 1,
                        "sources": [{"type": "read_aloud", "qid": "pte-ra-01ef7205"}],
                        "box": 0,
                        "dueAt": 0,
                        "senses": [
                            {
                                "literal": "calma",
                                "contextual": "paz em meio à pressão",
                                "ts": now - 3_600_000,
                            }
                        ],
                    }
                },
                "phrases": {},
            },
        }
    ).encode()


async def review_record_seed(page: Page) -> None:
    """F4 — simulado concluído com resposta integral + causa (formato novo)."""
    essay_qid = "band9-essay-01"
    bank_qid = BANK_QS[0]["id"]
    await page.evaluate(
        """(qids) => {
          const raw = JSON.parse(localStorage.getItem('pte-master-hub') ?? '{}');
          raw.version = 8; raw.sessions = [{
            id: 's-f8-review',
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
        [essay_qid, bank_qid],
    )


async def import_backup(page: Page, path: Path) -> None:
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


async def flow_hiw(page: Page, errors: list[str]) -> None:
    """F0a/D18-0a — HIW: transcript falado distinto + destaque dos erros pontua."""
    errors.clear()
    item = HIW_QS[0]
    qid = item["id"]
    # Contrato de dados visível ao E2E: o FALADO diverge do exibido.
    transcript = item.get("transcript") or item.get("audioText") or ""
    expect("hiw: transcript distinto do texto (contrato)", bool(transcript) and transcript != item["text"])
    await page.goto(f"{BASE}/practice?q={qid}", wait_until="domcontentloaded")
    await page.wait_for_timeout(1500)
    body = await page.evaluate("() => document.body.innerText")
    expect("hiw: prática carregou", "Highlight Incorrect Words" in body or "destacar" in body.lower(), body[:200])

    # Ouvir a gravação (TTS da versão FALADA): o botão vira "Já reproduzida".
    ouvir = page.get_by_role("button", name=re.compile("Ouvir gravação", re.I)).first
    expect("hiw: botão Ouvir gravação presente", await ouvir.count() > 0, "ausente")
    if await ouvir.count():
        await ouvir.scroll_into_view_if_needed()
        await ouvir.click()
        await page.wait_for_timeout(400)
        body = await page.evaluate("() => document.body.innerText")
        expect("hiw: gravação reproduzida (estado do botão)", "Já reproduzida" in body, body[:200])

    # Destaca as palavras nas posições de erro (tokens = split por espaço).
    tokens = item["text"].split()
    container = page.locator("div.flex-wrap.font-serif").first
    total = await container.locator("button").count()
    expect("hiw: tokens do texto clicáveis", total >= len(tokens), f"tokens={total}")
    clicked = 0
    for idx in item["errors"]:
        if 0 <= idx < total:
            await container.locator("button").nth(idx).click()
            clicked += 1
    expect("hiw: erros destacados", clicked == len(item["errors"]), f"clicked={clicked}")

    await page.get_by_role("button", name=re.compile("^Corrigir$", re.I)).first.click()
    await page.wait_for_timeout(900)
    body = await page.evaluate("() => document.body.innerText")
    hits = len(item["errors"])
    expect(
        f"hiw: gabarito honesto ({hits}/{hits} erros)",
        f"{hits}/{hits} erros destacados" in body,
        body[:300],
    )
    expect("hiw: sem falsos positivos", "0 falsos positivos" in body, body[:300])
    await page.screenshot(path=str(OUT / "1-hiw.png"))
    expect("hiw: console limpo", len(errors) == 0, "; ".join(errors[:3]))


async def flow_retry_ai(page: Page, errors: list[str]) -> None:
    """D18-0c — falha de IA → 'Tentar novamente' reexecuta a análise."""
    errors.clear()
    unique_essay = (
        "Cities around the world are facing unprecedented pressure on their housing "
        "markets, and governments must act decisively to keep urban life affordable. "
        "Rapid population growth combined with limited land supply has pushed prices "
        "beyond the reach of ordinary families, forcing long commutes and overcrowded "
        "conditions. In my view, the most effective response combines generous "
        "construction of public and private housing with stronger rent protections. "
        "Vienna demonstrates that sustained public investment can deliver high quality "
        "homes at rents well below market rates. This draft adds the marker sentence "
        "zephyr-quill-eleven for the retry flow."
    )
    blocked: list[int] = []

    async def block(route):
        blocked.append(1)
        await route.abort()

    await page.route("**/_serverFn/**", block)
    await page.goto(f"{BASE}/practice?q={ESSAY_QID}", wait_until="domcontentloaded")
    await page.wait_for_timeout(1500)
    await page.locator("textarea").first.fill(unique_essay)
    await page.get_by_role("button", name=re.compile("^Corrigir$", re.I)).first.click()
    try:
        await page.wait_for_function(
            "() => document.body.innerText.includes('Análise IA indisponível agora')",
            timeout=30_000,
        )
        expect("retry: falha de IA mostra estado indisponível", True)
    except Exception as e:
        expect("retry: falha de IA mostra estado indisponível", False, f"{e} · blocked={len(blocked)}")
    body = await page.evaluate("() => document.body.innerText")
    expect("retry: rótulo honesto da nota básica", "avaliação básica determinística" in body, body[:400])

    btn = page.get_by_role("button", name=re.compile("Tentar novamente", re.I)).first
    expect("retry: botão 'Tentar novamente' presente", await btn.count() > 0, "ausente")

    # Retry com a rede bloqueada: uma NOVA chamada sai (reexecuta a análise).
    before = len(blocked)
    if await btn.count():
        await btn.click()
        await page.wait_for_timeout(2_500)
    expect("retry: retry reexecuta a análise (nova chamada)", len(blocked) > before, f"{before}→{len(blocked)}")
    body = await page.evaluate("() => document.body.innerText")
    expect("retry: indisponível persiste com rede bloqueada", "Análise IA indisponível agora" in body, body[:300])

    # Rede liberada: o retry conclui com rótulo honesto (IA real ou fallback).
    await page.unroute("**/_serverFn/**")
    if await page.get_by_role("button", name=re.compile("Tentar novamente", re.I)).count():
        await page.get_by_role("button", name=re.compile("Tentar novamente", re.I)).first.click()
        try:
            await page.wait_for_function(
                "() => document.body.innerText.includes('avaliação IA') || document.body.innerText.includes('Análise IA indisponível agora')",
                timeout=90_000,
            )
            body = await page.evaluate("() => document.body.innerText")
            modo = "IA real" if "avaliação IA" in body else "fallback honesto"
            REPORT["retry: modo final"] = modo
            expect("retry: análise conclui com rótulo honesto", True)
        except Exception as e:
            expect("retry: análise conclui com rótulo honesto", False, str(e))
    await page.screenshot(path=str(OUT / "2-retry-ia.png"))
    # route.abort() gera ruído ERR_FAILED no console — não é erro do app.
    real_errors = [e for e in errors if "ERR_FAILED" not in e]
    expect("retry: console limpo", len(real_errors) == 0, "; ".join(real_errors[:3]))


async def flow_sst_ai(page: Page, errors: list[str]) -> None:
    """D18-1 — SST: análise IA com Ortografia, sem Coesão inventada."""
    errors.clear()
    await page.goto(f"{BASE}/practice?q={SST_QID}", wait_until="domcontentloaded")
    await page.wait_for_timeout(1500)
    # Pula o áudio (headless não tem voz) → escrever.
    pular = page.get_by_role("button", name=re.compile("Pular áudio", re.I)).first
    expect("sst: prática carregou (pular áudio presente)", await pular.count() > 0, "ausente")
    await pular.click()
    await page.wait_for_timeout(600)
    resumo = (
        "The lecture explains that urban populations keep growing while infrastructure "
        "investment lags behind, creating pressure on housing, transport and public "
        "services. The speaker argues that cities that plan ahead — expanding transit, "
        "building affordable housing and protecting green space — manage growth better. "
        "The lecture concludes that cooperation between governments and communities is "
        "essential to keep cities livable for everyone, especially for lower income "
        "residents who depend on public services."
    )
    box = page.locator("textarea").first
    await box.fill(resumo)
    await page.get_by_role("button", name=re.compile("^Corrigir$", re.I)).first.click()
    await page.wait_for_timeout(700)
    body = await page.evaluate("() => document.body.innerText")
    expect("sst: nota local registrada", "%" in body, body[:300])
    try:
        await page.wait_for_function(
            "() => document.body.innerText.includes('avaliação IA') || document.body.innerText.includes('Análise IA indisponível agora')",
            timeout=120_000,
        )
        body = await page.evaluate("() => document.body.innerText")
        if "Análise IA detalhada" in body:
            expect("sst: análise IA presente", True)
            expect("sst: dimensão Ortografia avaliada", "Ortografia" in body, body[:400])
            expect("sst: coesão NUNCA inventada no SST", "Coesão" not in body, body[:400])
            expect("sst: nota local preservada (rótulo honesto)", "score registrado no progresso" in body, body[:400])
            REPORT["sst: modo"] = "IA real"
        else:
            REPORT["sst: modo"] = "IA indisponível (fallback honesto)"
            expect("sst: indisponibilidade rotulada com retry", "Tentar novamente" in body)
    except Exception as e:
        expect("sst: análise IA (ou fallback) presente", False, str(e))
    await page.screenshot(path=str(OUT / "3-sst-ia.png"))
    expect("sst: console limpo", len(errors) == 0, "; ".join(errors[:3]))


async def flow_review_reload(page: Page, errors: list[str]) -> None:
    """D18-F4 — revisão reconstruída do registro persistido APÓS reload."""
    errors.clear()
    await review_record_seed(page)
    await page.goto(f"{BASE}/exam", wait_until="domcontentloaded")
    await page.wait_for_timeout(900)
    body = await page.evaluate("() => document.body.innerText")
    expect("revisão: cartão do simulado na escolha", "Revisar último simulado" in body, body[:200])
    await page.reload(wait_until="domcontentloaded")
    await page.wait_for_timeout(900)
    body = await page.evaluate("() => document.body.innerText")
    expect("revisão: cartão sobrevive ao reload", "Revisar último simulado" in body, body[:200])
    await page.get_by_role("button", name="Abrir revisão").click()
    await page.wait_for_timeout(1200)
    body = await page.evaluate("() => document.body.innerText")
    expect("revisão: resumo reconstruído", "Resumo do simulado" in body)
    expect("revisão: respostas enviadas", "Respostas enviadas" in body)
    expect("revisão: resposta integral persistida", "XXXXXXX" in body)
    await page.screenshot(path=str(OUT / "4-revisao.png"))
    expect("revisão: console limpo", len(errors) == 0, "; ".join(errors[:3]))


async def flow_sense_rotation(page: Page, errors: list[str], backup: Path) -> None:
    """D18-5a — a 2ª aparição do cartão na fila pede o próximo sentido."""
    errors.clear()
    await import_backup(page, backup)
    # typedRecall on: grava no store persistido e recarrega para valer.
    await page.evaluate(
        """() => {
          const raw = JSON.parse(localStorage.getItem('pte-master-hub') ?? '{}');
          raw.settings = raw.settings ?? {};
          raw.settings.plus = { ...(raw.settings.plus ?? {}), typedRecall: true };
          localStorage.setItem('pte-master-hub', JSON.stringify(raw));
        }"""
    )
    await page.reload(wait_until="domcontentloaded")
    await page.wait_for_timeout(900)
    await page.goto(f"{BASE}/vocabulary", wait_until="domcontentloaded")
    await page.wait_for_timeout(1200)
    body = await page.evaluate("() => document.body.innerText")
    expect("vocab: palavra importada na lista", "serenity" in body, body[:400])
    revisar = page.get_by_role("button", name=re.compile("Revisar hoje|Estudar", re.I)).first
    expect("vocab: botão de sessão presente", await revisar.count() > 0, "ausente")
    await revisar.click()
    await page.wait_for_timeout(900)

    # 1ª aparição: sentido pedido = literal ('serenidade'). Erro demove.
    await page.get_by_label("sentido em português", exact=False).or_(
        page.locator("#typed-recall")
    ).first.fill("banana")
    await page.get_by_role("button", name=re.compile("^Verificar$", re.I)).first.click()
    await page.wait_for_timeout(500)
    body = await page.evaluate("() => document.body.innerText")
    expect("vocab: 1ª falha revela o literal com chip", "errou nesta sessão" in body, body[:400])
    await page.get_by_role("button", name=re.compile("Continuar", re.I)).first.click()
    await page.wait_for_timeout(700)

    # 2ª aparição (cartão reenfileirado): sentido pedido = 2º ('calma').
    body = await page.evaluate("() => document.body.innerText")
    expect("vocab: cartão voltou à fila", "banana" not in body and "Digite o sentido" in body, body[:200])
    await page.locator("#typed-recall").first.fill("banana")
    await page.get_by_role("button", name=re.compile("^Verificar$", re.I)).first.click()
    await page.wait_for_timeout(500)
    body = await page.evaluate("() => document.body.innerText")
    expect("vocab: 2ª aparição pede o sentido rotacionado ('calma')", "calma" in body, body[:500])
    chips = body.count("errou nesta sessão")
    expect("vocab: dois sentidos marcados como errados", chips >= 2, f"chips={chips}")
    await page.screenshot(path=str(OUT / "5-rotacao-sentidos.png"))
    expect("vocab: console limpo", len(errors) == 0, "; ".join(errors[:3]))


async def flow_bank_practice(page: Page, errors: list[str], qid: str) -> None:
    """D18-6 — read_fib_bank: toque→lacuna→gabarito."""
    errors.clear()
    await page.goto(f"{BASE}/practice?q={qid}", wait_until="domcontentloaded")
    await page.wait_for_timeout(900)
    bank = page.get_by_role("region", name="Banco de palavras")
    first = bank.get_by_role("button").first
    word = (await first.inner_text()).strip()
    await first.click()
    gap = page.get_by_role("button", name="Lacuna 1, vazia")
    await gap.click()
    filled = await page.get_by_role("button", name=f"Lacuna 1, com a palavra {word}").count()
    expect("bank: atribuição por toque", filled == 1, f"word={word}")
    while True:
        remaining = bank.get_by_role("button")
        if await remaining.count() == 0:
            break
        await remaining.first.click()
        empty = page.get_by_role("button", name=re.compile(r"Lacuna \d+, vazia"))
        if await empty.count() == 0:
            break
        await empty.first.click()
    await page.get_by_role("button", name="Corrigir").click()
    await page.wait_for_timeout(600)
    body = await page.evaluate("() => document.body.innerText")
    expect("bank: gabarito no resultado", "gabarito" in body.lower() and "lacunas corretas" in body, body[:300])
    await page.screenshot(path=str(OUT / "6-bank.png"))
    expect("bank: console limpo", len(errors) == 0, "; ".join(errors[:3]))


SWEEP_ROUTES: list[str] = []


async def flow_scan(context, errors: list[str]) -> None:
    for route in SWEEP_ROUTES:
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
    backup_path = OUT / "backup-f8.json"
    backup_path.write_bytes(backup_payload())

    hiw_qid = HIW_QS[0]["id"]
    bank_qid = BANK_QS[0]["id"]
    SWEEP_ROUTES.extend(
        [
            "/",
            f"/practice?q={hiw_qid}",
            f"/practice?q={ESSAY_QID}",
            f"/practice?q={SST_QID}",
            f"/practice?q={bank_qid}",
            "/exam",
            "/progress",
            "/vocabulary",
            "/settings",
        ]
    )

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        errors: list[str] = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        # Blueprint do simulado menciona o tipo novo (D18-6).
        await page.goto(f"{BASE}/exam", wait_until="domcontentloaded")
        await page.wait_for_timeout(700)
        body = await page.evaluate("() => document.body.innerText")
        expect("exam: blueprint cita o banco de palavras", "banco de palavras" in body, body[:300])

        await flow_hiw(page, errors)
        await flow_retry_ai(page, errors)
        await flow_sst_ai(page, errors)
        await flow_review_reload(page, errors)
        await flow_sense_rotation(page, errors, backup_path)
        await flow_bank_practice(page, errors, bank_qid)
        await flow_scan(context, errors)

        await browser.close()

    print(json.dumps(REPORT, indent=1, ensure_ascii=False))
    if FAILURES:
        print("FALHAS: " + " | ".join(FAILURES))
        sys.exit(1)


asyncio.run(main())
