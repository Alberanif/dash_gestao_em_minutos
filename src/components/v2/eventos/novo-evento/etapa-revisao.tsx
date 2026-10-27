"use client";

import { Button, Surface } from "../../ui";
import { ETAPAS, termosLimpos, type EtapaId, type Problema, type PropsEtapa } from "./estado";

type PropsRevisao = PropsEtapa & {
  problemas: Problema[];
  aviso: string | null;
  irParaEtapa: (e: EtapaId) => void;
};

function formatarData(d: string): string {
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}/${a}`;
}

const rotuloDaEtapa = (id: EtapaId) => ETAPAS.find((e) => e.id === id)?.rotulo ?? id;

function Bloco({
  titulo,
  etapa,
  irParaEtapa,
  children,
}: {
  titulo: string;
  etapa: EtapaId;
  irParaEtapa: (e: EtapaId) => void;
  children: React.ReactNode;
}) {
  return (
    <Surface className="flex items-start justify-between gap-3 !p-4">
      <div className="min-w-0 flex-1">
        <h4 className="text-[13px] font-medium text-v2-nevoa/70">{titulo}</h4>
        <div className="mt-1.5 flex flex-col gap-1 text-sm text-v2-nevoa">{children}</div>
      </div>
      <Button
        variante="fantasma"
        className="h-11 min-w-11 shrink-0"
        aria-label={`Editar ${titulo}`}
        onClick={() => irParaEtapa(etapa)}
      >
        Editar
      </Button>
    </Surface>
  );
}

const Vazio = ({ children }: { children: React.ReactNode }) => <span className="text-v2-nevoa/55">{children}</span>;

export function EtapaRevisao({ estado, problemas, aviso, irParaEtapa }: PropsRevisao) {
  const termos = termosLimpos(estado.termos);
  const temPeriodo = !!estado.inicio && !!estado.fim;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-v2-nevoa">Revisão</h3>
        <p className="text-sm text-v2-nevoa/65">Confira o que será criado. Dá para editar qualquer etapa.</p>
      </header>

      {problemas.length > 0 && (
        <div role="alert" className="rounded-v2-sm p-4 ring-1 ring-inset ring-v2-queda/60">
          <p className="text-sm font-medium text-v2-queda">Falta resolver antes de criar:</p>
          <ul className="mt-2 flex flex-col gap-2">
            {problemas.map((p, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 text-sm text-v2-nevoa">
                <span className="min-w-0 flex-1">{p.mensagem}</span>
                <Button variante="secundario" className="h-11" onClick={() => irParaEtapa(p.etapa)}>
                  Resolver em {rotuloDaEtapa(p.etapa)}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {aviso && (
        <p role="status" className="rounded-v2-sm bg-v2-casco-alto px-4 py-3 text-sm text-v2-nevoa/80">
          {aviso}
        </p>
      )}

      {problemas.length === 0 && <p className="text-sm text-v2-nevoa/80">Tudo certo: está pronto para criar.</p>}

      <div className="flex flex-col gap-3">
        <Bloco titulo="Nome e período" etapa="identificacao" irParaEtapa={irParaEtapa}>
          <span>{estado.nome.trim() || <Vazio>Sem nome</Vazio>}</span>
          <span className="text-v2-nevoa/75">
            {temPeriodo ? `${formatarData(estado.inicio)} a ${formatarData(estado.fim)}` : "Últimos 28 dias"}
          </span>
        </Bloco>

        <Bloco titulo="Captação" etapa="captacao" irParaEtapa={irParaEtapa}>
          <span>{estado.organico ? "Captação orgânica" : "Evento pago"}</span>
          {estado.organico ? (
            <Vazio>Produtos de captura não usados</Vazio>
          ) : estado.produtosCaptura.length > 0 ? (
            <span className="text-v2-nevoa/75">{estado.produtosCaptura.map((p) => p.product_name).join(", ")}</span>
          ) : (
            <Vazio>Nenhum produto de captura</Vazio>
          )}
          {estado.eventosLeads.length > 0 ? (
            <span className="text-v2-nevoa/75">Leads: {estado.eventosLeads.join(", ")}</span>
          ) : (
            <Vazio>Nenhum evento de Leads</Vazio>
          )}
        </Bloco>

        <Bloco titulo="Produto principal" etapa="produto" irParaEtapa={irParaEtapa}>
          {estado.produtosPrincipais.length > 0 ? (
            estado.produtosPrincipais.map((p) => (
              <span key={p.product_id}>
                {p.product_name}
                <span className="text-v2-nevoa/65">
                  {" - "}
                  {p.offer_codes.length === 0
                    ? "Todas as ofertas"
                    : p.offer_codes.length === 1
                      ? "1 oferta"
                      : `${p.offer_codes.length} ofertas`}
                </span>
              </span>
            ))
          ) : (
            <Vazio>Nenhum produto principal</Vazio>
          )}
        </Bloco>

        <Bloco titulo="Tráfego" etapa="trafego" irParaEtapa={irParaEtapa}>
          {termos.length > 0 ? <span>{termos.join(", ")}</span> : <Vazio>Nenhum termo de campanha</Vazio>}
        </Bloco>
      </div>
    </div>
  );
}
