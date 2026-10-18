import { defineConfig } from "vitest/config";
import path from "node:path";

const dirname = import.meta.dirname;

// Scoped to lib/ -- this project's only pure, unit-testable server-side
// logic (the contact-form validation and rate-limit hashing helpers). The
// Next.js route itself, and everything Supabase/Edge-Function-side, is
// exercised via the phase-by-phase manual verification in the README
// instead (mocking Supabase to test the route would mostly test the mock).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "."),
      // See lib/testing/server-only-stub.ts for why this alias exists.
      "server-only": path.resolve(dirname, "lib/testing/server-only-stub.ts"),
    },
  },
  test: {
    include: ["lib/**/*.test.ts"],
  },
});
