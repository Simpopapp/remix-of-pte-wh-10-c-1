import type { ReactNode } from "react";

import { usePageFocusTarget } from "@/lib/pageFocus";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Kicker opcional (ex.: nome da seção) em caps pequenas. */
  kicker?: string;
  title: string;
  subtitle?: string;
  /** Ações à direita (botões); empilham em telas estreitas. */
  actions?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho de página padrão (PRD §8): título serif com hierarquia real,
 * subtítulo e ações.
 *
 * Regra de largura de página (projeto 17 — fonte única da regra, vigente):
 *   Home (hero editorial)      → max-w-5xl
 *   Índices de lista/scan      → max-w-4xl  (SectionPage, exam config, progress)
 *   Superfícies de estudo      → max-w-3xl  (practice runner + loading, session
 *                                            config/em andamento, vocabulary,
 *                                            settings, ExamRunner)
 *   Foco único pós-conclusão   → max-w-2xl  (resumo do simulado e da sessão)
 * Gutter de página: `px-4 sm:px-6` em todos os mains e no TopNav (D17-2).
 * O header preenche o contêiner onde for montado; a rota escolhe o nível.
 */
export function PageHeader({ kicker, title, subtitle, actions, className }: PageHeaderProps) {
  // Alvo de foco pós-navegação/skip link (projeto 13, §0.3).
  const h1Ref = usePageFocusTarget<HTMLHeadingElement>();

  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {kicker ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{kicker}</p>
        ) : null}
        <h1
          ref={h1Ref}
          id="page-title"
          tabIndex={-1}
          className="mt-1 font-serif text-3xl font-semibold tracking-tight text-foreground focus:outline-none sm:text-4xl"
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
