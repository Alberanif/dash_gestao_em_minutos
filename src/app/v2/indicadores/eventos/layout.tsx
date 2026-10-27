import "@/components/v2/indicadores/menu.css";
import "@/components/v2/eventos/pastas.css";
import { BotaoVoltarIcone } from "@/components/v2/ui/voltar-icone";
import { ChegadaEventos } from "@/components/v2/eventos/chegada";

// A lista de eventos chega "por dentro" do card Funis: começa um pouco maior e assenta.
// Vindo do dashboard, ela faz o contrário (zoom out).
export default function EventosLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChegadaEventos>
      <div className="mb-6">
        <BotaoVoltarIcone href="/v2/indicadores" rotulo="Voltar aos indicadores" />
      </div>
      {children}
    </ChegadaEventos>
  );
}
