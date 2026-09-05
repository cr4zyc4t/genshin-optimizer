# Feature Specification: Google Drive Cloud Synchronization

**Feature Branch**: `001-gdrive-cloud-sync`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "create specs to support Gdrive cloud sync:
- this time, we implement cloud sync for Genshin only, but aware that it can be integrate with other frontend in the future, so design it to be reusable.
- Add CloudSyncCard, show Login button with message about login to enable cloud sync. When user logged in, show user information, last sync time and status
- login must persist on browser refresh
- Grant just enough permission for cloud syncing when login
- all 4 slots are sync as one data file
- sync are trigger when one of conditions: page is focus 1st time, data changed
- sync trigger must be debounced 10s
- when there is conflict, show user a dialog to choose between local data or cloud data with some useful information like last modify times, size. Has a warning if 1 data is much smaller than the other. If user choose local data, trigger sync immediately to make cloud data up to date
- data is stored in drive of user, not project
- data in cloud is hidden from user."

## Clarifications

### Session 2026-09-05
- Q: How should the system handle the synchronization state if the user dismisses or closes the Conflict Resolution dialog without choosing an option? → A: Freeze automatic syncing, remain in `CONFLICT` status, and show a persistent warning chip on `CloudSyncCard` to re-open the dialog.
- Q: When a user logs into Google Drive on a new device where local storage is completely empty, how should the initial sync behave? → A: Automatically download and restore the cloud backup into local storage without prompting.
- Q: How should the system handle pending local changes if the user closes the browser tab while the 10-second debounce countdown is still active? → A: No specific tab-closure handling is required; modifications remain safely in local storage, and the standard initial page focus/load sync check will naturally trigger and sync the data on the next session.
- Q: What specific criteria should trigger the high-visibility disparity warning in the Conflict Resolution dialog? → A: Trigger when total item count differs by > 25%, byte size differs by > 35%, or a slot is empty in one version but populated in the other.
- Q: How should the system handle synchronization when a user disconnects their Google Drive account and subsequently reconnects (the same or a different account)? → A: Apply standard sync check on reconnection: auto-upload if cloud is empty, auto-restore if local is empty, or show conflict dialog if diverged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect Personal Cloud Storage via CloudSyncCard (Priority: P1)

As a Genshin Optimizer user, I want to securely connect my personal Google Drive account from the settings page with least-privilege permissions and stay logged in across browser refreshes, so that my optimizer data can be backed up automatically without compromising my private Drive files or requiring repeated logins.

**Why this priority**: Connecting the user's storage account and maintaining persistent authentication is the foundational prerequisite for all cloud synchronization, data retrieval, and backup capabilities.

**Independent Test**: Can be tested independently by navigating to the Settings page, clicking the Login button on the CloudSyncCard, authenticating with Google Drive, confirming that user information (name/email) and initial status display, and refreshing the browser to verify persistent login state without any file upload/download logic yet executing.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user on the Settings page, **When** they view the CloudSyncCard, **Then** they see an explanatory message about cloud synchronization and a prominent "Login with Google Drive" button.
2. **Given** an unauthenticated user, **When** they click "Login with Google Drive", **Then** the consent prompt requests only application-specific restricted data access (least privilege) without requesting general access to their personal files or documents.
3. **Given** a successfully authenticated user, **When** the login flow completes, **Then** the CloudSyncCard displays their user profile information, the current sync status, and the timestamp of the last synchronization attempt.
4. **Given** an authenticated user, **When** they refresh the browser page or reopen the app in a new session, **Then** their authentication status remains active and connected without requiring re-login.
5. **Given** an authenticated user, **When** they click a "Logout" or "Disconnect" option in the CloudSyncCard, **Then** the cloud session is terminated, cloud synchronization stops, and the card returns to the unauthenticated prompt while preserving local data.
6. **Given** an authenticated user on a fresh browser with empty local database slots, **When** the initial cloud check discovers an existing cloud backup, **Then** the system automatically downloads and restores the cloud backup into local storage without triggering a conflict dialog.

---

### User Story 2 - Automated Unified Multi-Slot Synchronization (Priority: P2)

As an active optimizer user with multiple character builds across different database slots, I want all 4 of my database slots automatically saved into a single unified cloud backup file whenever I open the page or make modifications (debounced by 10 seconds), so that my data stays synchronized and safe without interrupting my work or overloading the network.

**Why this priority**: Users frequently switch between database slots and modify artifacts/weapons rapidly. Bundling all 4 slots into a single atomic file and debouncing sync triggers ensures data consistency and optimal performance.

**Independent Test**: Can be tested by making multiple rapid changes across different slots, verifying that no sync request fires until 10 seconds after the last edit, and confirming that the uploaded cloud archive contains the complete contents of all 4 slots.

