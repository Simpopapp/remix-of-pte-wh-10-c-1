// D15-6d: extraído de QuestionRow.tsx — módulo folha sem componente, para que o
// arquivo do componente volte a exportar só componentes (react-refresh). A regra
// de cor/estado continua ÚNICA (D14-2e): o rótulo e a cor vêm da mesma função.

import type { QuestionMeta, SourceClass } from "@/lib/pte";
import { isMasteredStat, type QuestionStat } from "@/lib/storage";

/** Selo de proveniência (C2): verificada/comunitária/ia. */
export const SOURCE_BADGE: Record<SourceClass, string> = {
  verificada: "verificada",
  comunitária: "comunitária",
  ia: "IA",
};

export function statusOf(
  stat: QuestionStat | undefined,
  taskType: QuestionMeta["taskType"],
  now: number,
): { label: string; dot: string; pill: string } {
  if (!stat || stat.attempts === 0)
    return {
      label: "não tentada",
      dot: "bg-muted-foreground/40",
      pill: "bg-secondary text-muted-foreground",
    };
  if (isMasteredStat(stat, taskType)) {
    return {
      label: `dominada · ${stat.bestContent}%`,
      dot: "bg-success",
      pill: "bg-success/10 text-success",
    };
  }
  const due = stat.dueAt <= now ? " · revisar" : "";
  if (taskType === "read_aloud" && (stat.bestContent ?? 0) >= 90) {
    return {
      label: `conteúdo ok · ritmo a ajustar${due}`,
      dot: "bg-warning",
      // D15-4a: texto âmbar sobre fundo âmbar translúcido usa --warning-ink (AA nos 2 temas).
      pill: "bg-warning/10 text-warning-ink",
    };
  }
  const best = stat.bestContent ?? 0;
  return {
    label: `melhor ${stat.bestContent}%${due}`,
    dot: best >= 70 ? "bg-warning" : "bg-destructive",
    pill: best >= 70 ? "bg-warning/10 text-warning-ink" : "bg-destructive/10 text-destructive",
  };
}
