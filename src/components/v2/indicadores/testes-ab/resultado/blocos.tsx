"use client";

import Link from "next/link";
import { FunnelChart } from "../../../charts";
import { corSerie } from "../../../charts/palette";
import { Selo, Surface, Tabela, Td, Th, type TomDoSelo } from "../../../ui";
import { dataBR, dataHoraBR, num, pct, textoHoras } from "./formatar";
import { DIMENSOES, type EstadoDoTeste, type ResultadoAb, type VarianteDoResultado } from "./tipos";

const ESTADOS: Record<EstadoDoTeste, { rotulo: string; tom: TomDoSelo }> = {
  rascunho: { rotulo: "Rascunho", tom: "neutro" },
  ativo: { rotulo: "Ativo", tom: "ok" },
  encerrado: { rotulo: "Encerrado", tom: "info" },
};

/** Cor da variante: fixa pela posição na ordem dos rótulos, não muda com o filtro. */
export function corDaVariante(vars: ReadonlyArray<VarianteDoResultado>, id: string): string {
  return corSerie(Math.max(0, vars.findIndex((v) => v.id === id)));
}

function Marca({ v, vars }: { v: VarianteDoResultado; vars: ReadonlyArray<VarianteDoResultado> }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold text-v2-abismo"
      style={{ background: corDaVariante(vars, v.id) }}
    >
      {v.rotulo}
    </span>
  );
}

function Titulo({ children, dica }: { children: React.ReactNode; dica?: string }) {
  return (
    <div className="mb-3">
      <h2 className="m-0 text-base font-bold text-v2-nevoa">{children}</h2>
      {dica && <p className="m-0 mt-1 text-xs text-v2-nevoa/60">{dica}</p>}
    </div>
  );
}

export function Cabecalho({ dados }: { dados: ResultadoAb }) {
  const t = dados.teste;
  const ini = dataBR(t.iniciado_em);
  const fim = dataBR(t.encerrado_em);
  const datas =
    t.status === "rascunho" ? "Ainda não iniciado" : `${ini || "—"}${t.status === "encerrado" ? ` a ${fim || "—"}` : " até agora"}`;
  const estado = ESTADOS[t.status] ?? ESTADOS.rascunho;
  const venc = dados.variantes.find((v) => v.id === t.vencedor_variante);
  return (
    <Surface className="flex flex-col gap-3">
      <Link href="/v2/indicadores/testes-ab" className="w-fit text-sm text-v2-azul-luz underline-offset-2 hover:underline">
        ← Voltar para os testes
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-xl font-bold text-v2-nevoa">{t.nome}</h1>
        <Selo tom={estado.tom}>{estado.rotulo}</Selo>
        <span className="text-sm text-v2-nevoa/70">{datas}</span>
      </div>
      {t.status === "encerrado" && (
        <p className="m-0 text-sm text-v2-nevoa/85">
          <strong>{venc ? `Vencedor registrado: ${venc.rotulo}` : "Encerrado sem diferença entre as variantes"}</strong>
          {t.anotacao ? ` · ${t.anotacao}` : ""}
        </p>
      )}
      {t.status === "rascunho" && (
        <p className="m-0 text-sm text-v2-nevoa/75">
          O teste ainda é um rascunho: nenhum evento é contado até ele ser iniciado.
        </p>
      )}
    </Surface>
  );
}

