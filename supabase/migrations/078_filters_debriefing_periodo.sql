-- Periodo de vendas do produto principal (Debriefing), separado do periodo do evento.
-- Opcional: null nos dois = o Debriefing segue o periodo do dashboard.
-- Idempotente: pode rodar mais de uma vez. Nao altera linhas existentes.
ALTER TABLE dash_gestao_filters
  ADD COLUMN IF NOT EXISTS debriefing_start_date date,
  ADD COLUMN IF NOT EXISTS debriefing_end_date date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_filter_debriefing_periodo'
  ) THEN
    ALTER TABLE dash_gestao_filters
      ADD CONSTRAINT chk_filter_debriefing_periodo CHECK (
        (debriefing_start_date IS NULL AND debriefing_end_date IS NULL)
        OR (debriefing_start_date IS NOT NULL AND debriefing_end_date IS NOT NULL
            AND debriefing_start_date <= debriefing_end_date)
      );
  END IF;
END $$;
