# Module Map

All libraries are imported via the `@genshin-optimizer/<domain>/<name>` path alias (see `tsconfig.base.json`), where `<domain>` is the top-level folder under `libs/` (`common`, `game-opt`, `pando`, `gi`, `sr`, `zzz`).

## apps/

| App | Description |
|---|---|
| [frontend](/apps/frontend/) | Genshin Optimizer website (React + Vite + MUI). Legacy "Waverider" calc engine. Entry: `src/main.tsx` → `src/app/App.tsx`, which lazy-loads `@genshin-optimizer/gi/page-*` routes. |
| [frontend-e2e](/apps/frontend-e2e/) | Cypress E2E tests for `frontend`. |
| [sr-frontend](/apps/sr-frontend/) | Star Rail Optimizer website. Uses the Pando engine. Same structure as `frontend`, backed by `@genshin-optimizer/sr/*` libs. |
| [zzz-frontend](/apps/zzz-frontend/) | Zenless Optimizer website (alpha). Backed by `@genshin-optimizer/zzz/*` libs. |
| [somnia](/apps/somnia/) | Discord bot (discord.js). Bundled with esbuild to CJS. Entry: `src/main.ts`. Serves game data lookups (archive command) and hosts an HTTP health-check listener (port 8080) for its Azure Web App host. |
| [somnia-e2e](/apps/somnia-e2e/) | Vitest-based E2E tests for `somnia`. |

## libs/common/ — shared across every game

| Lib | Purpose |
|---|---|
| [ad](/libs/common/ad/) | Ad/monetization components (banner, rail-sticky, ad-block detection wrapper). |
| [database](/libs/common/database/) | Generic client-side database/state-management abstraction reused by every game's `*/db` lib. |
| [database-ui](/libs/common/database-ui/) | React bindings (hooks/context) for `common/database`. |
| [img-util](/libs/common/img-util/) | Image processing helpers. |
| [localization](/libs/common/localization/) | i18next setup + locale strings shared by all apps. |
| [pipeline](/libs/common/pipeline/) | Build-time data pipeline helpers: fetch, transform/extrapolate, generic utils — used by every `*/stats`/`*/dm` generator. |
| [plugin](/libs/common/plugin/) | Custom Nx executors, notably `sync-repo` (backs the `load-dm` target that clones/updates datamine submodules). |
| [react-util](/libs/common/react-util/) | Shared React hooks/utilities. |
| [svgicons](/libs/common/svgicons/) | Shared SVG icon components. |
| [ui](/libs/common/ui/) | Shared MUI theme base + generic UI components. |
| [util](/libs/common/util/) | Generic utility functions (clamp, unit/value formatting, dev-mode checks, etc.). |

## libs/game-opt/ — generic (cross-game) optimization layer

| Lib | Purpose |
|---|---|
| [engine](/libs/game-opt/engine/) | Generic calculation-engine glue built on `pando/engine`. |
| [formula](/libs/game-opt/formula/) | Generic formula-builder utilities (`genshinCalculatorWithValues`/`...WithEntries`) reused by each game's `*/formula` lib. |
| [formula-ui](/libs/game-opt/formula-ui/) | Generic UI for visualizing formula/computation graphs. |
| [sheet-ui](/libs/game-opt/sheet-ui/) | Spreadsheet-style UI component for tabular data. |
| [solver](/libs/game-opt/solver/) | Generic optimization solver core (`OptProblemInput`, solving/search logic) reused by each game's `*/solver`. |

## libs/pando/ — core computation engine

| Lib | Purpose |
|---|---|
| [engine](/libs/pando/engine/) | The successor calculation engine: tag-based computation graph with nodes, custom operations, and range/monotonicity tracking (used for solver pruning). Powers SR and ZZZ formulas, and is the target of GI's ongoing migration off the legacy Waverider engine. |

## libs/gi/ — Genshin Impact

Data & schema:
- [consts](/libs/gi/consts/) — character/weapon/artifact/element/region key constants.
- [schema](/libs/gi/schema/) — Zod schemas for GI domain objects.
- [good](/libs/gi/good/) — GOOD (Genshin Open Object Description) import/export format.
- [dm](/libs/gi/dm/) — datamine reader (GenshinData + HakushinData submodules → typed Excel-config data).
- [dm-localization](/libs/gi/dm-localization/) — locale strings extracted from the datamine.
- [assets](/libs/gi/assets/) / [assets-data](/libs/gi/assets-data/) — game asset references and generated asset metadata.
- [stats](/libs/gi/stats/) — generated `allStat_gen.json` + stat-lookup helpers (`getCharEle`, `getCharStat`, `getCharParam`, `isCharMelee`).
- [i18n](/libs/gi/i18n/) / [i18n-node](/libs/gi/i18n-node/) — in-app translations (browser + Node backends).
- [mats](/libs/gi/mats/) — material/talent leveling data.
- [keymap](/libs/gi/keymap/) — key-mapping utilities between internal keys and display data.
- [prisma-schema](/libs/gi/prisma-schema/) — Prisma schema definitions.

Calculation & optimization:
- [formula](/libs/gi/formula/) — GI-specific calculator (stat keys/values → combat formulas).
- [formula-ui](/libs/gi/formula-ui/) — formula-visualization UI.
- [wr](/libs/gi/wr/) / [wr-types](/libs/gi/wr-types/) — legacy "Waverider" calculation engine + its types (deprecated, still used by `apps/frontend`).
- [solver](/libs/gi/solver/) — artifact optimization solver.
- [solver-tc](/libs/gi/solver-tc/) — "theorycrafting" solver variant.
- [upopt](/libs/gi/upopt/) — leveling/ascension-upgrade optimization.

