<!--
Sync Impact Report
- Version change: Unversioned Scaffold → 1.0.0
- Modified principles:
  - [PRINCIPLE_1_NAME] → I. Library-First Monorepo Architecture
  - [PRINCIPLE_2_NAME] → II. Pure & Deterministic Calculation Engines
  - [PRINCIPLE_3_NAME] → III. Strict Quality Gates & Continuous Verification (mini-ci)
  - [PRINCIPLE_4_NAME] → IV. Standardized Interoperability & Data Integrity (GOOD / SROD)
  - [PRINCIPLE_5_NAME] → V. Internationalization (i18n) & Localized UI
- Added sections:
  - Technical Standards & Constraints
  - Development Workflow & Review Process
  - Governance
- Removed sections: None
- Follow-up TODOs: None
-->

# Genshin Optimizer Constitution

## Core Principles

### I. Library-First Monorepo Architecture
Every feature, domain calculation, game dataset, and shared utility MUST be developed as an isolated Nx library within `libs/` (`libs/common`, `libs/game-opt`, `libs/gi`, `libs/sr`, `libs/zzz`, `libs/pando`). Applications located in `apps/` (`frontend`, `sr-frontend`, `zzz-frontend`, `somnia`) MUST remain thin composition layers responsible solely for application bootstrapping, high-level routing, and page-level layouts. Cross-module deep imports bypassing library boundaries (such as `../**/src/**`) are strictly forbidden; modules MUST be consumed via their public package entry points (e.g., `@genshin-optimizer/*`).
*Rationale: Preserves clean architectural boundaries, maximizes code reuse across multiple game optimizers and bot frontends, and enables efficient caching and selective execution in Nx.*

### II. Pure & Deterministic Calculation Engines
All game mechanics, damage formulas, stat calculation nodes, and optimization algorithms MUST be implemented purely and deterministically using the Pando formula engine or equivalent graph representations. Calculation routines MUST be side-effect free, independent of React UI state, and completely verifiable outside the browser. Every calculation node, modifier, and formula curve MUST be validated by discrete unit tests with test fixtures against known in-game stats and datamined constants.
*Rationale: Players rely on 100% calculation precision for artifact optimization, loadout comparison, and theorycrafting. Isolating formulas guarantees correctness and cross-runtime portability (workers, server, CLI, bot).*

### III. Strict Quality Gates & Continuous Verification (mini-ci)
Code quality MUST be verified locally prior to pushing or requesting reviews by executing `yarn run mini-ci`. All code MUST satisfy:
1. Automated formatting and linting via Biome (`nx affected -t format`, `nx affected -t lint`) with zero unresolved errors or warnings.
2. Complete static type checking via TypeScript (`nx affected -t typecheck`).
3. Unit test suites via Vitest (`nx affected -t test`).
4. Pipeline artifacts generated from game datamines (`nx run-many -t gen-file`) MUST be fully in sync, resulting in a clean git status with no unstaged changes.
*Rationale: Continuous automated quality gates prevent regressions, protect mathematical algorithms from subtle bugs, and maintain high standards across a large multi-game monorepo.*

### IV. Standardized Interoperability & Data Integrity (GOOD / SROD)
All external data interchange (including inventory scanner imports, file backups, and cross-tool exchanges) MUST adhere strictly to established open specifications, such as GOOD (Genshin Open Object Description) and SROD (Star Rail Open Description). Schema modifications MUST maintain backward compatibility or provide automated, test-backed migration paths (`libs/common/database`). Storage adapters MUST validate incoming data payloads and fail gracefully with informative error diagnostics rather than corrupting application state or crashing.
*Rationale: Ensures seamless interoperability with third-party tools (e.g., Inventory Kamera) and protects long-standing user data against loss or corruption.*

### V. Internationalization (i18n) & Localized UI
All user-facing strings MUST be managed via the internationalization framework (`react-i18next`). Hardcoded user-facing strings in UI components are prohibited. English translation bundles (`libs/**/*/localization/assets/locales/en/*.json`) serve as the canonical source of truth and MUST be updated in tandem with any UI modifications. UI components MUST be constructed using Material UI (MUI) components, styled via `@emotion/styled`, and designed with fluid layouts that adapt gracefully to varying text lengths and bidirectional or non-Latin scripts.
*Rationale: Genshin Optimizer serves an international community; maintaining complete localization parity ensures an accessible and polished experience for all users.*

## Technical Standards & Constraints

- **Language & Runtime**: Node.js (version pinned in `.nvmrc`), TypeScript 5+/6+ configured in strict mode.
- **Frontend Architecture**: React 18 SPA powered by Vite / SWC, styled using Material UI (MUI v5) and Emotion.
- **Monorepo & Build Tooling**: Managed via Nx (`nx.json`). Build, test, lint, and code generation targets are cached and orchestrated via Nx target defaults.
- **Testing Standards**: Vitest for unit and integration testing; Cypress for critical path end-to-end (E2E) workflows.
- **Package Management**: Yarn with immutable lockfile enforcement (`yarn install --immutable`). Unapproved package additions or redundant dependencies are strictly prohibited.
- **Datamine Synchronization**: Upstream datamines (`GenshinData`, `StarRailData`, `HakushinData`) are managed via Git submodules under `libs/*/dm/` and updated through defined scripts (`yarn run reload-dm`, `yarn run update-dm`).

## Development Workflow & Review Process

- **Branching & Pull Requests**: All changes must be delivered via pull requests targeting the primary branch (`master` / `production`).
- **PR Compliance Checklist**: Every pull request MUST fulfill the repository PR checklist:
  1. Describe changes and link relevant issue(s) or Discord discussions.
  2. Provide testing and validation evidence (reproducible test cases or UI screenshots).
  3. Include comments explaining non-trivial or mathematically complex sections.
  4. Update English localization assets for any user-facing text modifications.
  5. Successfully run `yarn run mini-ci` locally.
  6. Update deployment ignore configurations when adding new libraries or apps.
- **Code Review**: Pull requests require at least one approving review from a core maintainer before merging.

## Governance

This Constitution supersedes all informal team practices, ad-hoc conventions, and undocumented workflows. Every contribution, automated agent action, and code review MUST comply with the principles and standards set forth in this document.

- **Amendment Procedure**: Amendments to this Constitution require a formal pull request detailing the proposed modifications, architectural justification, impact assessment across existing libraries/apps, and approval from repository maintainers.
- **Versioning Policy**: This Constitution adheres to Semantic Versioning:
  - **MAJOR**: Incompatible architectural shifts, principle deletions, or fundamental policy reversals.
  - **MINOR**: Addition of new principles, new project sections, or significant expansion of governance rules.
  - **PATCH**: Wording improvements, non-semantic clarifications, and minor corrections.
- **Compliance & Enforcement**: Spec Kit workflows, continuous integration pipelines, and maintainer reviews act as enforcement mechanisms. Non-compliant contributions will not be merged without prior constitution amendment or explicit exemption.

**Version**: 1.0.0 | **Ratified**: 2026-09-05 | **Last Amended**: 2026-09-05
