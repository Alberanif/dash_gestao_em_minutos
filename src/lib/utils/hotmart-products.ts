// Genérica de propósito: a assinatura literal anterior
// (`{ product_id, product_name }[]`) apagava do tipo estático qualquer campo
// extra do chamador — inclusive o account_id que o modal de ciclo usa para
// travar a seleção numa conta só. Os campos sobreviviam em runtime e sumiam
// na compilação, que é o pior dos dois mundos.
export function sortProductsByName<T extends { product_name: string }>(
  products: T[]
): T[] {
  return [...products].sort((a, b) =>
    a.product_name.localeCompare(b.product_name, "pt-BR")
  );
}
