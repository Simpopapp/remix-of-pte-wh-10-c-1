import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";

import { SectionIcon } from "@/components/layout/SectionIdentity";
import { TYPE_META, type QuestionMeta } from "@/lib/pte";
import { SOURCE_BADGE, statusOf } from "@/lib/pte/question-status";
import type { QuestionStat } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface QuestionRowProps {
  meta: QuestionMeta;
  number: number;
  /** Texto de pré-visualização (só para task types em que o texto não é a resposta). */
  preview?: string | undefined;
  stat: QuestionStat | undefined;
  bookmarked: boolean;
  onToggleBookmark: (qid: string) => void;
  now?: number;
}

const DIFFICULTY_LABEL = { easy: "fácil", medium: "média", hard: "difícil" } as const;

export function QuestionRow({
  meta,
  number,
  preview,
  stat,
  bookmarked,
  onToggleBookmark,
  now = Date.now(),
}: QuestionRowProps) {
  const status = statusOf(stat, meta.taskType, now);
  const title = preview ?? `${TYPE_META[meta.taskType].label} · ${meta.topic}`;
  const ready = TYPE_META[meta.taskType].ready;
  const body = (
    <>
      <p
        className={cn(
          "truncate leading-snug text-foreground/90 group-hover:text-foreground",
          preview ? "font-serif text-[15px]" : "text-sm font-medium",
        )}
      >
        {title}
      </p>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="rounded-full bg-secondary px-2 py-0.5">
          {preview ? meta.topic : TYPE_META[meta.taskType].label}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5",
            meta.sourceClass === "verificada" && "bg-primary/10 text-primary",
          )}
        >
          {SOURCE_BADGE[meta.sourceClass]}
        </span>
        {meta.duplicate ? (
          <span className="rounded-full bg-secondary px-2 py-0.5">repetida</span>
        ) : null}
        <span>{meta.wordCount} palavras</span>
        {meta.difficulty ? <span>· {DIFFICULTY_LABEL[meta.difficulty]}</span> : null}
        <span className={cn("rounded-full px-2 py-0.5", status.pill)}>{status.label}</span>
        {!ready ? (
          <span className="rounded-full bg-secondary/60 px-2 py-0.5 uppercase tracking-wider">
            em breve
          </span>
        ) : null}
      </p>
    </>
  );
  return (
    <div className="group flex items-start gap-2 border-b border-border/60 px-3 py-2.5 transition-colors last:border-0 hover:bg-secondary/40 sm:gap-3 sm:px-4">
      <span className="w-7 shrink-0 pt-2 text-right text-xs tabular-nums text-muted-foreground">
        {String(number).padStart(3, "0")}
      </span>
      <SectionIcon section={TYPE_META[meta.taskType].section} size="sm" className="mt-1.5" />
      {ready ? (
        <Link
          to="/practice"
          search={{ q: meta.id }}
          className="block min-h-11 min-w-0 flex-1 rounded-lg py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {body}
        </Link>
      ) : (
        <div className="min-w-0 flex-1 py-1">{body}</div>
      )}
      <button
        type="button"
        aria-label={bookmarked ? "Remover das difíceis" : "Marcar como difícil"}
        aria-pressed={bookmarked}
        onClick={() => onToggleBookmark(meta.id)}
        className={cn(
          "inline-flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-secondary",
          bookmarked ? "text-primary" : "text-muted-foreground/40",
        )}
      >
        <Star className={cn("size-5", bookmarked && "fill-primary")} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
