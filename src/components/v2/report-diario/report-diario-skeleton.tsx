import { cx } from "../ui/cx";
import { ALTURA_CARD_REPORT } from "./report-diario-card";

const bloco = "v2-esq rounded-v2-sm bg-v2-casco-alto/60";

/** Esqueleto de um card do Report Diário, com a mesma altura mínima do card real. */
export function ReportDiarioSkeleton() {
  return (
    <div
      className={cx("flex flex-col gap-3 rounded-v2-md bg-v2-casco p-4 shadow-v2-1 ring-1 ring-inset ring-v2-azul-luz/15 @3xl:max-w-sm", ALTURA_CARD_REPORT)}
      aria-hidden="true"
      data-testid="report-diario-skeleton"
    >
      <div className="flex items-center gap-3">
        <div className={cx(bloco, "size-8 rounded-full")} />
        <div className={cx(bloco, "h-4 w-2/3")} />
      </div>
      <div className="mt-auto space-y-2">
        <div className={cx(bloco, "h-3 w-24")} />
        <div className={cx(bloco, "h-8 w-32")} />
      </div>
      <div className="grid grid-cols-2 gap-3 pt-3">
        <div className={cx(bloco, "h-8")} />
        <div className={cx(bloco, "h-8")} />
      </div>
    </div>
  );
}
