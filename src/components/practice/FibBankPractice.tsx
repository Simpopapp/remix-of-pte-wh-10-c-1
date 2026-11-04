import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { metaByType } from "@/lib/pte";
import { gradeBank, type BankGrade } from "@/lib/pte/fibBank";
import type { FibBankQuestion } from "@/lib/pte/types";
import { recordAttempt, useAppState } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { PlusWordText } from "@/components/plus/PlusWordText";
import { PlusPhraseCard } from "@/components/plus/PlusPhraseCard";
import { PlusSpeakButton } from "@/components/plus/PlusSpeakButton";
import { splitSentences, stripBlanks } from "@/lib/plus/sentences";
import { PracticeShell } from "./PracticeShell";

type Phase = "idle" | "result";

/**
 * D18-6: Reading FIB oficial com banco compartilhado de palavras.
 * Atribuição por toque (seleciona palavra → lacuna) OU arrastar-e-soltar;
 * teclado acessível por construção (os dois são <button> nativos).
 * Cada palavra do banco é usada no máximo uma vez.
 */

function BankChip({
  word,
  selected,
  disabled,
  onSelect,
  onDragWord,
}: {
  word: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onDragWord: () => void;
}) {
  return (
    <button
      type="button"
      draggable={!disabled}
      onDragStart={(e: DragEvent<HTMLButtonElement>) => {
        e.dataTransfer.setData("text/plain", word);
        e.dataTransfer.effectAllowed = "move";
        onDragWord();
      }}
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`palavra ${word}${selected ? " (selecionada)" : ""}`}
      className={cn(
        "min-h-11 rounded-xl border px-3 py-2 font-serif text-sm text-foreground transition-colors focus-ring",
        selected
          ? "border-primary bg-primary/10 shadow-pop"
          : "border-border/60 bg-card shadow-card hover:border-primary/40",
        disabled && "cursor-default opacity-70",
      )}
    >
      {word}
    </button>
  );
}

function GapButton({
  index,
  word,
  phase,
  correct,
  answer,
  onGapClick,
  onDropWord,
}: {
  index: number;
  word: string | null;
  phase: Phase;
  correct: boolean;
  answer: string;
  onGapClick: () => void;
  onDropWord: (w: string) => void;
}) {
  const filled = word !== null;
  return (
    <span className="mx-1 inline-flex items-center gap-1 align-middle">
      <button
        type="button"
        onClick={onGapClick}
        disabled={phase === "result"}
        onDragOver={(e: DragEvent<HTMLButtonElement>) => {
          if (phase !== "result") e.preventDefault();
        }}
        onDrop={(e: DragEvent<HTMLButtonElement>) => {
          if (phase === "result") return;
          e.preventDefault();
          const w = e.dataTransfer.getData("text/plain");
          if (w) onDropWord(w);
        }}
        aria-label={`Lacuna ${index + 1}${word ? `, com a palavra ${word}` : ", vazia"}`}
        className={cn(
          "min-h-11 min-w-28 rounded-lg border bg-background px-3 py-2 font-serif text-sm text-foreground transition-colors focus-ring",
          phase === "idle" && !filled && "border-dashed border-input",
          phase === "idle" && filled && "border-primary/60 bg-primary/5",
          phase === "result" && (correct ? "border-success/60" : "border-destructive/60"),
        )}
      >
        {word ?? "—"}
      </button>
      {phase === "result" && !correct && filled ? (
        <span className="text-xs text-success">✓ {answer}</span>
      ) : null}
    </span>
  );
}

