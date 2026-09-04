# AGENTS.md

Guidance for AI coding agents working in this repo. For deep dives, see [docs/](docs/) — this file only covers what you need to be productive immediately; don't duplicate it elsewhere.

## What this is

Nx monorepo hosting static, client-side optimizer web apps for gacha games (Genshin Impact, Honkai: Star Rail, Zenless Zone Zero) plus a Discord bot. **There is no backend/API server** — game data is generated at build time from git-submodule datamines and bundled; optimization solving runs in the browser. Full details: [docs/overview.md](docs/overview.md), [docs/architecture.md](docs/architecture.md), [docs/module-map.md](docs/module-map.md).

## Environment requirements

- Node **24.x** — pinned in `.nvmrc`, enforced by a `preinstall` script that hard-fails on mismatch.
- Yarn **3.4.1** (Berry, `node-modules` linker) — pinned via `packageManager` + `.yarnrc.yml`; any global Yarn/Corepack auto-delegates to it.
- Full setup/troubleshooting: [docs/local-development.md](docs/local-development.md).

## Essential commands

```bash
yarn                                # install deps
yarn reload-dm                      # init datamine git submodules (needed before gen-file)
yarn run nx serve <frontend|sr-frontend|zzz-frontend|somnia>   # dev server
nx test <project>                   # Vitest for one project, e.g. nx test gi-formula
nx run <project>:lint / :format     # Biome (not ESLint/Prettier directly)
nx run-many -t typecheck
yarn build-all                      # build everything
yarn mini-ci                        # format+typecheck+lint+test limited to affected projects — run before proposing a PR
nx graph                            # visualize the project dependency graph
```

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs `lint`, `test`, `format`, `typecheck`, and `gen-file` as separate jobs — `yarn mini-ci` approximates all of them locally against `master`.

## Repo structure & conventions

- `apps/` — deployable apps only (routing/build config). `libs/<domain>/<lib>` — all real code, where `<domain>` is `common`, `game-opt`, `pando`, `gi`, `sr`, or `zzz`. See [docs/module-map.md](docs/module-map.md) for what each lib does.
- **Always import via the package alias**, never deep-relative across libs: `import { x } from '@genshin-optimizer/gi/stats'`, not `../../../gi/stats/src/...`. This is enforced by a Biome `noRestrictedImports` rule (`../**/src/**` is banned) — the linter will catch violations.
- Each game domain (`gi`/`sr`/`zzz`) mirrors the same lib set (`dm`, `stats`, `formula`, `solver`, `db`, `db-ui`, `page-*`, `ui`, `theme`, `i18n`) and is architecturally parallel — don't add cross-game imports (`gi/*` importing `sr/*`, etc.); share code via `common/*`, `game-opt/*`, or `pando/*` instead.
- Two calculation engines coexist: legacy "Waverider" (`libs/gi/wr`, deprecated, GI-only) and the newer "Pando" (`libs/pando/engine`, used by SR/ZZZ and mid-migration into GI). Check which one a GI file uses before editing formula code.
- Code style is enforced by Biome, not Prettier/ESLint: single quotes, no semicolons, 2-space indent, 80-col width, trailing commas. Don't hand-format against these rules — run `nx run <project>:format`.
- Tests are colocated with source as `*.test.ts` or `*.spec.ts` (both conventions exist), run with Vitest.
- Generated files (`*_gen.json`, `libs/gi/stats/Data/**`, locale JSON under `localization/assets/locales`) are build outputs of `gen-file` — don't hand-edit them; change the generator instead.
- Whenever there is source code changes that affect design, MUST create/update documents to record it.

## Common pitfalls

- Missing/stale game data at runtime almost always means datamine submodules aren't initialized (`yarn reload-dm`) or stats weren't regenerated (`yarn gen-file`).
- `apps/somnia` (Discord bot) needs a git-ignored `src/config.json` (copy from `config.empty.json`) with a real bot token to run.
- Only run one frontend dev server at a time — they default to the same port (4200).

## Full documentation

| Doc | Covers |
|---|---|
| [docs/overview.md](docs/overview.md) | Products, tech stack, high-level getting-started |
| [docs/architecture.md](docs/architecture.md) | Data flow, engine layering, Nx task graph |
| [docs/module-map.md](docs/module-map.md) | What every app/lib does |
| [docs/external-api-reference.md](docs/external-api-reference.md) | External services/submodules consumed |
| [docs/local-development.md](docs/local-development.md) | Setup, running apps/bot, testing, troubleshooting |
