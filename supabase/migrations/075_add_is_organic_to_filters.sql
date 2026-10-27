-- Captacao organica: evento cujo objetivo e captar leads, nao vender o produto de captura.
-- Idempotente. Linhas existentes ficam is_organic = false (eventos pagos).
-- NAO mexe em hotmart_products: o switch apenas ignora os produtos, nunca os apaga.
ALTER TABLE dash_gestao_filters
ADD COLUMN IF NOT EXISTS is_organic boolean NOT NULL DEFAULT false;
