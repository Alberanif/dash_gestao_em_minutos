-- Periodo do evento (inicio e fim), definido no modal de criar/editar.
-- Opcional: null nos dois = sem periodo, e o dashboard V2 abre nos ultimos 28 dias.
-- Idempotente: pode rodar mais de uma vez.
ALTER TABLE dash_gestao_filters
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_filter_periodo'
  ) THEN
    ALTER TABLE dash_gestao_filters
      ADD CONSTRAINT chk_filter_periodo CHECK (
        (start_date IS NULL AND end_date IS NULL)
        OR (start_date IS NOT NULL AND end_date IS NOT NULL AND start_date <= end_date)
      );
  END IF;
END $$;
