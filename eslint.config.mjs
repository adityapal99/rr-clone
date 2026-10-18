import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // supabase/functions is a separate Deno codebase (its own runtime,
    // module resolution, and import maps -- see supabase/functions/deno.json
    // and each function's own deno.json) linted and type-checked by `deno
    // lint` / `deno check`, not by this Next.js/Node-oriented config. Rules
    // like no-explicit-any and import/no-anonymous-default-export fire on
    // patterns that are correct and idiomatic there (a deliberately widened
    // Supabase client type, the `export default { fetch }` shape Supabase's
    // own function generator produces) but wrong for app code.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
