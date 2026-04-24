CREATE TABLE IF NOT EXISTS public.dash_gestao_convite_funil_ads_comercial_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  convite_project_id uuid NOT NULL REFERENCES public.dash_gestao_convite_projetos(id) ON DELETE CASCADE,
  hotmart_account_id uuid NULL REFERENCES public.dash_gestao_accounts(id) ON DELETE SET NULL,
  hotmart_product_ids text[] NOT NULL DEFAULT '{}'::text[],
  meta_ads_account_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  campaign_terms text[] NOT NULL DEFAULT '{}'::text[],
  organic_lead_events text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT dash_gestao_convite_funil_ads_comercial_projects_pkey PRIMARY KEY (id),
  CONSTRAINT dash_gestao_convite_funil_ads_comercial_projects_convite_project_id_key UNIQUE (convite_project_id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS dash_gestao_convite_funil_ads_comercial_projects_project_idx
ON public.dash_gestao_convite_funil_ads_comercial_projects (convite_project_id);

CREATE INDEX IF NOT EXISTS dash_gestao_convite_funil_ads_comercial_projects_hotmart_products_idx
ON public.dash_gestao_convite_funil_ads_comercial_projects
USING gin (hotmart_product_ids);

CREATE INDEX IF NOT EXISTS dash_gestao_convite_funil_ads_comercial_projects_meta_accounts_idx
ON public.dash_gestao_convite_funil_ads_comercial_projects
USING gin (meta_ads_account_ids);

CREATE INDEX IF NOT EXISTS dash_gestao_convite_funil_ads_comercial_projects_campaign_terms_idx
ON public.dash_gestao_convite_funil_ads_comercial_projects
USING gin (campaign_terms);

CREATE INDEX IF NOT EXISTS dash_gestao_convite_funil_ads_comercial_projects_organic_events_idx
ON public.dash_gestao_convite_funil_ads_comercial_projects
USING gin (organic_lead_events);
