# Feature Specification: Storage Proxy Synchronization Trigger

**Feature Branch**: `002-storage-proxy-sync-trigger`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "we already check the possibility of using localStorage proxy for detecting data change in commit '9328a822d19c7a119db70788f1e6df43b739306c', it's might be more reliable than patching database layer. So we will try this method for refactoring cloud sync feature. cloud sync will trigger whenever data in localstorage change by listening on some methods: clear, setItem, removeItem. For setItem and removeItem, we will have a blacklist of keys that will be ignore, these keys can be key that unncessary to sync, or to avoid sync loop since the sync process itself also use localStorage .the logic about debounce,maxwait,... are keep as is, only the trigger event method change. Old method must be revert as close as possible to branch 'customize'"

## Clarifications

### Session 2026-09-10
- Q: Where should the persistent storage write listener and key blacklist filtering reside in the codebase? → A: Inside `GenshinSlotAdapter` satisfying the existing `subscribeToChanges` contract, keeping `CloudSyncManager` decoupled and platform-agnostic while the adapter manages storage write event observation and blacklist filtering.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reliable Change Detection for Cloud Synchronization (Priority: P1)

As an active optimizer user, whenever I make modifications to my character configurations, inventory, team loadouts, or switch and import database files, I want the cloud synchronization system to detect these changes at the persistent storage boundary, so that all my edits and database swaps are reliably queued for cloud backup without relying on fragile hooks across individual UI cards or database managers.

**Why this priority**: Users expect every modification—whether editing an artifact, swapping an active database slot, or importing a backup—to be safely synchronized. Detecting changes at the persistent storage layer captures all data mutations uniformly and eliminates synchronization gaps.

**Independent Test**: Can be tested by making any data modification (e.g., adding an artifact, swapping database slots, or importing data), verifying that the storage write event triggers a debounced cloud sync, and confirming that the latest modifications are preserved in the cloud backup without manual UI trigger hacks.

**Acceptance Scenarios**:

1. **Given** an authenticated user with active cloud synchronization, **When** they update any persistent database record (such as modifying a character, weapon, artifact, or team), **Then** the persistent storage mutation initiates the cloud synchronization countdown.
2. **Given** an authenticated user, **When** they swap active database slots or replace an entire slot via data upload, **Then** the resulting persistent storage changes automatically trigger the synchronization countdown without requiring custom notification hooks in the UI.
3. **Given** an ongoing synchronization debounce countdown, **When** further persistent data changes occur, **Then** the debounce countdown resets, respecting the existing debounce duration and maximum wait cap before executing the sync.

---

### User Story 2 - Infinite Sync Loop Prevention and Key Filtering (Priority: P2)

As a user, I want internal synchronization operations (such as updating sync metadata or caching authentication tokens) and non-database transient preferences to be excluded from triggering cloud sync, so that the synchronization process never enters a self-triggering recursive loop or performs unnecessary uploads for transient UI settings.

**Why this priority**: Cloud synchronization itself writes metadata and session tokens to local storage. Without strict key exclusion (blacklisting), a sync upload would detect its own metadata write as a new user change, causing an infinite upload loop that wastes bandwidth and quota.

**Independent Test**: Can be tested by performing storage write and remove operations on blacklisted keys (such as sync metadata or authentication tokens) and verifying that the synchronization state remains idle with zero sync timers or uploads initiated.

**Acceptance Scenarios**:

1. **Given** an active cloud synchronization session, **When** the system writes or removes internal synchronization metadata or authentication tokens in persistent storage, **Then** these keys are ignored by the trigger filter and no synchronization countdown is started.
2. **Given** user interactions that update transient non-database UI preferences in storage, **When** these non-synchronized keys are updated or removed, **Then** the trigger filter ignores them and no synchronization is scheduled.
3. **Given** incoming data being downloaded and applied from the cloud during remote sync, **When** the system writes remote data into local storage, **Then** internal sync guards suppress change triggers to prevent an echo sync back to the cloud.

---

### User Story 3 - Full Storage Reset and Clear Detection (Priority: P3)

As an optimizer user, when I clear my local storage or reset all databases, I want the synchronization system to detect the storage clearing action and schedule a synchronization check, so that the cloud backup accurately reflects the intentional reset.

**Why this priority**: A storage wipe or complete database reset is a major user action. Detecting the clear operation ensures that the application does not remain stale or out of sync with cloud state.

**Independent Test**: Can be tested by triggering a storage clear operation and verifying that the clear event is intercepted and schedules a synchronization check.

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** the persistent storage is cleared, **Then** the clear operation is intercepted and initiates the debounced synchronization pipeline.
2. **Given** a clear operation triggering synchronization, **When** the debounced countdown finishes, **Then** the synchronization manager evaluates the empty local state against the cloud backup using established conflict and empty-state rules.

---

### User Story 4 - Clean Architectural Decoupling & Baseline Reversion (Priority: P4)

As an open-source contributor and maintainer, I want the UI database components and core database classes decoupled from cloud synchronization internals, reverting manual timestamp updates and ad-hoc event hooks back to the pristine baseline of the project, so that code maintenance is simplified and UI components only manage their primary user interactions.

