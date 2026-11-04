// Projeto 17 · Fase 2 — estados e foco pós-ação (D17-13/D17-14):
// o resultado que APARECE recebe foco (next step óbvio) e o painel de
// estado unificado usa a linguagem única (error = role="alert").
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { ScorePanel } from "@/components/ScorePanel";
import { StatePanel } from "@/components/layout/StatePanel";
import type { GradeResult } from "@/lib/scoring";

const grade: GradeResult = {
  taskType: "read_aloud",
  score: 88,
  wpm: 140,
  durationMs: 12_000,
  pauses: 1,
  repetitions: 0,
  moved: 2,
  extras: [],
  transcript: "texto dito",
  paceVerdict: "ideal",
  mastered: false,
} as unknown as GradeResult;

describe("D17-13 · foco pós-ação", () => {
  afterEach(cleanup);

  it("ScorePanel recebe foco ao montar (resultado visível sem caçar o scroll)", () => {
    const { container } = render(<ScorePanel grade={grade} />);
    const panel = container.querySelector('[aria-label="Resultado da questão"]');
    expect(panel).not.toBeNull();
    expect(document.activeElement).toBe(panel);
  });

  it("painel de resultado é focável por tab-index -1 (não entra no tab order)", () => {
    const { container } = render(<ScorePanel grade={grade} />);
    expect(container.querySelector('[tabindex="-1"]')).not.toBeNull();
  });
});

describe("D17-14 · StatePanel (linguagem única de estado)", () => {
  afterEach(cleanup);

  it("error emite role=alert (anúncio imediato)", () => {
    render(<StatePanel variant="error" compact title="Não foi possível salvar agora." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível salvar agora.");
  });

  it("loading anuncia por status/aria-live e mantém o título para leitores de tela", () => {
    render(<StatePanel variant="loading" title="Carregando questão…" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("empty completo delega ao EmptyState (visual único do vazio)", () => {
    render(
      <StatePanel
        icon={StatePanelEmptyIcon}
        title="Nada por aqui"
        description="Sem dados ainda."
      />,
    );
    expect(screen.getByText("Nada por aqui")).toBeInTheDocument();
  });
});

import { SearchX } from "lucide-react";
const StatePanelEmptyIcon = SearchX;
