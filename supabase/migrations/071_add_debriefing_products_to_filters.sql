-- Debriefing com varios produtos principais, cada um com seu filtro de ofertas.
-- Formato: [{ "product_id": "123", "product_name": "Produto A", "offer_codes": ["abc"] }]
-- offer_codes vazio = todas as ofertas do produto.
-- Idempotente: pode rodar mais de uma vez. NAO altera as colunas antigas
-- (main_hotmart_product, debriefing_offer_codes).
ALTER TABLE dash_gestao_filters
ADD COLUMN IF NOT EXISTS debriefing_products jsonb DEFAULT null;

-- O backfill abaixo le debriefing_offer_codes (criada pela 069). Garante que ela
-- exista mesmo em bancos onde a 069 nunca foi aplicada; no-op se ja existir.
ALTER TABLE dash_gestao_filters
ADD COLUMN IF NOT EXISTS debriefing_offer_codes jsonb DEFAULT null;

-- Backfill: so onde ainda nao foi preenchido e existe produto principal.
UPDATE dash_gestao_filters
SET debriefing_products = jsonb_build_array(
  jsonb_build_object(
    'product_id', main_hotmart_product->>'product_id',
    'product_name', main_hotmart_product->>'product_name',
    'offer_codes', coalesce(debriefing_offer_codes, '[]'::jsonb)
  )
)
WHERE debriefing_products IS NULL
  AND main_hotmart_product IS NOT NULL
  AND jsonb_typeof(main_hotmart_product) = 'object';
