-- Adiciona a coluna debriefing_offer_codes (jsonb) para armazenar os códigos de ofertas filtrados no debriefing
ALTER TABLE dash_gestao_filters
ADD COLUMN IF NOT EXISTS debriefing_offer_codes jsonb DEFAULT null;
