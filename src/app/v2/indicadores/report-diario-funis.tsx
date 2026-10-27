import type { ReportDiarioMapa } from "@/lib/indicadores/report-diario-tipos";
import { ReportDiarioCarrossel } from "@/components/v2/report-diario/report-diario-carrossel";
import { hrefDoEvento } from "@/components/v2/eventos/pastas";

/**
 * Carrossel do Report Diário, lido de uma promessa única compartilhada pela página.
 * Funil ausente do mapa (consulta inteira falhou) cai no mesmo "indisponível" da falha por funil.
 */
export async function ReportDiarioFunis({
  funis,
  mapa,
}: {
  funis: { id: string; name: string }[];
  mapa: Promise<ReportDiarioMapa>;
}) {
  const relatorio = await mapa;
  const itens = funis.map((f) => ({ id: f.id, nome: f.name, href: hrefDoEvento(f.id), funil: relatorio[f.id] ?? null }));
  return <ReportDiarioCarrossel itens={itens} />;
}
