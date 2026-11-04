import { redirect } from "next/navigation";

// A V2 é o layout padrão. O next.config já redireciona "/" antes de chegar aqui; esta rota é só a rede de segurança.
export default function RaizPage() {
  redirect("/v2");
}