**Acceptance Scenarios**:

1. **Given** an authenticated user opening or returning focus to the application window for the first time in a session, **When** the window focus event triggers, **Then** an automatic synchronization check begins to verify that local data matches the latest cloud backup.
2. **Given** an authenticated user modifying local data (e.g., artifacts, weapons, characters, teams), **When** changes occur, **Then** a 10-second synchronization debounce timer starts.
3. **Given** a running 10-second debounce timer, **When** additional modifications occur before the timer expires, **Then** the timer resets to 10 seconds.
4. **Given** an expired 10-second debounce timer with local modifications, **When** the timer elapses, **Then** the system packages all 4 database slots into a single unified backup payload and securely uploads it to the user's hidden cloud application folder.
5. **Given** a completed cloud upload, **When** the upload finishes successfully, **Then** the CloudSyncCard updates its status to "Synced" and updates the "Last Sync Time" to the current timestamp.

---

### User Story 3 - Conflict Detection & Interactive Resolution (Priority: P3)

As a user using the optimizer across multiple computers or browser windows, I want the system to detect when local and cloud data conflict, show me an informative comparison dialog (with timestamps, sizes, and severe size-disparity warnings), and immediately update the cloud if I pick local data, so that I never lose my hard-earned optimizer configurations.

**Why this priority**: Multi-device usage inevitably encounters concurrent or out-of-order edits. Without explicit conflict resolution and safety warnings, user data could be silently overwritten.

**Independent Test**: Can be tested by generating divergent local and cloud states, triggering a sync check, verifying that the conflict modal appears with comparative metrics (sizes, timestamps) and appropriate disparity warnings, and confirming that selecting "Use Local Data" immediately forces a cloud update without waiting for debouncing.

**Acceptance Scenarios**:

1. **Given** an active cloud connection, **When** a sync trigger occurs and both local and cloud data have modified independently since the last shared sync point, **Then** automatic upload/download is halted and a Conflict Resolution dialog is presented to the user.
2. **Given** the Conflict Resolution dialog, **When** displayed, **Then** it presents comparative details for both versions: last modified timestamp, overall data size, and slot content summaries.
3. **Given** a conflict scenario where one data version is significantly smaller than the other (e.g., one version has fewer items or empty slots), **When** the dialog renders, **Then** it prominently displays a high-visibility warning alerting the user to potential data loss if the smaller version is chosen.
4. **Given** the user reviewing the conflict dialog, **When** they choose "Keep Local Data", **Then** the local data is preserved, the dialog closes, and an immediate cloud synchronization is initiated to overwrite the cloud version without a 10-second delay.
5. **Given** the user reviewing the conflict dialog, **When** they choose "Use Cloud Data", **Then** local storage is updated to match the cloud version across all 4 slots, the UI refreshes with the new data, and the CloudSyncCard status reflects "Synced".
6. **Given** an open Conflict Resolution dialog, **When** the user closes or dismisses the dialog without making a choice, **Then** automatic cloud uploads remain frozen, local data remains intact, and the CloudSyncCard displays a persistent "Conflict Pending" warning chip with an action to re-open the dialog.

---

### User Story 4 - Reusable Multi-Frontend Cloud Sync Architecture (Priority: P4)

As a product maintainer across multiple game optimizers, I want the cloud storage, authentication, and synchronization mechanisms to be decoupled from game-specific data structures, so that other game frontends can adopt the exact same cloud sync capabilities in future milestones without duplicating core sync logic.

**Why this priority**: Genshin Optimizer is part of a larger ecosystem of game optimizers. Designing the sync engine generically from day one avoids costly refactoring when extending support to Star Rail, ZZZ, or other tools.

**Independent Test**: Can be tested by validating that the cloud sync controller, authentication adapter, and conflict resolution interfaces accept generic serializable multi-slot payloads rather than being hardcoded to Genshin-specific schemas.

**Acceptance Scenarios**:

1. **Given** the cloud synchronization architecture, **When** evaluated against multi-game extensibility, **Then** the authentication provider, drive communication protocol, and conflict state manager operate independently of game-specific data models.
2. **Given** the Genshin frontend, **When** integrating cloud sync, **Then** it supplies its own 4-slot database adapter and UI card while consuming the shared cloud sync foundation.

---

### Edge Cases

