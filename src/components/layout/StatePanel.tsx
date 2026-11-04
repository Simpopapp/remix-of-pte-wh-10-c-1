import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import { EmptyState } from "@/components/layout/EmptyState";
import { cn } from "@/lib/utils";

interface StatePanelProps {
  variant?: "empty" | "loading" | "error";
  /** Ícone do estado (obrigatório em empty completo; error usa AlertTriangle). */
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Ação primária (botão/link ≥44px) quando existe um próximo passo. */
  action?: ReactNode;
  /** Linha única inline, para estados DENTRO de uma seção (não de página). */
  compact?: boolean;
  className?: string;
}

/**
 * Estado unificado (projeto 17, D17-14): uma única linguagem para vazio,
 * carregando e erro em todo o app.
 *
 * - `empty` completo delega ao EmptyState (projeto 12 — visual mantido).
 * - `loading` = skeleton honesto com anúncio em aria-live.
 * - `error` = tom destructive, ícone de alerta e role="alert".
 * - `compact` = linha inline dentro de uma seção (feedback operacional),
 *   nunca como estado de página inteira.
 */
export function StatePanel({
  variant = "empty",
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: StatePanelProps) {
  if (compact) {
    const isError = variant === "error";
    const CompactIcon = isError ? AlertTriangle : Icon;
    return (
      <div
        role={isError ? "alert" : variant === "loading" ? "status" : undefined}
        aria-live={variant === "loading" ? "polite" : undefined}
        aria-busy={variant === "loading" || undefined}
        className={cn(
          "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm",
          isError
            ? "border-destructive/40 bg-destructive/5 text-foreground"
            : "border-border/60 bg-secondary/50 text-foreground",
          className,
        )}
      >
        {CompactIcon ? (
          <CompactIcon
            aria-hidden
            className={cn("mt-0.5 size-4 shrink-0", isError ? "text-destructive" : "text-primary")}
          />
        ) : null}
        <span className="min-w-0 break-words font-medium">{title}</span>
        {description ? (
          <span className="min-w-0 text-xs font-normal text-muted-foreground">{description}</span>
        ) : null}
        {action ? <span className="ml-auto shrink-0">{action}</span> : null}
      </div>
    );
  }

  if (variant === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className={cn("rounded-2xl border border-border/60 bg-card p-5 shadow-card", className)}
      >
        <div aria-hidden className="space-y-3">
          <div className="h-4 w-1/3 rounded-full bg-secondary motion-safe:animate-pulse" />
          <div className="h-3 w-2/3 rounded-full bg-secondary motion-safe:animate-pulse" />
          <div className="h-3 w-1/2 rounded-full bg-secondary motion-safe:animate-pulse" />
        </div>
        <p className="sr-only">{title}</p>
      </div>
    );
  }

  if (variant === "error") {
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-col items-center rounded-2xl border border-destructive/40 bg-card px-6 py-10 text-center shadow-card",
          className,
        )}
      >
        <span
          aria-hidden
          className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"
        >
          <AlertTriangle className="size-6" strokeWidth={2} />
        </span>
        <h2 className="mt-4 font-serif text-lg font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    );
  }

  // empty completo = visual do EmptyState (fonte única do vazio de página).
  return (
    <EmptyState
      icon={Icon!}
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}
