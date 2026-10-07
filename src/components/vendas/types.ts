// Tipos locais da UI do Relatório de Vendas.

export interface HotmartProductOption {
  product_id: string;
  product_name: string;
  // Travar a seleção numa única conta Hotmart: o refresh busca credenciais uma
  // vez só, pelo account_id da visualização.
  account_id: string;
}
