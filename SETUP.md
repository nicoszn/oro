# Wiring this in

1. Install:
   npm install @xenova/transformers
   (no database install needed — persistence uses a local JSON file,
   see step 6 below)

2. Move the OpenRouter key: add to `.env.local`
   OPENROUTER_API_KEY=your_key_here
   (rotate the old exposed key on OpenRouter's dashboard first)

3. In `next.config.ts`, transformers.js needs to stay server-side and
   its native/WASM deps excluded from bundling — you already have
   `serverExternalPackages` as a hard rule, so add it there:

   const nextConfig = {
     serverExternalPackages: ['@xenova/transformers'],
   };

4. First call to `embedText()` downloads the MiniLM model (~90MB) to a
   local cache — expect a few seconds of latency on the first request
   after a cold start. `warmEmbeddingModel()` is exported so you can
   call it eagerly (e.g. top of your route.ts module, or an
   instrumentation.ts hook) to pay that cost once instead of on the
   user's first request.

5. Drop-in replacements — these files replace the originals as-is:
   - tiers.ts
   - orchestrator.ts
   - memoryRouter.ts
   - embeddings.ts (new)
   - kmeans.ts (new)
   - corpus.ts (new)
   - similarity.ts (new)
   - localStore.ts (new — active persistence layer)
   - persistence.ts (new — SQLite alternative, not wired in; see below)
   - index.ts

6. `data/hmem-store.json` will be created on first run. Add `data/` to
   `.gitignore` — this is runtime state, not source.

7. Upgrade path: when you're ready for SQLite (better concurrency
   handling, no whole-file rewrite on every save), `persistence.ts`
   already implements the identical interface (`saveT2Vectors`,
   `loadT2Vectors`, `saveGraph`, `loadGraph`, `saveCodebooks`,
   `loadCodebooks`, `setMeta`, `getMeta`, `close`). Swapping is two lines
   in index.ts: change the import and the `new LocalJSONStore()` to
   `new MemoryStore()`. Then follow the better-sqlite3 install/config
   notes further up this file.

## UI streaming + redesign (this round)

1. Install the two new UI packages:
   npm install framer-motion lucide-react

2. Files replaced/added:
   - types.ts — added `EngineEvent`, `EmitFn`, `RoutingDecision` types
   - memoryRouter.ts — now returns structured `RoutingDecision[]` instead
     of preformatted strings
   - orchestrator.ts — emits an event at every internal step (turn start,
     routing decision, schema extraction, graph insert/connect, LLM call
     start/end, retrieval, turn complete)
   - index.ts — `runSimulation(onEvent?)` threads the emit callback through
   - route.ts — now a Server-Sent Events stream (`text/event-stream`)
     instead of a single JSON response; has `export const dynamic =
     'force-dynamic'` so it's never statically cached
   - HmemPage.tsx — full redesign, consumes the SSE stream via
     `EventSource`, updates UI live per event
   - globals.css — loads the fonts the UI actually uses (previous version
     referenced Space Grotesk/DM Mono in Tailwind classes without ever
     importing them)

3. No changes needed to page.tsx — it still just renders `<HmemPage />`.

4. Why SSE and not `fetch` + manual chunking: Next.js route handlers can
   return a `ReadableStream` directly, and `EventSource` on the client
   handles reconnection/parsing for you. If you later need the client to
   POST data to start a run (not just GET), swap `EventSource` for the
   `fetch-event-source` package, since native `EventSource` is GET-only.

5. Design direction: moved off the generic dark-background-plus-one-
   accent look. Three tiers get three distinct accent hues (amber/teal/
   plum) that map to their actual role, not decoration — T1's amber bar
   is a real token-budget gauge, T2/T3's colored packets are real routing
   decisions streaming in, not placeholder motion.

