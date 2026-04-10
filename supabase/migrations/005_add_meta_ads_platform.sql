-- Adiciona 'meta-ads' como valor válido na constraint de plataforma
ALTER TABLE public.dash_gestao_accounts
  DROP CONSTRAINT dash_gestao_accounts_platform_check;

ALTER TABLE public.dash_gestao_accounts
  ADD CONSTRAINT dash_gestao_accounts_platform_check CHECK (
    platform = ANY (ARRAY[
      'youtube'::text,
      'instagram'::text,
      'hotmart'::text,
      'meta-ads'::text
    ])
  );
