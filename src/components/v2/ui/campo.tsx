import { forwardRef, useId } from "react";
import { cx, foco } from "./cx";

const controle =
  "h-10 w-full rounded-v2-sm bg-v2-casco-alto px-3 text-sm text-v2-nevoa shadow-v2-1 ring-1 ring-inset ring-v2-azul-luz/15 " +
  "placeholder:text-v2-nevoa/40 disabled:pointer-events-none disabled:opacity-40 aria-[invalid=true]:ring-v2-queda/70";

/** Campo de texto, e-mail, senha ou data, no mesmo acabamento do Select. */
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx(controle, "scheme-dark", foco, className)} {...rest} />;
});

type CampoProps = {
  rotulo: string;
  /** Texto de apoio ou de erro, ligado ao controle por aria-describedby. */
  ajuda?: string;
  erro?: boolean;
  className?: string;
  /** Recebe os atributos de acessibilidade que ligam o controle ao rótulo. */
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => React.ReactNode;
};

/** Rótulo + controle + ajuda. O controle chega por função para receber id e aria sem prop drilling. */
export function Campo({ rotulo, ajuda, erro, className, children }: CampoProps) {
  const id = useId();
  const idAjuda = ajuda ? `${id}-ajuda` : undefined;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-v2-nevoa/70">
        {rotulo}
      </label>
      {children({ id, "aria-describedby": idAjuda, ...(erro ? { "aria-invalid": true as const } : {}) })}
      {ajuda && (
        <p id={idAjuda} className={cx("text-xs", erro ? "text-v2-queda" : "text-v2-nevoa/55")}>
          {ajuda}
        </p>
      )}
    </div>
  );
}
