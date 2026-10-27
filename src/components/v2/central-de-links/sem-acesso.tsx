import { Surface } from "../ui";

export function SemAcessoCentral() {
  return (
    <div className="mx-auto w-full max-w-xl py-10">
      <Surface role="alert">
        <h1 className="m-0 text-xl font-bold">Central de links</h1>
        <p className="mt-2 text-sm text-v2-nevoa/75">
          Você ainda não tem acesso à Central de Links. Peça a um administrador.
        </p>
      </Surface>
    </div>
  );
}
