// Projeto 15 (D15-0d): validador ÚNICO do envelope de backup, usado por
// `previewBackup` (backup.ts) e `importBackup` (storage.ts). Módulo folha:
// nenhum import de storage/backup (evita ciclo). Raízes não-objeto (null,
// arrays, strings) voltam como erro de validação — nunca exceção.
export const BACKUP_APP = "pte-master-hub";
export const BACKUP_VERSIONS: number[] = [2, 3, 4, 5, 6, 7, 8];

export function parseBackupEnvelope(
  json: string,
): { ok: true; obj: Record<string, unknown> } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "o arquivo não é um JSON válido" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "este arquivo não é um backup deste app" };
  }
  const obj = parsed as Record<string, unknown>;
  const isCurrent = obj["app"] === BACKUP_APP && BACKUP_VERSIONS.includes(obj["version"] as number);
  const isLegacy = obj["app"] === "readaloud-trainer";
  if (!isCurrent && !isLegacy) {
    return { ok: false, error: "este arquivo não é um backup deste app" };
  }
  if (!Array.isArray(obj["attempts"])) {
    return { ok: false, error: "histórico de tentativas inválido" };
  }
  if (!Array.isArray(obj["bookmarks"])) {
    return { ok: false, error: "lista de favoritos inválida" };
  }
  return { ok: true, obj };
}
