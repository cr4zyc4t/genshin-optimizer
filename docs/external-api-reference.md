# External API Reference

This repository does **not** expose a public HTTP/REST/GraphQL API of its own — there is no backend server. "External" here means services and data sources the codebase *consumes*, either at build time (datamine ingestion) or at runtime (Discord bot).

## 1. Datamine sources (git submodules)

Declared in [.gitmodules](/.gitmodules) and synced via the `load-dm` Nx target (`@genshin-optimizer/common/plugin:sync-repo` executor) or manually with `yarn reload-dm` / `yarn update-dm`. These are read at build time only by each game's `libs/*/dm` package to generate the committed `*_gen.json` stat/asset files — they are never shipped to end users.

| Submodule path | Remote | Branch | Consumed by |
|---|---|---|---|
| `libs/gi/dm/GenshinData` | https://gitlab.com/Dimbreath/AnimeGameData2.git | `main` | [libs/gi/dm](/libs/gi/dm/) |
| `libs/gi/dm/HakushinData` | https://github.com/genshin-optimizer/gi-hakushin-data | `master` | [libs/gi/dm](/libs/gi/dm/) |
| `libs/sr/dm/StarRailData` | https://gitlab.com/Dimbreath/turnbasedgamedata.git | (default) | [libs/sr/dm](/libs/sr/dm/) |
| `libs/zzz/dm/ZenlessData` | https://git.mero.moe/dimbreath/ZenlessData.git | (default) | [libs/zzz/dm](/libs/zzz/dm/) |
| `libs/zzz/dm/HakushinData` | https://github.com/genshin-optimizer/zzz-hakushin-data | `master` | [libs/zzz/dm](/libs/zzz/dm/) |

All submodules are configured `shallow = true` for faster checkout.

## 2. Build-time HTTP APIs

| API | Endpoint pattern | Used by | Purpose |
|---|---|---|---|
| Yatta (Star Rail asset mirror) | `https://api.yatta.top/hsr/assets/UI/skill/{fileName}` | [libs/sr/assets/executors/gen-assets](/libs/sr/assets/) executor | Fetches Star Rail skill UI images during the `gen-assets` build step. |

## 3. Runtime integrations

### Discord API (`apps/somnia`)

The Somnia bot uses `discord.js` v14 as a wrapper around the Discord REST/Gateway API:

- **Gateway intents**: Guilds, Guild Members, Guild Messages, Message Content, Message Reactions, Direct Messages.
- **Slash-command registration**: via `Routes.applicationCommands(clientId)` REST call on startup.
- **Slash commands exposed to Discord users**:
  - `archive` — look up Genshin Impact character/weapon/artifact data (reads from `@genshin-optimizer/gi/stats`).
  - `databank` — Star Rail data lookups (currently disabled pending i18n work).
  - `multi` — multi-user optimization thread management.
  - `button` — bot responsiveness/liveness test.
  - `debug` — bot/repo diagnostic info.
- **Health check**: the bot runs a small HTTP listener on port `8080` purely so its Azure Web App host can perform liveness probes — this is not a public API, it has no routes beyond the health check.

### Client-side (browser) integrations

No frontend app calls an external game-data API at runtime — all game data is pre-generated at build time and bundled. The following third-party *client-side* integrations exist:

| Package | Purpose |
|---|---|
| `tesseract.js` | Client-side OCR, used by `gi/art-scanner` and `zzz/disc-scanner` to read stats off user-uploaded gear screenshots. Runs entirely in-browser (WASM/worker), no external calls beyond loading the bundled model. |
| `react-ga4` | Google Analytics 4 tracking. |
| `i18next-http-backend` | Present as a dependency for i18next's HTTP backend, but app locales are bundled at build time rather than fetched from a remote server. |

## 4. What this repo does *not* have

- No REST/GraphQL server (no Express/Fastify/Apollo found in the codebase).
- No authentication/user-accounts backend — all user data (owned characters/artifacts/teams) lives client-side.
- No first-party public API for other developers to consume.