export function Comparativo({ dados }: { dados: ResultadoAb }) {
  const vars = dados.variantes;
  const vencId = dados.veredito.resultado === "vencedor" ? dados.veredito.vencedor_id : null;
  return (
    <Surface>
      <Titulo dica="Conversão = leads ÷ visitantes únicos. Lead é o envio do formulário, não uma confirmação.">Comparativo</Titulo>
      <div className="grid gap-3 sm:grid-cols-2">
        {vars.map((v) => {
          const r = v.estatistica?.diferenca_rel;
          let dif: React.ReactNode = <span className="text-v2-nevoa/60">sem base de comparação</span>;
          if (v.controle) dif = <span className="text-v2-nevoa/60">Controle</span>;
          else if (r != null) {
            dif =
              r > 0 ? (
                <span className="text-v2-alta">▲ +{pct(r, 1)} vs controle</span>
              ) : r < 0 ? (
                <span className="text-v2-queda">▼ {pct(r, 1)} vs controle</span>
              ) : (
                <span className="text-v2-nevoa/60">{pct(r, 1)} vs controle</span>
              );
          }
          return (
            <div
              key={v.id}
              data-testid="variante"
              data-vencedora={v.id === vencId ? "true" : undefined}
              className={`flex flex-col gap-2 rounded-v2-sm bg-v2-casco-alto p-4 ring-1 ring-inset ${v.id === vencId ? "ring-v2-alta/60" : "ring-v2-azul-luz/15"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Marca v={v} vars={vars} />
                <b className="text-sm text-v2-nevoa">Variante {v.rotulo}</b>
                {v.controle && <Selo tom="info">Controle</Selo>}
                {v.id === vencId && <Selo tom="ok">Vencedora</Selo>}
              </div>
              <span className="break-words text-xs text-v2-nevoa/65" title={v.url ?? ""}>
                {v.pagina ?? v.url ?? ""}
              </span>
              <div>
                <small className="block text-xs text-v2-nevoa/60">Conversão</small>
                <span className="text-2xl font-bold text-v2-nevoa">{pct(v.conversao, 2)}</span>
              </div>
              <span className="text-sm">{dif}</span>
              <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
                <dt className="text-v2-nevoa/65">Visualizações</dt>
                <dd className="m-0 text-right tabular-nums text-v2-nevoa">{num(v.visualizacoes)}</dd>
                <dt className="text-v2-nevoa/65">Visitantes únicos</dt>
                <dd className="m-0 text-right tabular-nums text-v2-nevoa">{num(v.unicos)}</dd>
                <dt className="text-v2-nevoa/65">Novos / recorrentes</dt>
                <dd className="m-0 text-right tabular-nums text-v2-nevoa">
                  {num(v.novos)} / {num(v.recorrentes)}
                </dd>
                <dt className="text-v2-nevoa/65">Leads</dt>
                <dd className="m-0 text-right tabular-nums text-v2-nevoa">{num(v.leads)}</dd>
              </dl>
            </div>
          );
        })}
      </div>
    </Surface>
  );
}

export function Veredito({ dados }: { dados: ResultadoAb }) {
  const ve = dados.veredito;
  const vars = dados.variantes;
  const conf = pct(ve.confianca_minima ?? 0.95, 0);
  const faltam = Math.max(0, ...vars.map((v) => v.estatistica?.faltam ?? 0));
  const venc = ve.resultado === "vencedor" ? vars.find((v) => v.id === ve.vencedor_id) : undefined;
  const ctrl = vars.find((v) => v.id === ve.controle_id);

  let tom: TomDoSelo = "neutro";
  let titulo = "Ainda sem diferença significativa";
  let texto = "Com os dados de agora não dá para dizer que uma página é melhor que a outra.";
  if (venc) {
    const e = venc.estatistica;
    tom = "ok";
    titulo = `A variante ${venc.rotulo} venceu`;
    texto = `${venc.rotulo} está ${pct(e?.diferenca_rel, 1)} melhor que ${ctrl ? ctrl.rotulo : "o controle"}, com confiança de ${pct(e?.confianca, 1)} (mínimo exigido: ${conf}).`;
  } else if (ve.resultado === "cedo_demais") {
    tom = "aviso";
    titulo = "Cedo demais para decidir";
    texto = `Ainda não há visitantes suficientes (mínimo de ${num(ve.amostra_minima)} por variante para a conta valer).`;
    if (faltam > 0) texto += ` Faltam cerca de ${num(faltam)} visitantes por variante.`;
  } else if (faltam > 0) {
    texto += ` Faltam cerca de ${num(faltam)} visitantes por variante para detectar uma diferença desse tamanho.`;
  }
  const melhor = Math.max(0, ...vars.map((v) => v.estatistica?.confianca ?? 0));
  return (
    <Surface>
      <Titulo>Veredito</Titulo>
      <div className="flex flex-col gap-2" data-testid="veredito" data-resultado={ve.resultado}>
        <div className="flex flex-wrap items-center gap-2">
          <Selo tom={tom}>{venc ? "Vencedor" : ve.resultado === "cedo_demais" ? "Cedo demais" : "Sem diferença"}</Selo>
          <h3 className="m-0 text-base font-semibold text-v2-nevoa">{titulo}</h3>
        </div>
        <p className="m-0 text-sm text-v2-nevoa/85">{texto}</p>
        {!venc && melhor > 0 && (
          <p className="m-0 text-xs text-v2-nevoa/60">
            Maior confiança hoje: {pct(melhor, 1)} (mínimo exigido: {conf}).
          </p>
        )}
        {ve.avisos?.length > 0 && (
          <ul className="m-0 list-disc pl-5 text-sm text-v2-nevoa/75">
            {ve.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
      </div>
    </Surface>
  );
}

export function Cortes({ dados }: { dados: ResultadoAb }) {
  const vars = dados.variantes;
  const secoes = DIMENSOES.map((d) => {
    const valores = new Map<string, Map<string, VarianteDoResultado["cortes"][number]>>();
    for (const v of vars) {
      for (const c of v.cortes ?? []) {
        if (c.dimensao !== d.chave) continue;
        const k = c.valor == null || c.valor === "" ? "(não informado)" : c.valor;
        if (!valores.has(k)) valores.set(k, new Map());
        valores.get(k)!.set(v.id, c);
      }
    }
    const total = (k: string) => [...valores.get(k)!.values()].reduce((s, c) => s + (c.visitantes || 0), 0);
    const chaves = [...valores.keys()].sort((a, b) => total(b) - total(a));
    return { d, valores, chaves };
  }).filter((s) => s.chaves.length > 0);

  return (
    <Surface>
      <Titulo dica="Origem, dispositivo e país de cada variante. Públicos diferentes entre A e B podem distorcer o resultado: confira se a mistura é parecida.">
        Cortes
      </Titulo>
      {secoes.length === 0 && <p className="m-0 text-sm text-v2-nevoa/65">Sem dados para recortar ainda.</p>}
      <div className="flex flex-col gap-5">
        {secoes.map(({ d, valores, chaves }) => (
          <section key={d.chave} aria-label={d.rotulo} data-testid={`corte-${d.chave}`}>
            <h3 className="m-0 mb-2 text-sm font-semibold text-v2-nevoa">{d.rotulo}</h3>
            <Tabela>
              <thead>
                <tr>
                  <Th>{d.curto}</Th>
                  {vars.map((v) => (
                    <Th key={v.id} className="text-right">
                      {v.rotulo} · visitantes / leads / conv.
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chaves.slice(0, 15).map((k) => (
                  <tr key={k}>
                    <Td>{k}</Td>
                    {vars.map((v) => {
                      const c = valores.get(k)!.get(v.id);
                      return (
                        <Td key={v.id} className="whitespace-nowrap text-right tabular-nums">
                          {c ? `${num(c.visitantes)} / ${num(c.leads)} / ${pct(c.conversao, 1)}` : "0 / 0 / —"}
                        </Td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </Tabela>
            {chaves.length > 15 && (
              <p className="m-0 mt-1 text-xs text-v2-nevoa/60">Mostrando os 15 maiores de {chaves.length}.</p>
            )}
          </section>
        ))}
      </div>
    </Surface>
  );
}

export function Funil({ dados }: { dados: ResultadoAb }) {
  const vars = dados.variantes;
  return (
    <Surface>
      <Titulo dica="Visitantes únicos que chegaram a cada etapa. Quem envia sem ter focado no campo pode passar direto para a última.">
        Funil
      </Titulo>
      <div className="grid gap-4 sm:grid-cols-2">
        {vars.map((v) => (
          <div key={v.id} className="flex min-w-0 flex-col gap-2" data-testid="funil-variante">
            <div className="flex items-center gap-2">
              <Marca v={v} vars={vars} />
              <b className="text-sm text-v2-nevoa">Variante {v.rotulo}</b>
            </div>
            <FunnelChart
              titulo={`Funil da variante ${v.rotulo}`}
              formatarValor={num}
              etapas={[
                { id: "visitaram", label: "Visitaram", value: v.funil?.visitaram ?? 0 },
                { id: "comecaram", label: "Começaram a preencher", value: v.funil?.comecaram ?? 0 },
                { id: "enviaram", label: "Enviaram o formulário", value: v.funil?.enviaram ?? 0 },
              ]}
            />
          </div>
        ))}
      </div>
    </Surface>
  );
}

export function Saude({ dados }: { dados: ResultadoAb }) {
  const vars = dados.variantes;
  const ativo = dados.teste.status === "ativo";
  const limite = dados.horas_sem_evento_alerta;
  return (
    <Surface>
      <Titulo
        dica={`Confirma que o rastreamento está chegando de cada página${ativo ? "" : " (só avisa quando o teste está ativo)"}. Sem eventos há horas costuma ser snippet ausente ou URL cadastrada diferente da real.`}
      >
        Saúde da instalação
      </Titulo>
      <div className="flex flex-col gap-2">
        {vars.map((v) => {
          const s = v.saude;
          const alerta = !!s?.alerta;
          return (
            <div
              key={v.id}
              data-testid="saude"
              data-alerta={alerta ? "true" : "false"}
              role={alerta ? "alert" : undefined}
              className={`flex flex-wrap items-start gap-3 rounded-v2-sm p-3 text-sm ring-1 ring-inset ${alerta ? "bg-v2-queda/10 ring-v2-queda/40" : "bg-v2-casco-alto ring-v2-azul-luz/15"}`}
            >
              <Marca v={v} vars={vars} />
              <div className="min-w-0 flex-1">
                <p className="m-0 text-v2-nevoa">
                  <strong>{alerta ? "Atenção" : "Tudo certo"}</strong>{" "}
                  {!s?.ultimo_evento
                    ? "Nenhum evento recebido ainda."
                    : `Último evento ${textoHoras(s.horas_sem_evento)} (${dataHoraBR(s.ultimo_evento)}).`}
                </p>
                {alerta && (
                  <p className="m-0 mt-1 text-v2-queda">
                    {s?.ultimo_evento
                      ? `Sem eventos há ${num(s.horas_sem_evento)} h (limite: ${num(limite)} h). Confira se o snippet está na página.`
                      : `Sem eventos (limite: ${num(limite)} h). Confira se o snippet está na página e se a URL cadastrada é a mesma da página.`}
                  </p>
                )}
                <p className="m-0 mt-1 break-all text-xs text-v2-nevoa/55">{v.url ?? ""}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Surface>
  );
}
