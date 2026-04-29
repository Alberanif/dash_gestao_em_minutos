CREATE TABLE IF NOT EXISTS public.dash_gestao_eqa_eventos_comercial (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  lead_events    text[] NOT NULL DEFAULT '{}',
  campaign_terms text[] NOT NULL DEFAULT '{}',
  campaign_ids   text[] NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dash_gestao_eqa_eventos_comercial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read eqa_eventos_comercial"
  ON public.dash_gestao_eqa_eventos_comercial
  FOR SELECT TO authenticated USING (true);
