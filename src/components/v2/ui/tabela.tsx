import { cx } from "./cx";

/** Tabela de dados. Rola na horizontal dentro do próprio quadro, sem estourar a página no celular. */
export function Tabela({ className, ...rest }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-v2-md ring-1 ring-inset ring-v2-azul-luz/15">
      <table className={cx("w-full border-collapse text-left text-sm", className)} {...rest} />
    </div>
  );
}

export function Th({ className, ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cx("whitespace-nowrap bg-v2-casco-alto px-4 py-2.5 text-xs font-semibold text-v2-nevoa/70", className)}
      {...rest}
    />
  );
}

export function Td({ className, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cx("border-t border-v2-azul-luz/10 px-4 py-3 align-middle", className)} {...rest} />;
}
