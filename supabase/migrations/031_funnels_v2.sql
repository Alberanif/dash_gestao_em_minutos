-- Remodelação dos Funis Ativos (EQA) v2
-- Adiciona suporte para dois tipos de funis: lancamento_pago (vendas) e lancamento (leads)
-- Migra dados existentes do tipo 'destrave' para 'lancamento_pago'

-- Expandir constraint para aceitar os novos tipos
ALTER TABLE dash_gestao_funnels
  DROP CONSTRAINT dash_gestao_funnels_type_check;

ALTER TABLE dash_gestao_funnels
  ADD CONSTRAINT dash_gestao_funnels_type_check
  CHECK (type IN ('destrave', 'lancamento_pago', 'lancamento'));

-- Migrar todas as rows existentes de 'destrave' para 'lancamento_pago'
UPDATE dash_gestao_funnels
  SET type = 'lancamento_pago', updated_at = now()
  WHERE type = 'destrave';

-- Documentar reuso semântico da coluna goal_sales
COMMENT ON COLUMN dash_gestao_funnels.goal_sales IS
  'Para lancamento_pago: meta de vendas. Para lancamento: meta de leads.';
