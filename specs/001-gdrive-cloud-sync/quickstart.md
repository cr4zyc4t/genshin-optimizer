# Quickstart & Verification Guide: Google Drive Cloud Synchronization

**Feature**: Google Drive Cloud Synchronization  
**Branch**: `001-gdrive-cloud-sync`  
**Date**: 2026-09-05  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This guide documents the end-to-end testing, validation scenarios, and mock verification steps for Google Drive cloud synchronization.

---

## 1. Prerequisites & Environment Setup

### 1.1 Dependencies
Ensure all workspace dependencies and Nx tools are installed:
```bash
yarn install --immutable
```

### 1.2 Configuration
For local manual end-to-end testing against real Google Drive:
1. Register a Google Cloud project with Google Identity Services (OAuth 2.0 Web Client).
2. Set authorized JavaScript origins to `http://localhost:4200`.
3. Provide the Client ID in environment variables:
   ```bash
   export NX_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   ```

---

## 2. Automated Test Suite Execution

Run unit and integration test suites covering the core synchronization library, debounce timer, and conflict detection:

```bash
# Run unit tests for common-gdrive
nx test common-gdrive

# Run linting and typechecking
nx lint common-gdrive
nx typecheck common-gdrive
```

---

## 3. End-to-End Validation Scenarios

### Scenario 1: Authentication & Persistence Verification
1. Start the frontend application:
   ```bash
   nx serve frontend
   ```
2. Navigate to `http://localhost:4200/#/setting`.
3. Verify that `CloudSyncCard` is displayed showing the unauthenticated state with an informative explanation and a "Login with Google Drive" button.
4. Click "Login with Google Drive" and complete authentication in the popup.
5. **Expected Outcome**:
   - The card updates to show user display name/email, "Last Sync: Just now", and status "Synced".
   - Refresh the browser (F5 / Cmd+R).
   - The card immediately reloads in the authenticated "Synced" state without re-prompting for credentials.

### Scenario 2: 10-Second Debounced Sync on Data Mutation
1. While logged in, modify an artifact or add a character in database slot 1.
2. Observe `CloudSyncCard` status changes to "Pending Sync" (debouncing).
3. Within 5 seconds, edit another artifact in slot 2.
4. Observe the timer resets and does not fire at the original 10-second mark.
5. Wait for 10 seconds without further edits.
6. **Expected Outcome**:
   - At exactly 10 seconds after the final edit, network request initiates.
   - Status transitions briefly to "Syncing...", then returns to "Synced".
   - The single unified cloud backup file in `appDataFolder` is updated with data from all 4 slots.

### Scenario 3: Initial Window Focus Sync Check
1. Switch to a different browser tab for 15 seconds, then switch back to the Genshin Optimizer tab.
2. **Expected Outcome**:
   - System registers the window focus event.
   - Triggers an automatic background check against Google Drive to ensure local state matches remote state.

### Scenario 4: Conflict Resolution with Size Disparity Warning
1. Simulate a divergence (e.g. locally delete characters while remote has full character roster).
2. Trigger sync check.
3. **Expected Outcome**:
   - The Conflict Resolution dialog appears showing side-by-side comparison of local vs. cloud data.
   - Because one version has fewer items / smaller size, a prominent warning alert is displayed:
     *"Caution: One version has substantially less data than the other."*
4. Click "Keep Local Data".
5. **Expected Outcome**:
   - Dialog closes and immediate upload initiates without waiting 10 seconds.
   - Remote backup is replaced with local data and status becomes "Synced".
