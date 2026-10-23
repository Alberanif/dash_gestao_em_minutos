# Orçamento de desempenho da V2

Origem: PRD #250 (seção 4) e issue #257.

## O que é medido

| O quê | Limite | Quem mede | Bloqueia o PR |
|---|---|---|---|
| JS inicial (gzip) de cada rota `/v2/*` | 180 KB (`180 * 1024` bytes) | `scripts/check-v2-bundle.mts` | Sim |
| LCP, TBT e CLS de `/v2` | LCP abaixo de 2 s no desktop | Lighthouse (`scripts/lighthouse-summary.mts`) | Não, só relatório |

As duas medições rodam no workflow `.github/workflows/v2-orcamento.yml`, em todo PR que mexe em `src/`, `package*.json`, `next.config.ts` ou `tsconfig.json`.

### Como o JS inicial é contado

O script lê o resultado de `next build` em `.next/server/app/v2/**` e, para cada rota, soma o gzip dos arquivos `.js` que o navegador baixa antes de qualquer interação:

- o runtime do Next e do Turbopack (`rootMainFiles`);
- os chunks dos layouts e dos componentes client da rota.

Ficam de fora:

- **Polyfills.** O Next os emite com `noModule`, então navegador moderno nem baixa.
- **O que carrega sob demanda.** Todo chunk listado em `react-loadable-manifest.json` (ou seja, vindo de `next/dynamic`) não conta. É assim que o chunk do WebGL do herói (#260) fica fora do limite, como o PRD pede. **Regra:** o WebGL tem de ser importado com `next/dynamic` (ou `import()` dentro de `useEffect`), nunca por import estático.

O gzip é calculado com o nível padrão do Node (6), próximo do que a Vercel entrega. A medição vale para toda rota nova sob `src/app/v2/`, sem configurar nada: o script descobre as rotas pelos manifests.

O script falha também quando não encontra nenhuma rota `/v2`, para o job não passar em silêncio se o caminho do build mudar.

## Rodar localmente

```bash
npm run build
npm run check:v2-bundle
```

Precisa de Node 24 ou mais novo (o script roda com remoção nativa de tipos). A tabela sai no terminal e o relatório completo, com o tamanho de cada arquivo, em `.next/v2-bundle-report.json`. Outra pasta de build: `node scripts/check-v2-bundle.mts <distDir>`.

Para ver o que pesa dentro de uma rota, use o analisador do Next: `npx next analyze`.

### Lighthouse

```bash
npm run build
npx next start -p 3000
# em outro terminal
npx lighthouse@12.8.2 http://localhost:3000/v2 --only-categories=performance \
  --output=json --output=html --output-path=lighthouse/v2 \
  --extra-headers='{"Cookie":"<cookies de sessão de uma conta gestora>"}'
node scripts/lighthouse-summary.mts lighthouse/v2.report.json
```

Sem o cookie, `/v2` redireciona para `/login` e o relatório mede o login, não o V2. O resumo avisa quando isso acontece.

No CI, o cookie vem do secret `LIGHTHOUSE_COOKIE` (formato `nome=valor; nome2=valor2`). Enquanto o secret não existir, o job de Lighthouse roda, mas mede o login.

**INP:** o Lighthouse em modo de navegação não mede INP, porque ele depende de interação real. O relatório traz o TBT como aproximação de laboratório. O INP real fica para teste manual ou para o Playwright da camada 3 do PRD.

## Se o JS estourar

Ordem do corte, definida no PRD (seção 4):

1. **Tirar o Supabase client do navegador.** O servidor já busca a primeira carga, então o cliente só precisa dele se o usuário trocar filtros ou precisar de sessão no browser. Trocar por chamadas às rotas `/api/indicadores/*`.
2. Carregar sob demanda (`next/dynamic`) o que só aparece depois da primeira pintura: gráficos fora da tela, diálogos, popovers.
3. Revisar as importações de `visx` e `motion`, que aceitam importar só o submódulo usado.

Medido na fundação (#251), a página `/v2` vazia já pesa cerca de 132 KB, quase tudo React e Next. Sobram cerca de 48 KB para todo o resto, então o orçamento é apertado e a medição precisa rodar desde a primeira rota.
