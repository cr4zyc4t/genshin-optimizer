# @genshin-optimizer/common/gdrive

Generic, reusable Google Drive cloud synchronization engine for game optimizers.

## Overview

This library provides a client-side, zero-backend cloud synchronization system using:
- **Google Identity Services (GIS)** for OAuth 2.0 authentication and non-interactive silent token refresh.
- **Google Drive REST API v3** targeting the user's hidden Application Data Folder (`appDataFolder`) with least-privilege `drive.appdata` scope.
- **Debounced Mutations** (default 10s via `lodash.debounce`) to prevent network congestion.
- **Three-Way Conflict Detection** with size & item disparity calculation heuristics.

## Architecture

This library is decoupled from any specific game's domain models. All game data is abstracted through the `MultiSlotDataAdapter` interface:

```typescript
import type {
  MultiSlotDataAdapter,
  SlotSummary,
  UnifiedSlotEntry,
  UnifiedSyncPackage,
} from '@genshin-optimizer/common/gdrive'

export class MyGameSlotAdapter implements MultiSlotDataAdapter {
  readonly appId = 'my-game-optimizer'

  async exportAllSlots(): Promise<{
    slots: Record<1 | 2 | 3 | 4, UnifiedSlotEntry<unknown>>
    contentHash: string
  }> {
    // Export all 4 slots and generate hash
  }

  async importAllSlots(packageData: UnifiedSyncPackage<unknown>): Promise<void> {
    // Import all 4 slots into local databases
  }

  subscribeToChanges(listener: () => void): () => void {
    // Return unsubscribe function when local database changes
  }

  getSlotSummaries(
    slots: Record<1 | 2 | 3 | 4, UnifiedSlotEntry<unknown>>
  ): Record<1 | 2 | 3 | 4, SlotSummary> {
    // Return counts (character, artifact/relic, weapon/light cone)
  }

  isLocalEmpty(): boolean {
    // Return true if slots are default unpopulated
  }
}
```

## How to Integrate in a New Frontend (e.g. Star Rail or ZZZ)

1. Implement `MultiSlotDataAdapter` for your game (e.g., in `libs/sr/db-ui` or `libs/zzz/db-ui`).
2. Use the `useCloudSync` hook from `@genshin-optimizer/common/gdrive-ui`:
   ```tsx
   import { useCloudSync } from '@genshin-optimizer/common/gdrive-ui'

   const { session, syncState, login, logout, syncNow } = useCloudSync({
     clientId: process.env.NX_GOOGLE_CLIENT_ID,
     adapter: myGameSlotAdapter,
   })
   ```
3. Add a settings card or button in your UI rendering the sync status and `ConflictDialog`.
