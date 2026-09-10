# Contract: Storage Key Blacklist Filter

**Module**: `@genshin-optimizer/gi/db-ui` (or shared database/sync utility)  
**Target File**: `libs/gi/db-ui/src/gdrive/GenshinSlotAdapter.ts` (or `libs/gi/db-ui/src/gdrive/blacklist.ts`)

---

## 1. Type Definitions

```typescript
export interface StorageKeyBlacklist {
  readonly exactKeys: ReadonlySet<string>
  readonly prefixPatterns: readonly string[]
}
```

---

## 2. Default Configuration

```typescript
export const DEFAULT_STORAGE_BLACKLIST: StorageKeyBlacklist = {
  exactKeys: new Set([
    'snow',
    'silly',
    'newTabKey',
  ]),
  prefixPatterns: [
    'gdrive_',
    'infoShown_',
  ],
}
```

---

## 3. Contract Specification: `isKeyBlacklisted`

### Function Signature
```typescript
export function isKeyBlacklisted(
  key: string,
  blacklist?: StorageKeyBlacklist
): boolean
```

### Preconditions
- `key` is a string (storage key being written or removed).
- `blacklist` defaults to `DEFAULT_STORAGE_BLACKLIST` if omitted.

### Postconditions / Invariants
1. Returns `true` if `blacklist.exactKeys.has(key)`.
2. Returns `true` if any `prefix` in `blacklist.prefixPatterns` satisfies `key.startsWith(prefix)`.
3. Returns `false` otherwise.
4. Execution time MUST be $O(1 + M \cdot L)$ where $M$ is prefix count ($\approx 2$) and $L$ is prefix length ($\le 10$ chars), guaranteeing sub-microsecond evaluation.
5. Deterministic and side-effect free.

### Examples

| Input Key | Expected Result | Reason |
| :--- | :---: | :--- |
| `'gdrive_sync_metadata'` | `true` | Matches prefix `'gdrive_'` |
| `'gdrive_auth_session'` | `true` | Matches prefix `'gdrive_'` |
| `'snow'` | `true` | Matches exact key `'snow'` |
| `'infoShown_characters'` | `true` | Matches prefix `'infoShown_'` |
| `'artifact_1234'` | `false` | Allowed database key |
| `'char_furina'` | `false` | Allowed database key |
| `'dbIndex'` | `false` | Allowed slot index key |
| `'db_ver'` | `false` | Allowed database version key |
| `'extraDatabase_2'` | `false` | Allowed slot database key |