State & UI:
- [db](/libs/gi/db/) — `ArtCharDatabase` client-side state (characters/artifacts/weapons/teams).
- [db-ui](/libs/gi/db-ui/) — React DB context/hooks.
- [theme](/libs/gi/theme/) — MUI theme for the GI app.
- [ui](/libs/gi/ui/) — shared GI UI components/providers (ad wrapper, silly/snow easter-egg contexts, etc.).
- [uidata](/libs/gi/uidata/) — UI-facing state/data structures.
- [svgicons](/libs/gi/svgicons/) — GI-specific icon set.
- [char-cards](/libs/gi/char-cards/) — character card components.
- [sheets](/libs/gi/sheets/) — character talent/passive "sheets" (formula text + metadata per character).
- [util](/libs/gi/util/) — GI-specific utility functions.

Pages (lazy-loaded routes, consumed by `apps/frontend`):
[page-home](/libs/gi/page-home/), [page-artifacts](/libs/gi/page-artifacts/), [page-artifacts-calc](/libs/gi/page-artifacts-calc/), [page-characters](/libs/gi/page-characters/), [page-weapons](/libs/gi/page-weapons/), [page-team](/libs/gi/page-team/), [page-teams](/libs/gi/page-teams/), [page-tools](/libs/gi/page-tools/), [page-doc](/libs/gi/page-doc/), [page-settings](/libs/gi/page-settings/), [page-scanner](/libs/gi/page-scanner/), [page-archive](/libs/gi/page-archive/) (also consumed by the Somnia bot's archive command).

Misc:
- [art-scanner](/libs/gi/art-scanner/) — tesseract.js-based OCR model integration for scanning artifacts from screenshots.
- [silly-wisher](/libs/gi/silly-wisher/) / [silly-wisher-names](/libs/gi/silly-wisher-names/) — "Silly Wisher" artwork/gacha-simulation integration (used with permission, see root README acknowledgments).

## libs/sr/ — Honkai: Star Rail

Mirrors the GI structure on the Pando engine:
- Data: [consts](/libs/sr/consts/), [schema](/libs/sr/schema/), [srod](/libs/sr/srod/) (SR Object Description import/export format), [dm](/libs/sr/dm/) (StarRailData submodule), [dm-localization](/libs/sr/dm-localization/), [assets](/libs/sr/assets/), [assets-data](/libs/sr/assets-data/), [stats](/libs/sr/stats/), [i18n](/libs/sr/i18n/), [i18n-node](/libs/sr/i18n-node/).
- Calc/optimize: [formula](/libs/sr/formula/), [formula-ui](/libs/sr/formula-ui/), [solver](/libs/sr/solver/).
- State/UI: [db](/libs/sr/db/), [db-ui](/libs/sr/db-ui/), [theme](/libs/sr/theme/), [ui](/libs/sr/ui/), [svgicons](/libs/sr/svgicons/), [util](/libs/sr/util/).
- Pages: [page-characters](/libs/sr/page-characters/), [page-lightcones](/libs/sr/page-lightcones/), [page-relics](/libs/sr/page-relics/), [page-team](/libs/sr/page-team/), [page-teams](/libs/sr/page-teams/), [page-optimize](/libs/sr/page-optimize/), [page-settings](/libs/sr/page-settings/).

## libs/zzz/ — Zenless Zone Zero

Mirrors the same structure:
- Data: [consts](/libs/zzz/consts/), [schema](/libs/zzz/schema/), [zood](/libs/zzz/zood/) (Zenless Object Description import/export format), [dm](/libs/zzz/dm/) (ZenlessData + HakushinData submodules), [dm-localization](/libs/zzz/dm-localization/), [assets](/libs/zzz/assets/), [assets-data](/libs/zzz/assets-data/), [stats](/libs/zzz/stats/), [i18n](/libs/zzz/i18n/), [i18n-node](/libs/zzz/i18n-node/).
- Calc/optimize: [formula](/libs/zzz/formula/), [formula-ui](/libs/zzz/formula-ui/), [solver](/libs/zzz/solver/).
- State/UI: [db](/libs/zzz/db/), [db-ui](/libs/zzz/db-ui/), [theme](/libs/zzz/theme/), [ui](/libs/zzz/ui/), [svgicons](/libs/zzz/svgicons/), [util](/libs/zzz/util/).
- Pages: [page-home](/libs/zzz/page-home/), [page-characters](/libs/zzz/page-characters/), [page-discs](/libs/zzz/page-discs/), [page-wengines](/libs/zzz/page-wengines/), [page-optimize](/libs/zzz/page-optimize/), [page-settings](/libs/zzz/page-settings/).
- Misc: [disc-scanner](/libs/zzz/disc-scanner/) — OCR-based disc (gear) scanning, the ZZZ equivalent of `gi/art-scanner`.

## plugin/, tools/, types/

| Path | Purpose |
|---|---|
| [plugin/biome](/plugin/biome/) | Custom Nx plugin registering Biome as the repo's lint/format executor (`@genshin-optimizer/biome`, wired in `nx.json` plugins). |
| [tools/scripts](/tools/scripts/) | One-off Node scripts, e.g. the `preinstall` Node-version check. |
| [types/css](/types/css/), [types/object-overrides](/types/object-overrides/) | Ambient TypeScript declarations (CSS module typings, object-shape overrides). |
