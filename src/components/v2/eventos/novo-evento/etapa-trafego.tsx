"use client";

import { Button, Input } from "../../ui";
import type { PropsEtapa } from "./estado";

export function EtapaTrafego({ estado, atualizar }: PropsEtapa) {
  const { termos } = estado;
  const mudar = (i: number, valor: string) => atualizar({ termos: termos.map((t, j) => (j === i ? valor : t)) });
  const remover = (i: number) => atualizar({ termos: termos.filter((_, j) => j !== i) });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-v2-nevoa">Tráfego</h3>
        <p className="text-sm text-v2-nevoa/65">
          Etapa opcional: o dashboard soma as campanhas do Meta Ads cujo nome contém o termo, sem diferenciar
          maiúsculas de minúsculas.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {termos.map((termo, i) => (
          <li key={i} className="flex items-end gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label htmlFor={`novo-evento-termo-${i}`} className="text-[13px] font-medium text-v2-nevoa/70">
                Termo {i + 1}
              </label>
              <Input
                id={`novo-evento-termo-${i}`}
                className="h-11"
                placeholder="Ex.: imersao-mentoria"
                value={termo}
                onChange={(e) => mudar(i, e.target.value)}
              />
            </div>
            {termos.length > 1 && (
              <Button
                variante="secundario"
                className="h-11 min-w-11"
                aria-label={`Remover termo ${i + 1}`}
                onClick={() => remover(i)}
              >
                Remover
              </Button>
            )}
          </li>
        ))}
      </ul>

      <div>
        <Button variante="fantasma" className="h-11" onClick={() => atualizar({ termos: [...termos, ""] })}>
          Adicionar termo
        </Button>
      </div>
    </div>
  );
}
