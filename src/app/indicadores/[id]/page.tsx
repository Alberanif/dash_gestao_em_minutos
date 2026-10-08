import { IndicadoresDashboard } from "../indicadores-dashboard";

// `params` é assíncrono nesta versão do Next. A validação do ID (UUID, existência)
// acontece no dashboard, que já tem a lista de eventos.
export default async function IndicadoresEventoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <IndicadoresDashboard eventId={id} />;
}
