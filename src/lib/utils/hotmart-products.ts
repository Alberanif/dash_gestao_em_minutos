export function sortProductsByName(
  products: { product_id: string; product_name: string }[]
): { product_id: string; product_name: string }[] {
  return [...products].sort((a, b) =>
    a.product_name.localeCompare(b.product_name, "pt-BR")
  );
}
