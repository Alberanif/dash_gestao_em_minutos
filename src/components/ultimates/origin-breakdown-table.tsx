"use client";

import { fmtPercent1 } from "@/lib/ultimates/format";
import type { OriginBreakdownBlock } from "@/lib/ultimates/origin-breakdown";

export interface OriginBreakdownTableProps {
  blocks: OriginBreakdownBlock[] | null;
  loading: boolean;
  // Falha no cruzamento. A base de inscritos vive FORA da fila de migrations
  // deste repo e pode sumir ou ser renomeada sem aviso; quando isso acontece a
  // seção diz, em vez de desaparecer. "Sumiu" é indistinguível de "ainda não
  // foi implementado", e o gestor não descobriria que perdeu o dado.
  error: boolean;
}

// "Não encontrados": compra cujo email não está na base de inscritos. Base e
// conversão ficam "—" porque não existe denominador para quem, por definição,
// não está na base — não é dado faltando, é pergunta sem sentido.
const NAO_ENCONTRADOS = "Não encontrados";

export function OriginBreakdownTable({ blocks, loading, error }: OriginBreakdownTableProps) {
  if (error) {
    return (
      <p
        data-testid="ultimates-origin-error"
        style={{ fontSize: 13, color: "var(--red)", margin: 0 }}
      >
        Não foi possível cruzar com a base de inscritos.
      </p>
    );
  }

  if (loading || blocks === null) {
    return (
      <div
        data-testid="ultimates-origin-loading"
        style={{
          height: 180,
          background: "var(--surface-2)",
          borderRadius: 11,
          animation: "pulse 1.5s ease-in-out infinite",
        }}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {blocks.map((block) => (
        <div
          key={block.key}
          data-testid={`ultimates-origin-block-${block.key}`}
          className="ult-origin-card"
        >
          <h4 className="ult-origin-title">{block.title}</h4>
          <div className="ult-origin-scroll">
            <table className="ult-origin-table">
              <thead>
                <tr>
                  <th scope="col">Origem</th>
                  <th scope="col" className="ult-origin-num">Compras</th>
                  <th scope="col" className="ult-origin-num">Base</th>
                  <th scope="col" className="ult-origin-num">Conversão</th>
                </tr>
              </thead>
              <tbody>
                {block.rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="ult-origin-empty">
                      Nenhum inscrito na base
                    </td>
                  </tr>
                )}
                {block.rows.map((row) => (
                  <tr key={row.origin ?? "__nao_encontrados__"}>
                    <th scope="row" className="ult-origin-label">
                      {row.origin ?? NAO_ENCONTRADOS}
                    </th>
                    <td className="ult-origin-num">{row.purchases}</td>
                    <td className="ult-origin-num">{row.base ?? "—"}</td>
                    <td className="ult-origin-num ult-origin-strong">
                      {row.conversion === null ? "—" : fmtPercent1(row.conversion)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