export function FibBankPractice({ question }: { question: FibBankQuestion }) {
  const navigate = useNavigate();
  const plus = useAppState().settings.plus;
  const pool = useMemo(() => metaByType("read_fib_bank"), []);

  const [phase, setPhase] = useState<Phase>("idle");
  const [selected, setSelected] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<(string | null)[]>(() =>
    question.blanks.map(() => null),
  );
  const [grade, setGrade] = useState<BankGrade | null>(null);
  const recordedRef = useRef(false);

  useEffect(() => {
    setPhase("idle");
    setSelected(null);
    setAssignments(question.blanks.map(() => null));
    setGrade(null);
    recordedRef.current = false;
  }, [question.id, question.blanks]);

  const answered = assignments.filter((a) => a !== null).length;

  const assign = (blankIdx: number, word: string) => {
    setAssignments((prev) => {
      const next = [...prev];
      // Cada palavra é usada UMA vez: troca implícita libera a lacuna anterior.
      for (let i = 0; i < next.length; i += 1)
        if (i !== blankIdx && next[i] === word) next[i] = null;
      next[blankIdx] = word;
      return next;
    });
    setSelected(null);
  };

  const clear = (blankIdx: number) => {
    setAssignments((prev) => {
      const next = [...prev];
      next[blankIdx] = null;
      return next;
    });
  };

  const onGapClick = (blankIdx: number) => {
    if (selected) assign(blankIdx, selected);
    else if (assignments[blankIdx]) clear(blankIdx);
  };

  const submit = () => {
    const g = gradeBank(assignments, question.blanks);
    setGrade(g);
    setPhase("result");
    setSelected(null);
    if (!recordedRef.current) {
      recordAttempt({
        qid: question.id,
        taskType: "read_fib_bank",
        mode: "manual",
        contentScore: null,
        score: g.score,
        wpm: null,
        durationMs: 0,
        metrics: { correct: g.correct, total: g.total },
      });
      recordedRef.current = true;
    }
  };

  const retry = () => {
    setPhase("idle");
    setSelected(null);
    setAssignments(question.blanks.map(() => null));
    setGrade(null);
    recordedRef.current = false;
  };

  const nextId = pool[(pool.findIndex((p) => p.id === question.id) + 1) % pool.length]?.id;

  const phraseSentences = useMemo(
    () => splitSentences(stripBlanks(question.text)),
    [question.text],
  );
  const wordTranslation = plus.wordTranslation;
  const phraseTranslation = plus.phraseTranslation;
  const plusAudio = plus.plusAudio;

  // Renderiza o passage trocando cada "_______(k)" por uma lacuna clicável.
  const renderPassage = (): ReactNode[] => {
    const parts = question.text.split(/_{5,}\((\d+)\)/);
    const out: ReactNode[] = [];
    for (let i = 0; i < parts.length; i += 2) {
      out.push(
        <PlusWordText
          key={`t${i}`}
          text={parts[i] ?? ""}
          enabled={wordTranslation}
          audioEnabled={plusAudio}
          aiEnabled={plus.aiTranslation}
          questionText={stripBlanks(question.text)}
          source={{ type: question.taskType, qid: question.id }}
          inline
          className="font-serif"
        />,
      );
      if (i + 1 < parts.length) {
        const blankIdx = Number(parts[i + 1]) - 1;
        if (blankIdx < 0 || blankIdx >= question.blanks.length) continue;
        out.push(
          <GapButton
            key={`b${blankIdx}`}
            index={blankIdx}
            word={assignments[blankIdx] ?? null}
            phase={phase}
            correct={grade?.correctIndexes.includes(blankIdx) ?? false}
            answer={question.blanks[blankIdx] ?? ""}
            onGapClick={() => onGapClick(blankIdx)}
            onDropWord={(w) => assign(blankIdx, w)}
          />,
        );
      }
    }
    return out;
  };

  const remaining = question.bank.filter((w) => !assignments.includes(w));

  return (
    <PracticeShell
      question={question}
      pool={pool}
      footerText={
        phase === "idle"
          ? `${answered}/${question.blanks.length} lacunas preenchidas · cada palavra do banco é usada uma vez`
          : "Cada lacuna correta vale 1 ponto."
      }
      footerActions={
        <>
          {phase === "idle" ? (
            <Button size="lg" onClick={submit} disabled={answered === 0}>
              Corrigir
            </Button>
          ) : null}
          {phase === "result" ? (
            <Button variant="outline" onClick={retry}>
              Tentar de novo
            </Button>
          ) : null}
          {phase === "result" && nextId ? (
            <Button size="lg" onClick={() => navigate({ to: "/practice", search: { q: nextId } })}>
              Próxima →
            </Button>
          ) : null}
        </>
      }
    >
      <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
        <div className="mb-4 flex items-start justify-between gap-3">
          <p className="text-sm text-muted-foreground">{question.prompt}</p>
          <PlusSpeakButton
            text={stripBlanks(question.text)}
            enabled={plusAudio}
            label="ouvir texto"
            className="shrink-0"
          />
        </div>
        <p className="font-serif text-[17px] leading-loose text-foreground">{renderPassage()}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Teclado: Tab até o banco, Enter seleciona; Tab até a lacuna, Enter aplica. Enter numa
          lacuna preenchida devolve a palavra ao banco.
        </p>
      </div>

      {/* Banco compartilhado: restantes + palavras já atribuídas ficam nas lacunas. */}
      <section
        aria-label="Banco de palavras"
        className="mt-4 rounded-2xl border border-border/60 bg-card p-5"
      >
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Banco de palavras
        </p>
        <ul className="flex flex-wrap gap-2">
          {phase === "idle"
            ? remaining.map((w) => (
                <li key={w}>
                  <BankChip
                    word={w}
                    selected={selected === w}
                    disabled={false}
                    onSelect={() => setSelected((s) => (s === w ? null : w))}
                    onDragWord={() => setSelected(w)}
                  />
                </li>
              ))
            : question.bank.map((w) => (
                <li key={w}>
                  <BankChip
                    word={w}
                    selected={false}
                    disabled
                    onSelect={() => {}}
                    onDragWord={() => {}}
                  />
                </li>
              ))}
        </ul>
      </section>

      {/* Pack plus: tradução por frase + pronúncia por frase */}
      <PlusPhraseCard
        type="read_fib_bank"
        qid={question.id}
        sentences={phraseSentences}
        enabled={phraseTranslation}
        audioEnabled={plusAudio}
        aiEnabled={plus.aiTranslation}
        questionText={stripBlanks(question.text)}
      />

      {phase === "result" && grade ? (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 font-serif text-lg font-semibold tabular-nums text-primary">
              {grade.score}%
            </span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {grade.correct}/{grade.total} lacunas corretas
            </span>
            {grade.score === 100 ? (
              <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs text-success">
                Todas certas ✓
              </span>
            ) : null}
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Gabarito
          </p>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            {question.blanks.map((ans, i) => (
              <li key={i}>
                <span className="text-foreground">{ans}</span>
                {(assignments[i] && assignments[i] !== ans) || !assignments[i] ? (
                  <span className="text-xs"> · você: {assignments[i] ?? "—"}</span>
                ) : null}
              </li>
            ))}
          </ol>
          {question.explanation ? (
            <p className="mt-4 text-sm text-muted-foreground">{question.explanation}</p>
          ) : null}
          {question.trap ? (
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Dica:</span> {question.trap}
            </p>
          ) : null}
        </div>
      ) : null}
    </PracticeShell>
  );
}
