// Tipos locais da tela de Relatório de Vendas na V2.

export interface ProdutoHotmart {
  product_id: string;
  product_name: string;
  // Travar a seleção numa única conta Hotmart: o refresh busca credenciais uma
  // vez só, pelo account_id da visualização.
  account_id: string;
}

export interface CicloNaoMigrado {
  id: string;
  name: string;
}
