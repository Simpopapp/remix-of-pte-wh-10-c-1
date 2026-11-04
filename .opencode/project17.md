# Project 17 — Planejamento (fonte de verdade do escopo)

> Mensagem do usuário (diretriz original, colada verbatim):
> "planejar e executar melhorias significativas de aparecia em todas as paginas
> e recursos do app, priorizando mobile first e visando um melhor fluxo de
> usabilidade do ponto de vista visual e de layout"

## O que isso significa (decodificação da diretriz)

1. **Escopo global**: não é um recurso novo — é uma varredura de aparência e
   layout por TODAS as rotas e superfícies do app (home, índices, superfícies
   de estudo, foco pós-conclusão, vocabulário, progresso, simulado, settings,
   onboarding/erro). Nenhuma página fica de fora.
2. **Mobile-first**: o recorte 390×844 é a referência primária; desktop é
   adaptação, não o contrário. Touch targets, densidade, hierarquia em telas
   pequenas, sheets/bottom sheets, uma mão só.
3. **Fluxo de usabilidade visual e de layout**: não é só "bonito" — é
   navegação mais clara, hierarquia de informação, consistência de espaçamento
   e tipografia, estados vazios/carregando/erro visualmente polidos, transições
   que guiam o olho, e coerência do design system entre superfícies.

## Direção e ordem lógica

- Primeiro AUDITAR o estado atual (varredura por rota, 390×844 + desktop):
  inconsistências de tokens, espaçamentos, tipografia, touch targets, overflow,
  hierarquia fraca, estados brutos, fluxos com fricção visual.
- Depois FIXAR A FUNDAÇÃO: melhorias no design system (tokens, tipografia,
  escala de espaçamento, sombras, raios, transições) que elevam todas as
  páginas de uma vez, sem quebrar as regras existentes (Fraunces+Inter, tokens
  papel/tinta/índigo/âmbar, PageHeader widths, regra âmbar D14-6b).
- Depois APLICAR por grupos de rotas (home/navegação → índices → superfícies de
  estudo → vocabulário/progresso → foco/pós-conclusão → estados), sempre
  verificando com gates (vitest, tsgo, build, lint, Playwright com axe e 390×844).
- FECHAR com E2E versionado e varredura final AAA.

## Restrições que vêm do projeto (não violar)

- Regras do AGENTS.md: PageHeader widths (5xl/4xl/3xl/2xl), selos âmbar com
  text-warning-ink, ícones só lucide-react, fontes via <link> no __root,
  design tokens em src/styles.css, nada de cor fora do sistema sem registro.
- Não reescrever lógica de negócio: esta é uma mudança de apresentação e
  layout; comportamento, rotas e dados ficam intactos (ajustes de UI que
  tocam componentes podem mexer em markup/aria, mas não em regras).
- Mobile-first: cada mudança é avaliada primeiro em 390×844.
