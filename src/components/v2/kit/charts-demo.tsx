"use client";

import { useMemo, useState } from "react";
import { Button, Select, Surface } from "@/components/v2/ui";
import { BarChart, DonutChart, FunnelChart, LineChart, Sparkline, formatarValor } from "@/components/v2/charts";

// Dados de exemplo determinísticos (nada de Math.random: servidor e cliente geram o mesmo).
function prng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function serieDiaria(dias: number, base: number, seed: number, inicio = Date.UTC(2026, 8, 1)) {
  const r = prng(seed);
  let v = base;
  return Array.from({ length: dias }, (_, i) => {
    v = Math.max(0, v + (r() - 0.45) * base * 0.12);
    return { x: new Date(inicio + i * 86_400_000), y: Math.round(v) };
  });
}

const periodos = [
  { value: "14", label: "Últimos 14 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "60", label: "Últimos 60 dias" },
];

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium text-v2-azul-luz">{titulo}</h2>
      {children}
    </section>
  );
}

function Cartao({ nome, children }: { nome: string; children: React.ReactNode }) {
  return (
    <Surface className="min-w-0 space-y-3">
      <p className="text-sm text-v2-nevoa/70">{nome}</p>
      {children}
    </Surface>
  );
}

export function ChartsDemo() {
  const [periodo, setPeriodo] = useState("30");
  const [pesado, setPesado] = useState(false);
  const dias = Number(periodo);

  const receita = useMemo(() => serieDiaria(dias, 1200, 7), [dias]);
  const gasto = useMemo(() => serieDiaria(dias, 500, 11), [dias]);
  const leads = useMemo(() => serieDiaria(dias, 90, 3), [dias]);
  const muitos = useMemo(
    () =>
      Array.from({ length: 5000 }, (_, i) => ({
        x: new Date(Date.UTC(2026, 0, 1) + i * 3_600_000),
        y: 800 + Math.sin(i / 60) * 220 + ((i * 37) % 90),
      })),
    [],
  );

  return (
    <main className="mx-auto max-w-5xl space-y-10 p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-light">Gráficos V2</h1>
        <p className="text-sm text-v2-nevoa/70">
          Dados de exemplo. O ponto âmbar marca o último valor de cada linha.
        </p>
      </header>

      <Secao titulo="Linha e área">
        <Select aria-label="Período" value={periodo} onValueChange={setPeriodo} opcoes={periodos} />
        <div className="grid gap-6 md:grid-cols-2">
          <Cartao nome="Uma série, com área">
            <LineChart titulo="Receita diária" series={[{ id: "receita", label: "Receita", data: receita }]} />
          </Cartao>
          <Cartao nome="Duas séries">
            <LineChart
              titulo="Receita e gasto"
              series={[
                { id: "receita", label: "Receita", data: receita },
                { id: "gasto", label: "Gasto", data: gasto },
              ]}
            />
          </Cartao>
          <Cartao nome="Sem dados">
            <LineChart titulo="Série vazia" series={[{ id: "vazia", label: "Vazia", data: [] }]} />
          </Cartao>
          <Cartao nome="Um único ponto">
            <LineChart
              titulo="Ponto único"
              series={[{ id: "um", label: "Leads", data: [{ x: new Date(Date.UTC(2026, 9, 1)), y: 42 }] }]}
            />
          </Cartao>
        </div>
        <Cartao nome={pesado ? "5 mil pontos" : "5 mil pontos (carregar sob demanda)"}>
          {pesado ? (
            <LineChart titulo="5 mil pontos" series={[{ id: "pesado", label: "Visitas por hora", data: muitos }]} />
          ) : (
            <Button variante="secundario" onClick={() => setPesado(true)}>
              Renderizar 5 mil pontos
            </Button>
          )}
        </Cartao>
      </Secao>

      <Secao titulo="Barras">
        <div className="grid gap-6 md:grid-cols-2">
          <Cartao nome="Colunas">
            <BarChart
              titulo="Leads por origem"
              data={[
                { id: "meta", label: "Meta", value: 4200 },
                { id: "google", label: "Google", value: 2300 },
                { id: "yt", label: "YouTube", value: 1450 },
                { id: "ig", label: "Instagram", value: 980 },
                { id: "org", label: "Orgânico", value: 610 },
              ]}
            />
          </Cartao>
          <Cartao nome="Barras horizontais">
            <BarChart
              titulo="Vendas por produto"
              orientacao="horizontal"
              data={[
                { id: "a", label: "Imersão completa", value: 320 },
                { id: "b", label: "Mentoria", value: 140 },
                { id: "c", label: "Curso base", value: 96 },
              ]}
            />
          </Cartao>
        </div>
      </Secao>

      <Secao titulo="Funil e rosca">
        <div className="grid gap-6 md:grid-cols-2">
          <Cartao nome="Funil de conversão">
            <FunnelChart
              titulo="Do clique à compra"
              etapas={[
                { id: "cliques", label: "Cliques", value: 12800 },
                { id: "leads", label: "Leads", value: 3400 },
                { id: "checkout", label: "Checkout", value: 520 },
                { id: "compras", label: "Compras", value: 210 },
              ]}
            />
          </Cartao>
          <Cartao nome="Rosca (7 fatias: as duas menores viram Outros)">
            <DonutChart
              titulo="Investimento por plataforma"
              rotuloTotal="Investido"
              data={[
                { id: "meta", label: "Meta", value: 9000 },
                { id: "google", label: "Google", value: 4200 },
                { id: "yt", label: "YouTube", value: 2100 },
                { id: "tt", label: "TikTok", value: 1700 },
                { id: "pin", label: "Pinterest", value: 900 },
                { id: "x", label: "X", value: 400 },
                { id: "li", label: "LinkedIn", value: 250 },
              ]}
            />
          </Cartao>
        </div>
      </Secao>

      <Secao titulo="Sparkline em tile de KPI">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { nome: "Leads", valores: leads.map((p) => p.y) },
            { nome: "Receita", valores: receita.map((p) => p.y) },
            { nome: "Sem dados", valores: [] as number[] },
          ].map((k) => (
            <Surface key={k.nome} className="space-y-2">
              <p className="text-sm text-v2-nevoa/70">{k.nome}</p>
              <p className="text-3xl font-light">
                {k.valores.length ? formatarValor(k.valores[k.valores.length - 1]) : "-"}
              </p>
              <Sparkline valores={k.valores} rotulo={k.nome} />
            </Surface>
          ))}
        </div>
      </Secao>
    </main>
  );
}
