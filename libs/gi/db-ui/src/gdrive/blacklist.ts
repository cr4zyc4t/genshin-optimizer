export interface StorageKeyBlacklist {
  readonly exactKeys: ReadonlySet<string>
  readonly prefixPatterns: readonly string[]
}

export const DEFAULT_STORAGE_BLACKLIST: StorageKeyBlacklist = {
  exactKeys: new Set(['snow', 'silly', 'newTabKey']),
  prefixPatterns: ['gdrive_', 'infoShown_'],
}

export function isKeyBlacklisted(
  key: string,
  blacklist: StorageKeyBlacklist = DEFAULT_STORAGE_BLACKLIST
): boolean {
  if (blacklist.exactKeys.has(key)) return true
  for (const prefix of blacklist.prefixPatterns) {
    if (key.startsWith(prefix)) return true
  }
  return false
}
