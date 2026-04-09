interface DateRangeControlsProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onApply: () => void;
}

export function DateRangeControls({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApply,
}: DateRangeControlsProps) {
  return (
    <div className="flex flex-wrap items-end gap-2 xl:flex-nowrap">
      <label className="flex items-center gap-2 whitespace-nowrap">
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)" }}>
          De
        </span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="field-control h-10 w-[168px] min-w-[168px]"
        />
      </label>

      <label className="flex items-center gap-2 whitespace-nowrap">
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)" }}>
          Até
        </span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="field-control h-10 w-[168px] min-w-[168px]"
        />
      </label>

      <button type="button" onClick={onApply} className="btn-primary h-10 whitespace-nowrap">
        Aplicar
      </button>
    </div>
  );
}
