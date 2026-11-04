# prd-project15-s3 — auditoria técnica

- Escopo: src/lib (AppState v8, backup/merge, progress-overview, session), src/server/gateway.ts, src/lib/plus/*functions*, public/sw.js, src/test + scripts/e2e.
- Critério de aceite: 5 seções (integridade · performance · robustez · testes · smells), ≤30 linhas cada, cada finding com file:line e impacto explicado; findings priorizáveis (rank explícito).
- Restrições: verificar invariantes do AGENTS.md (idempotência do merge, precache gerado pelo build, seletores finos, IA server-only) antes de apontar violações.
- Gates: nenhum claim sem evidência; top findings acionáveis como fases de melhoria.
