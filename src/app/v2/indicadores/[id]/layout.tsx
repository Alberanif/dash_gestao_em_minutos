import "@/components/v2/indicadores/menu.css";

// O dashboard chega "por dentro" do cartão: começa um pouco maior e assenta (zoom in).
export default function EventoLayout({ children }: { children: React.ReactNode }) {
  return <div className="v2-chega">{children}</div>;
}
