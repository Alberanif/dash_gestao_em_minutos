"use client";

import { useId, useMemo, useState } from "react";
import { LineChart, type SerieLinha } from "../../../charts";
import { Button, Surface, Tabela, Td, Th } from "../../../ui";
import { corDaVariante } from "./blocos";
import { diaCurto, diaParaData, num, pct } from "./formatar";
import type { PontoDaSerie, ResultadoAb } from "./tipos";

type Metrica = "conversao" | "visitantes" | "leads";

const METRICAS: ReadonlyArray<{ id: Metrica; rotulo: string; titulo: string }> = [
  { id: "conversao", rotulo: "Conversão", titulo: "Conversão por dia" },
  { id: "visitantes", rotulo: "Visitantes", titulo: "Visitantes por dia" },
  { id: "leads", rotulo: "Leads", titulo: "Leads por dia" },
];

const formatar = (m: Metrica) => (m === "conversao" ? (n: number) => pct(n, 1) : (n: number) => num(Math.round(n * 100) / 100));

export function GraficoDiario({ dados }: { dados: ResultadoAb }) {
  const vars = dados.variantes;
  const [metrica, setMetrica] = useState<Metrica>("conversao");
  const [tabela, setTabela] = useState(false);
  const idTabela = useId();
  const atual = METRICAS.find((m) => m.id === metrica) ?? METRICAS[0];
  const fmt = formatar(metrica);

  const dias = useMemo(() => {
    const s = new Set<string>();
    for (const v of vars) for (const p of v.serie ?? []) s.add(p.dia);
    return [...s].sort();
  }, [vars]);

  const series = useMemo<SerieLinha[]>(
    () =>
      vars.map((v) => ({
        id: v.id,
        label: `${v.rotulo}${v.controle ? " (controle)" : ""}`,
        cor: corDaVariante(vars, v.id),
        data: (v.serie ?? []).map((p: PontoDaSerie) => ({ x: diaParaData(p.dia), y: p[metrica] })),
      })),
    [vars, metrica],
  );

  const valorDoDia = (id: string, dia: string): number | null => {
    const p = vars.find((v) => v.id === id)?.serie?.find((x) => x.dia === dia);
    return p ? p[metrica] : null;
  };

  return (
    <Surface>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-base font-bold text-v2-nevoa">Dia a dia</h2>
          <p className="m-0 mt-1 text-xs text-v2-nevoa/60">Dias no fuso de São Paulo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div role="group" aria-label="Métrica do gráfico" className="flex gap-1">
            {METRICAS.map((m) => (
              <Button
                key={m.id}
                variante={m.id === metrica ? "primario" : "secundario"}
                aria-pressed={m.id === metrica}
                className="h-9 px-3"
                onClick={() => setMetrica(m.id)}
              >
                {m.rotulo}
              </Button>
            ))}
          </div>
          <Button variante="secundario" className="h-9 px-3" aria-expanded={tabela} aria-controls={idTabela} onClick={() => setTabela((t) => !t)}>
            {tabela ? "Ver gráfico" : "Ver tabela"}
          </Button>
        </div>
      </div>
      <div id={idTabela}>
        {dias.length === 0 ? (
          <p role="status" className="m-0 text-sm text-v2-nevoa/65">
            Sem eventos no período.
          </p>
        ) : tabela ? (
          <Tabela aria-label={atual.titulo}>
            <thead>
              <tr>
                <Th>Dia</Th>
                {vars.map((v) => (
                  <Th key={v.id} className="text-right">
                    {v.rotulo}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dias.map((d) => (
                <tr key={d}>
                  <Td>{diaCurto(d)}</Td>
                  {vars.map((v) => {
                    const x = valorDoDia(v.id, d);
                    return (
                      <Td key={v.id} className="text-right tabular-nums">
                        {x == null ? "—" : fmt(x)}
                      </Td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </Tabela>
        ) : (
          <LineChart titulo={atual.titulo} series={series} formatarY={fmt} area={false} animKey={metrica} />
        )}
      </div>
    </Surface>
  );
}
