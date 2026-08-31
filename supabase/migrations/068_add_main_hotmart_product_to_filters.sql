-- Adiciona a coluna main_hotmart_product (jsonb) para armazenar o Produto Principal no dashboard de indicadores
ALTER TABLE dash_gestao_filters
ADD COLUMN IF NOT EXISTS main_hotmart_product jsonb DEFAULT null;