- **Network Outage / Offline Status**: If a user is offline or the network request fails during a sync attempt, the system marks the status as "Offline" or "Sync Failed", retains local data without error dialog disruption, and queues synchronization for the next window focus or reconnection event.
- **Revoked Google Drive Permissions**: If the user revokes application permissions from their Google Account security dashboard, subsequent sync requests fail gracefully, prompt the user to re-authenticate via the CloudSyncCard, and prevent silent data loss.
- **Empty Cloud Storage on Initial Setup**: When a user logs in for the very first time on a fresh account with no prior cloud backup, the system detects the absence of remote data and performs an initial upload of the existing local slots without flagging a conflict.
- **Empty Local Storage on New Device**: When a user with an existing cloud backup logs in on a new device or browser with empty local slots, the system detects that local slots are empty and unedited, automatically downloads the cloud backup into local storage, and populates the database without prompting or raising a conflict.
- **Rapid Multi-Slot Mutations**: If a user switches between slots and performs rapid modifications across multiple slots within the 10-second window, all changes accumulate and are packaged together in a single atomic upload once the 10 seconds of inactivity elapse.
- **Account Disconnection and Subsequent Reconnection**: Disconnecting an account preserves local database contents untouched. Upon reconnecting an account, the system executes a standard sync check (auto-uploading if cloud is empty, auto-restoring if local slots are empty, or opening the conflict dialog if divergent data exists) without erasing local data.
- **Unresolved Conflict Dialog Dismissal**: If a user dismisses or navigates away from the Conflict Resolution modal without choosing an option, automatic cloud uploads remain halted, local modifications continue only in local storage, and the CloudSyncCard displays a persistent warning chip to re-open the dialog.
- **Browser Tab Closed During Debounce Window**: No specialized unload handler or beforeunload prompt is required. Modifications are already written to local storage, and the standard initial window focus synchronization trigger on the subsequent visit will detect and sync the pending data.
- **Concurrent Tabs / Browser Windows**: If multiple tabs of the optimizer are open simultaneously, window focus detection detects updates made by other tabs/devices and prevents out-of-order writes through timestamp and revision checking.

## Requirements *(mandatory)*

### Functional Requirements

#### Authentication & Authorization
- **FR-001**: System MUST provide an authentication flow allowing users to connect their personal Google Drive account.
- **FR-002**: System MUST request the absolute minimum required authorization scope (Google Drive application data folder scope) to store and manage application-specific data.
- **FR-003**: System MUST NOT request permissions to view, edit, or delete any user documents, photos, or files outside the application's dedicated hidden folder.
- **FR-004**: System MUST persist the user's authentication credentials across browser reloads, navigation, and page refreshes.
- **FR-005**: System MUST allow users to explicitly disconnect / log out from Google Drive, which terminates the cloud session without clearing or modifying existing local database contents.
- **FR-029**: When a user reconnects a Google Drive account (the same or a different account) following disconnection, the system MUST execute a standard sync check against the reconnected account: automatically uploading if cloud storage is empty, automatically restoring if local storage is unpopulated, and presenting the Conflict Resolution dialog if both datasets contain divergent data.

#### CloudSyncCard UI
- **FR-006**: System MUST provide a dedicated `CloudSyncCard` component in the application settings interface.
- **FR-007**: When unauthenticated, the `CloudSyncCard` MUST display an informative explanation outlining the benefits of cloud synchronization alongside a prominent Login button.
- **FR-008**: When authenticated, the `CloudSyncCard` MUST display user identity details (user display name or email), the timestamp of the last successful synchronization, the current synchronization status, and an option to disconnect.
- **FR-009**: System MUST visually indicate synchronization states on the `CloudSyncCard` (e.g., Idle/Synced, Syncing in progress, Pending debounced sync, Conflict detected, or Error/Offline).

#### Storage Location & Privacy
- **FR-010**: All cloud data MUST be stored directly within the authenticated user's personal Google Drive account.
- **FR-011**: System MUST NOT store user optimizer data on project-owned servers or centralized cloud databases.
- **FR-012**: Cloud data files MUST reside inside the user's hidden Google Drive Application Data storage area, ensuring files remain hidden from normal Google Drive folder browsing to prevent accidental user deletion or tampering.

#### Data Bundling & Multi-Slot Packaging
- **FR-013**: System MUST package all four (4) database slots (Slots 1 through 4) and their respective metadata into a single, unified backup data file.
- **FR-014**: System MUST perform cloud writes and reads atomically on the unified data file so all four slots remain synchronized in lockstep.

#### Synchronization Triggers & Debouncing
- **FR-015**: System MUST automatically trigger a synchronization check when the application window or tab gains focus for the first time in a session.
- **FR-016**: System MUST automatically queue a synchronization upload whenever local data changes in any database slot.
- **FR-017**: Local data change synchronization triggers MUST be debounced by ten (10) seconds, resetting the countdown if further local modifications occur before the duration expires.
- **FR-018**: System MUST suppress unnecessary uploads if local data is identical to the latest synced cloud revision.
- **FR-027**: When an authenticated user connects on a new device or browser with uninitialized/empty local database slots, the system MUST automatically download and restore the existing cloud backup into all local slots without prompting or flagging a conflict.
- **FR-028**: If a browser tab is closed while a 10-second debounce countdown is active, no special unload handling is required; local data remains in local storage, and the standard initial page focus synchronization check (FR-015) will naturally evaluate and upload pending modifications on the next session.

