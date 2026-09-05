# Contract: Conflict Resolution Dialog UI

**Feature**: Google Drive Cloud Synchronization  
**Module**: `@genshin-optimizer/common/gdrive-ui`  
**Spec**: [spec.md](../spec.md)

This contract defines the component interface for the conflict resolution modal.

---

## ConflictDialogProps

```typescript
export interface ConflictDialogProps {
  /** Whether the conflict modal is currently open */
  open: boolean

  /** The comparative diagnostic data for local vs cloud */
  conflictData: ConflictComparison | null

  /** Callback invoked when user confirms keeping local data */
  onKeepLocal: () => Promise<void>

  /** Callback invoked when user confirms replacing with cloud data */
  onUseCloud: () => Promise<void>

  /** Whether a resolution operation is in flight */
  isLoading?: boolean
}
```

### Visual & Behavioral Requirements
1. **Modal Title**: "Cloud Synchronization Conflict" (localized via `react-i18next`).
2. **Comparison Matrix**:
   - Column 1: Local Device Data (Modified timestamp, Total Size, Slot breakdown).
   - Column 2: Google Drive Cloud Backup (Modified timestamp, Total Size, Slot breakdown).
3. **Disparity Alert**:
   - If `conflictData.hasSevereDisparity` is true, render a prominent MUI `Alert` with severity `"warning"`:
     *"Caution: One version has substantially less data than the other. Overwriting with the smaller version may cause irreversible loss of characters or artifacts."*
4. **Action Buttons**:
   - `Button color="primary" variant="contained"`: "Keep Local Data (Upload to Cloud)"
   - `Button color="warning" variant="outlined"`: "Use Cloud Data (Overwrite Local)"
   - Both buttons display a loading spinner when `isLoading` is true and disable interactions.
