# Overview

## What this is

**Gacha Optimizer** (repo: `genshin-optimizer`) is an [Nx](https://nx.dev) monorepo that hosts a family of static, client-side web applications that help players of HoYoverse gacha action-RPGs min-max their characters' gear, plus a Discord bot that surfaces the same game data.

There is no proprietary backend/API server: everything ships as statically-built websites. Game data is generated **at build time** from datamine sources (git submodules) and bundled into the client bundles; optimization ("solving" for the best gear) runs **in the browser**.

## Products

| App | Path | Game | Status | Live site |
|---|---|---|---|---|
| Genshin Optimizer | [apps/frontend](/apps/frontend/) | Genshin Impact | Mature/stable, uses legacy "Waverider" calc engine | https://frzyc.github.io/genshin-optimizer |
| Star Rail Optimizer | [apps/sr-frontend](/apps/sr-frontend/) | Honkai: Star Rail | WIP, uses new "Pando" engine | (linked from main site) |
| Zenless Optimizer | [apps/zzz-frontend](/apps/zzz-frontend/) | Zenless Zone Zero | Alpha, bare-bones calc engine | https://frzyc.github.io/zenless-optimizer |
| Somnia bot | [apps/somnia](/apps/somnia/) | GI / SR | WIP | Discord bot |

Each frontend is an independent single-page app (own `index.html`, `main.tsx`, `App.tsx`) but they all share the same UI kit, database layer pattern, i18n setup, and (increasingly) the same "Pando" calculation engine.

## Tech stack

- **Language**: TypeScript (strict mode), React 18
- **UI**: Material UI (MUI) v5 + Emotion styling
- **Build**: Vite (web apps), esbuild (Somnia bot), bundled/orchestrated by Nx 22
- **Monorepo tooling**: Nx (task graph, caching, affected builds), Yarn 3 (Berry) as package manager
- **Testing**: Vitest (unit), Cypress (E2E for `frontend`)
- **Lint/format**: Biome (via `@genshin-optimizer/biome` Nx plugin) + Prettier
- **Data validation**: Zod schemas for imported/exported game-data formats
- **i18n**: i18next (browser + fs/http backends)
- **Bot**: discord.js v14
- **OCR**: tesseract.js, used client-side for scanning artifacts/discs from screenshots

## Repository layout

```
apps/           deployable applications (websites + bot + their e2e test projects)
libs/           all shared code, organized by domain (common, game-opt, pando, gi, sr, zzz)
plugin/biome/   custom Nx plugin wiring Biome as the lint/format executor
tools/scripts/  one-off Node scripts (e.g. Node version check)
types/          ambient TypeScript type declarations (css modules, object overrides)
```

Path aliases (`tsconfig.base.json`) map every library to `@genshin-optimizer/<domain>/<lib>`, e.g. `@genshin-optimizer/gi/formula` → `libs/gi/formula/src/index.ts`. Imports across the codebase always use these aliases, never relative paths across library boundaries.

## Getting started

Requires **Node 24.x** (pinned in [.nvmrc](/.nvmrc), enforced by a preinstall check) and **Yarn 3.4.1** (pinned via `packageManager` in `package.json` and `yarnPath` in `.yarnrc.yml` — any global Yarn/Corepack delegates to this vendored version automatically). See [local-development.md](local-development.md) for the full setup/troubleshooting guide.

```bash
fnm use                                # or: nvm use — switch to Node 24
yarn                                    # install deps (Yarn 3.4.1 Berry)
yarn reload-dm                         # init git submodules (datamine sources)
yarn run nx serve frontend             # dev server for GI app, http://localhost:4200
yarn run nx serve sr-frontend          # dev server for Star Rail app
yarn run nx serve zzz-frontend         # dev server for Zenless app
yarn run nx serve somnia               # run the Discord bot locally
```

Common workspace-wide tasks:

```bash
yarn build-all      # nx run-many -t build        (build every app/lib)
yarn test           # nx run-many -t test          (Vitest across the repo)
yarn gen-file       # nx run-many -t gen-file      (regenerate stats/*_gen.json from datamines)
yarn mini-ci        # format → typecheck → lint → test, limited to affected projects
yarn update-dm      # git submodule update --remote (pull latest datamine data)
nx graph            # interactive dependency graph of every project
```

## Where to go next

- [local-development.md](local-development.md) — prerequisites, first-time setup, running the bot, testing, troubleshooting
- [architecture.md](architecture.md) — how data flows from raw game datamines to the optimizer UI
- [module-map.md](module-map.md) — a directory map of every app/lib and what it's for
- [external-api-reference.md](external-api-reference.md) — every external system this repo integrates with
