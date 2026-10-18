// Empty stand-in for the `server-only` package, used only by vitest.config.ts.
//
// `server-only` deliberately throws when imported anywhere it hasn't been
// specifically allow-listed -- in real builds, Next.js's own
// webpack/turbopack config special-cases it to a no-op for server-side
// compilation. Vitest has no equivalent special case, so without this
// alias, every test that imports a "server-only"-guarded module (anything
// under lib/contact, lib/env.ts, lib/supabase/server.ts) would fail with
// server-only's own guard error rather than the test's actual assertions.
export {};