**Why this priority**: Prior approaches patched individual UI cards (such as manual database timestamp sets in `DatabaseCard` and `UploadCard`) and complex database manager listener loops to catch missing events. Reverting these hacks restores maintainability and prevents architectural drift.

**Independent Test**: Can be tested by inspecting the codebase to verify that manual timestamp hacks in UI cards and ad-hoc database manager listeners are removed, while full automated synchronization test suites continue to pass.

**Acceptance Scenarios**:

1. **Given** the database management and upload UI components, **When** user swaps or uploads databases, **Then** these components contain no cloud-sync-specific timestamp patching code.
2. **Given** the multi-slot database adapter, **When** listening for data changes, **Then** it encapsulates persistent storage proxy write observation and key blacklist filtering in `subscribeToChanges` rather than maintaining manual subscriptions across internal database managers.

---

### Edge Cases

- **Rapid successive storage writes**: Multiple rapid writes to non-blacklisted keys within the debounce window MUST reset the debounce timer and execute exactly one upload once modifications settle, capped by the configured maximum wait time.
- **Concurrent remote import execution**: When remote cloud data is being downloaded and applied into persistent storage, all storage writes during that import cycle MUST be suppressed so that cloud data application does not trigger an immediate re-upload.
- **Mixed write operations**: A batch of operations containing both blacklisted keys (e.g., sync metadata) and non-blacklisted keys (e.g., character data) MUST trigger synchronization due to the presence of non-blacklisted modifications.
- **Storage clear during active debouncing**: If a clear occurs while a debounce countdown from a previous modification is active, the debounce timer MUST reset and process the cleared state upon expiration.
- **Unauthenticated state**: Storage writes that occur when no user is signed in to cloud sync MUST update the local dirty flag or remain safely in local storage without attempting unauthorized network calls.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST intercept persistent storage write and delete operations—specifically `setItem`, `removeItem`, and `clear`—using a storage proxy installed at application startup.
- **FR-002**: The system MUST evaluate the target key for every `setItem` and `removeItem` operation against an exclusion list (blacklist) before deciding whether to trigger synchronization.
- **FR-003**: The key exclusion list MUST include all internal synchronization keys, including synchronization runtime metadata and authentication session caches, to prevent infinite self-triggering synchronization loops.
- **FR-004**: The key exclusion list MUST include non-database transient UI preferences that do not belong to the multi-slot database state.
- **FR-005**: When a `clear` operation occurs, the system MUST treat it as a significant data modification and schedule synchronization without requiring key-level filtering.
- **FR-006**: When any non-blacklisted `setItem`, non-blacklisted `removeItem`, or `clear` operation is detected, the system MUST notify the synchronization manager to set the local dirty state and start or reset the debounce timer.
- **FR-007**: The debounce duration (default 5 seconds) and maximum wait ceiling (default 8 seconds) MUST remain identical to existing synchronization timing behavior.
- **FR-008**: The system MUST suppress storage change triggers while applying remote cloud packages to local storage, preventing echo re-uploads.
- **FR-009**: Ad-hoc database-layer patches and manual timestamp updates in UI components (specifically in `DatabaseCard` and `UploadCard`) MUST be reverted to match the clean baseline of the branch.
- **FR-010**: The data synchronization adapter (`GenshinSlotAdapter`) MUST encapsulate persistent storage proxy observation and key blacklist filtering within its `subscribeToChanges` implementation, completely replacing internal database manager listeners (`dataManagers` / `dataEntries` / `followAny` loops) while keeping `CloudSyncManager` decoupled from browser storage APIs.

### Key Entities

- **Storage Mutation Event**: Represents an intercepted storage operation, specifying the operation type (`setItem`, `removeItem`, or `clear`), the affected key (for item operations), the stored value (for `setItem`), and whether it originated from a method call or property assignment.
- **Exclusion Filter (Blacklist)**: The collection of storage keys and prefix patterns that are excluded from triggering cloud synchronization, preventing loops and redundant network activity.
- **Sync Trigger Controller**: The lifecycle component that observes filtered storage mutation events and coordinates debounced synchronization requests with the cloud synchronization manager.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of persistent data modifications across all 4 database slots (including direct record edits, slot swaps, and data imports) reliably initiate synchronization within 100ms of storage write.
- **SC-002**: Zero recursive synchronization loops occur when saving sync metadata, refreshing authentication tokens, or applying remote cloud backups.
- **SC-003**: 100% of storage writes targeting excluded keys result in zero synchronization timer resets and zero network upload requests.
- **SC-004**: All ad-hoc synchronization trigger patches in UI cards (`DatabaseCard`, `UploadCard`) are eliminated, achieving complete architectural decoupling.
- **SC-005**: Debounce timing (5-second debounce) and maximum wait duration (8-second cap) remain unchanged, ensuring consistent user experience and network traffic profile.

## Assumptions

- The persistent storage proxy (`LocalStorageProxy`) is installed in the application entry point prior to any database or synchronization subsystem initialization.
- All persistent user data relevant to cloud synchronization is stored within persistent browser storage (`localStorage`).
- Existing conflict detection, resolution workflows, and Google Drive API communication protocols remain unchanged, as this feature refactors only the change detection and trigger mechanism.
- The default debounce of 5,000ms and max wait of 8,000ms provide the optimal balance between real-time backup and network throttling.
