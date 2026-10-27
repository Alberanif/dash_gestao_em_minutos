import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // O V2 é isolado: nada fora de src/app/v2 e src/components/v2 pode importá-lo.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/app/v2/**", "src/components/v2/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/v2", "@/app/v2/**", "@/components/v2", "@/components/v2/**", "**/v2", "**/v2/**"],
              message: "O V1 não pode importar de v2/ (ver PRD #250).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
