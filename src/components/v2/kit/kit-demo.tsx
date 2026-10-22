"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  Surface,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
} from "@/components/v2/ui";
import { CountUp, FilterTransition, useReducedMotion } from "@/components/v2/motion";

// Estados forçados por classe, só para validação visual no kit.
const hover = "before:opacity-100";
const focoForcado = "outline-2 outline-offset-2 outline-v2-azul-luz";

const periodos = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "x", label: "Indisponível", disabled: true },
];

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium text-v2-azul-luz">{titulo}</h2>
      {children}
    </section>
  );
}

function Estado({ nome, children }: { nome: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2">
      {children}
      <span className="text-xs text-v2-nevoa/60">{nome}</span>
    </div>
  );
}

export function KitDemo() {
  const reduced = useReducedMotion();
  const [periodo, setPeriodo] = useState("30");
  const [valor, setValor] = useState(12840);

  return (
    <div className="max-w-5xl space-y-10 py-4">
      <header>
        <p className="text-sm text-v2-nevoa/70">
          Movimento reduzido: {reduced ? "ativo (trocas instantâneas)" : "desligado"}
        </p>
      </header>

      <Secao titulo="Botão">
        {(["primario", "secundario", "fantasma"] as const).map((v) => (
          <div key={v} className="flex flex-wrap items-end gap-6">
            <Estado nome={`${v}, repouso`}>
              <Button variante={v}>Salvar</Button>
            </Estado>
            <Estado nome="hover">
              <Button variante={v} className={hover}>
                Salvar
              </Button>
            </Estado>
            <Estado nome="foco">
              <Button variante={v} className={focoForcado}>
                Salvar
              </Button>
            </Estado>
            <Estado nome="desabilitado">
              <Button variante={v} disabled>
                Salvar
              </Button>
            </Estado>
          </div>
        ))}
      </Secao>

      <Secao titulo="Card de superfície">
        <div className="grid gap-4 sm:grid-cols-2">
          <Surface>
            <p className="text-sm text-v2-nevoa/70">Nível 1, repouso</p>
          </Surface>
          <Surface nivel={2}>
            <p className="text-sm text-v2-nevoa/70">Nível 2, elevado</p>
          </Surface>
        </div>
      </Secao>

      <Secao titulo="Select">
        <div className="flex flex-wrap items-end gap-6">
          <Estado nome="repouso">
            <Select aria-label="Período" value={periodo} onValueChange={setPeriodo} opcoes={periodos} />
          </Estado>
          <Estado nome="foco">
            <Select aria-label="Período em foco" value={periodo} onValueChange={setPeriodo} opcoes={periodos} />
          </Estado>
          <Estado nome="desabilitado">
            <Select aria-label="Período desabilitado" value="7" opcoes={periodos} disabled />
          </Estado>
        </div>
      </Secao>

      <Secao titulo="Popover, dialog e tooltip">
        <div className="flex flex-wrap items-end gap-6">
          <Estado nome="popover">
            <Popover>
              <PopoverTrigger asChild>
                <Button variante="secundario">Abrir popover</Button>
              </PopoverTrigger>
              <PopoverContent>
                <p className="text-sm">Conteúdo do popover. Esc fecha e o foco volta ao botão.</p>
              </PopoverContent>
            </Popover>
          </Estado>
          <Estado nome="dialog">
            <Dialog>
              <DialogTrigger asChild>
                <Button variante="secundario">Abrir dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle className="text-xl font-medium">Confirmar ação</DialogTitle>
                <DialogDescription className="mt-2 text-sm text-v2-nevoa/70">
                  O foco fica preso aqui dentro até você fechar.
                </DialogDescription>
                <div className="mt-6 flex justify-end">
                  <DialogClose asChild>
                    <Button>Fechar</Button>
                  </DialogClose>
                </div>
              </DialogContent>
            </Dialog>
          </Estado>
          <Estado nome="tooltip">
            <Tooltip conteudo="Aparece no hover e no foco por teclado">
              <Button variante="fantasma">Passe o mouse</Button>
            </Tooltip>
          </Estado>
        </div>
      </Secao>

      <Secao titulo="Tabs">
        <Tabs defaultValue="a">
          <TabsList aria-label="Exemplo de abas">
            <TabsTrigger value="a">Visão geral</TabsTrigger>
            <TabsTrigger value="b">Campanhas</TabsTrigger>
            <TabsTrigger value="c" disabled>
              Desabilitada
            </TabsTrigger>
          </TabsList>
          <TabsContent value="a" className="pt-4 text-sm">
            Conteúdo da visão geral. Setas esquerda e direita trocam de aba.
          </TabsContent>
          <TabsContent value="b" className="pt-4 text-sm">
            Conteúdo das campanhas.
          </TabsContent>
        </Tabs>
      </Secao>

      <Secao titulo="Movimento">
        <div className="flex flex-wrap items-center gap-6">
          <Surface className="min-w-48">
            <p className="text-sm text-v2-nevoa/70">CountUp</p>
            <p className="mt-1 text-4xl font-light">
              <CountUp value={valor} />
            </p>
          </Surface>
          <Button variante="secundario" onClick={() => setValor((v) => v + 3200)}>
            Somar 3.200
          </Button>
          <Button variante="fantasma" onClick={() => setValor(12840)}>
            Reiniciar
          </Button>
        </div>
        <div className="space-y-3">
          <Select aria-label="Filtro da transição" value={periodo} onValueChange={setPeriodo} opcoes={periodos} />
          <FilterTransition filtroKey={periodo}>
            <Surface>
              <p className="text-sm">Conteúdo do filtro: {periodos.find((p) => p.value === periodo)?.label}</p>
            </Surface>
          </FilterTransition>
        </div>
      </Secao>
    </div>
  );
}
