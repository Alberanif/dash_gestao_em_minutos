import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(__dirname, "../../../..");
const eslintBin = path.join(root, "node_modules/eslint/bin/eslint.js");

function lint(code: string, filename: string) {
  const r = spawnSync(
    process.execPath,
    [eslintBin, "--stdin", "--stdin-filename", filename, "--format", "json"],
    { cwd: root, input: code, encoding: "utf8" },
  );
  const out = JSON.parse(r.stdout) as { messages: { ruleId: string | null }[] }[];
  return out[0].messages.filter((m) => m.ruleId === "no-restricted-imports");
}

jest.setTimeout(60_000);

describe("isolamento do V2 no lint", () => {
  it("arquivo do V1 que importa de v2/ é reprovado", () => {
    expect(lint('import { x } from "@/components/v2/tokens";\nexport const y = x;\n', "src/app/indicadores/teste.ts")).toHaveLength(1);
    expect(lint('import x from "../v2/page";\nexport const y = x;\n', "src/app/indicadores/teste.ts")).toHaveLength(1);
  });

  it("arquivos dentro de v2 podem importar de v2", () => {
    expect(lint('import { x } from "@/components/v2/tokens";\nexport const y = x;\n', "src/app/v2/teste.ts")).toHaveLength(0);
  });
});