#### Conflict Detection & Resolution
- **FR-019**: System MUST detect conflicts when both local data and remote cloud data have been modified since the previous synchronization point.
- **FR-020**: When a conflict is detected, the system MUST suspend automatic uploads and present a Conflict Resolution modal dialog. If the dialog is closed or dismissed without selecting an option, the system MUST remain in the `CONFLICT` state, keep automatic cloud uploads frozen, and show a persistent warning chip on the `CloudSyncCard` allowing the user to re-open the resolution dialog at any time.
- **FR-021**: The Conflict Resolution dialog MUST present comparative diagnostic metrics for both local and cloud versions, including last modified timestamps, file/payload byte sizes, and slot summaries.
- **FR-022**: The Conflict Resolution dialog MUST display a prominent warning banner whenever one data version is significantly smaller than the other, defined specifically as: total item count (characters, weapons, artifacts) differing by > 25%, payload byte size differing by > 35%, or any slot being empty in one version but populated in the other.
- **FR-023**: If the user selects "Keep Local Data", the system MUST immediately trigger a cloud upload to overwrite remote data with the local version without applying the 10-second debounce delay.
- **FR-024**: If the user selects "Use Cloud Data", the system MUST overwrite all local database slots with the cloud version and immediately refresh the application state.

#### Architectural Extensibility
- **FR-025**: The core synchronization engine, Google Drive integration adapter, and conflict resolution logic MUST be designed as reusable, game-agnostic modules suitable for integration with other game frontends in future releases.
- **FR-026**: The initial integration MUST connect specifically to the Genshin frontend without preventing subsequent integrations.

### Key Entities

- **Cloud Account Profile**: Represents the connected user's external Google identity (account identifier, display name, email, and authentication session token state).
- **Unified Sync Archive**: A single serialized package encapsulating all 4 database slots, individual slot metadata, global settings, archive creation timestamp, and schema version.
- **Sync State Record**: Operational runtime metadata capturing sync status (`IDLE`, `SYNCING`, `DEBOUNCING`, `CONFLICT`, `ERROR`), timestamp of last successful sync, last known remote revision token, and pending local mutation flags.
- **Conflict Comparison Descriptor**: A structured comparative entity capturing side-by-side metrics of local vs. cloud data (timestamps, data size in bytes, item counts per slot, and relative size disparity warning flag).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **Authentication Persistence**: 100% of authenticated user sessions remain connected across page refreshes and browser tab closures without requiring credential re-entry.
- **SC-002**: **Least-Privilege Security**: 0 permissions outside the Google Drive application data scope are requested during login.
- **SC-003**: **Debounce Precision**: Under rapid consecutive user edits, cloud upload requests occur exactly 10 seconds (±500ms) after the final edit, with zero intermediate uploads dispatched during the editing burst.
- **SC-004**: **Unified Slot Atomicity**: 100% of cloud sync operations persist all 4 database slots within a single atomic cloud data file.
- **SC-005**: **Conflict Prevention & Safety**: In 100% of divergent data scenarios, automatic overwrites are blocked until explicit user confirmation is obtained via the Conflict Resolution dialog.
- **SC-006**: **Immediate Conflict Resolution**: When a user selects "Keep Local Data" during a conflict, the cloud synchronization request is initiated within 2 seconds of selection without waiting for the 10-second debounce.
- **SC-007**: **Disparity Warning Accuracy**: The Conflict Resolution dialog successfully identifies and warns users when one dataset has > 25% fewer items, > 35% smaller byte size, or empty slots in 100% of conflict test scenarios.
- **SC-008**: **Reusable Architecture**: 100% of core cloud synchronization, authentication state management, and drive communications reside in shared, game-agnostic modules completely free of Genshin-specific domain logic.

## Assumptions

- **Target User Google Account**: Users who desire cloud synchronization have access to a personal Google account with sufficient free storage space within their Google Drive quota (optimizer data files are typically small, under a few megabytes).
- **Storage Tier & Boundaries**: All cloud files are hosted within the user's personal Google Drive Application Data folder (`appDataFolder`), incurring zero infrastructure or storage hosting costs for the Genshin Optimizer project.
- **Standard Internet Connectivity**: Normal sync operations assume standard internet connectivity; temporary network interruptions are handled gracefully with retries on next focus or local update.
- **Multi-Slot Consistency**: The existing 4 database slots in Genshin Optimizer are exported and imported as a coherent unified bundle, preserving slot names and configurations.
- **Single Active Account**: A user connects a single Google account at any given time per browser profile; switching accounts requires disconnecting the existing account first.
