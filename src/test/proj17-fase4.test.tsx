// Projeto 17 · Fase 4 — Disclosure (D17-12): gatilho com aria-expanded/
// controls e região renderizada; modo controlado (nota do runner mantém o
// contrato aria-controls="questao-nota"); ScorePanel colapsa só a transcrição
// longa (resumo de 1 linha visível).
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

import { Disclosure } from "@/components/layout/Disclosure";
import { ScorePanel } from "@/components/ScorePanel";
import type { GradeResult } from "@/lib/scoring";

describe("D17-12 · Disclosure (design system)", () => {
  afterEach(cleanup);

  it("gatilho anuncia aria-expanded e a região só existe quando aberta", () => {
    const { container } = render(
      <Disclosure trigger="Detalhes da questão">
        <span>tópico</span>
      </Disclosure>,
    );
    const button = screen.getByRole("button", { name: /Detalhes da questão/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(container.textContent).not.toContain("tópico");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(container.textContent).toContain("tópico");
  });

  it("gatilho tem alvo de toque ≥44px (min-h-11)", () => {
    render(<Disclosure trigger="Detalhes da questão">x</Disclosure>);
    const button = screen.getByRole("button", { name: /Detalhes da questão/ });
    expect(button.className).toContain("min-h-11");
  });

  it("contentId preserva o contrato aria-controls de consumidores existentes", () => {
    const { container } = render(
      <Disclosure trigger="Nota" open={false} contentId="questao-nota">
        <textarea />
      </Disclosure>,
    );
    const button = screen.getByRole("button", { name: /Nota/ });
    expect(button).toHaveAttribute("aria-controls", "questao-nota");
    expect(container.querySelector("#questao-nota")).toBeNull();
  });

  it("modo controlado não muda estado sozinho: só repassa onOpenChange", () => {
    const onOpenChange = vi.fn();
    const { container } = render(
      <Disclosure trigger="Nota" open={false} onOpenChange={onOpenChange}>
        conteúdo
      </Disclosure>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Nota/ }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(container.textContent).not.toContain("conteúdo");
  });
});

const gradeBase = {
  taskType: "read_aloud",
  score: 88,
  wpm: 140,
  durationMs: 12_000,
  pauses: 1,
  repetitions: 0,
  moved: 0,
  extras: [],
  paceVerdict: "ideal",
  mastered: false,
} as unknown as GradeResult;

describe("D17-12 · ScorePanel denso (transcrição colapsável)", () => {
  afterEach(cleanup);

  it("transcrição curta vem aberta por padrão (comportamento anterior preservado)", () => {
    render(<ScorePanel grade={{ ...gradeBase, transcript: "texto dito" }} />);
    expect(
      screen.getByRole("button", { name: /O que captamos/ }).getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("transcrição longa vem fechada (resumo de 1 linha; o texto só abre sob pedido)", () => {
    const long = "palavra ".repeat(60); // > 240 caracteres
    render(<ScorePanel grade={{ ...gradeBase, transcript: long }} />);
    expect(
      screen.getByRole("button", { name: /O que captamos/ }).getAttribute("aria-expanded"),
    ).toBe("false");
  });
});
