# Project 18 — Planejamento (fonte de verdade do escopo)

> Mensagem do usuário (diretriz original, colada verbatim):
> "investigar e planejar melhorias significativas e de alto impacto pro app de
> maneira geral tendo em vista o proposito central bem como demais aspectos"

## O que isso significa (decodificação da diretriz)

1. **Investigar primeiro**: o projeto 18 nasce de um estudo honesto do app como
   ele está — propósito central, o que já funciona bem, onde o valor real
   fica, e onde há lacunas entre o que o app promete (preparação PTE) e o que
   entrega (recursos, prática, correção IA, simulado, SRS, progresso).
2. **Planejar em seguida**: melhorias SIGNIFICATIVAS e de ALTO IMPACTO — não
   cosmética (o projeto 17 já cobriu aparência/layout mobile-first de ponta a
   ponta). Alto impacto = mexe no valor central de estudo: qualidade da
   prática, feedback/correção, retenção (SRS), simulação fiel do exame,
   progresso que guia decisão, e a confiabilidade/percepção do produto.
3. **De maneira geral**: a varredura cobre todos os aspectos do produto —
   núcleo pedagógico, fluxos de uso, dados/estatísticas, IA, robustez,
   acessibilidade/performance percebida, e lacunas de conteúdo — mas o
   filtro de prioridade é IMPACTO no objetivo do usuário (ganhar nota no
   PTE), não amplitude de alteração.

## Direção e ordem lógica

- AUDITORIA APROFUNDADA do propósito central: o que é o app (preparação PTE
  com prática, correção IA e simulado), como cada pilar serve a isso, e onde
  a experiência ainda fica aquém (lacunas de conteúdo, feedback, métrica,
  confiabilidade).
- Priorizar por impacto: cada melhoria proposta responde "o usuário fica
  mais perto da nota-alvo com isso?" — melhorias de baixo impacto ficam fora.
- Planejar fases com dependência clara: fundação/avaliação → núcleo de
  prática e feedback → inteligência de progresso → robustez → fechamento
  com E2E e gates.

## Restrições que vêm do projeto (não violar)

- Regras do AGENTS.md raiz (orquestração IA única, tradução IA server-only,
  cache IA v2 antes de rede, integridade de dados do projeto 13, SRS com
  rigor do projeto 15, larguras/receitas UI do projeto 17).
- Comportamento existente e testes (vitest 703, E2E versionados) não podem
  regredir; toda fase passa pelos gates do Plan.md §19.
- Mobile-first 390×844 continua a referência; sem regressão do projeto 17.
