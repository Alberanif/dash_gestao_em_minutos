CREATE TABLE IF NOT EXISTS dash_gestao_convite_projetos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_projeto text NOT NULL,
  data_inicio timestamptz DEFAULT now() NOT NULL,
  data_fm timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE dash_gestao_convite_projetos
ADD COLUMN IF NOT EXISTS grupo text;

UPDATE dash_gestao_convite_projetos
SET grupo = COALESCE(grupo, 'funil_destrave')
WHERE grupo IS NULL;

ALTER TABLE dash_gestao_convite_projetos
ALTER COLUMN grupo SET DEFAULT 'funil_destrave';

ALTER TABLE dash_gestao_convite_projetos
ALTER COLUMN grupo SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dash_gestao_convite_projetos_grupo_check'
  ) THEN
    ALTER TABLE dash_gestao_convite_projetos
    ADD CONSTRAINT dash_gestao_convite_projetos_grupo_check
    CHECK (
      grupo IN (
        'funil_destrave',
        'funil_ads_comercial',
        'ultimate',
        'fcc',
        'mcc',
        'social_seller'
      )
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS dash_gestao_convite_projetos_grupo_nome_idx
ON dash_gestao_convite_projetos (grupo, lower(nome_projeto));
