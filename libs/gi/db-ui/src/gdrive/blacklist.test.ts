import { describe, it, expect } from 'vitest'
import { isKeyBlacklisted, type StorageKeyBlacklist } from './blacklist'

describe('isKeyBlacklisted', () => {
  it('returns true for exact blacklisted keys', () => {
    expect(isKeyBlacklisted('snow')).toBe(true)
    expect(isKeyBlacklisted('silly')).toBe(true)
    expect(isKeyBlacklisted('newTabKey')).toBe(true)
  })

  it('returns true for keys matching prefix patterns', () => {
    expect(isKeyBlacklisted('gdrive_sync_metadata')).toBe(true)
    expect(isKeyBlacklisted('gdrive_auth_session')).toBe(true)
    expect(isKeyBlacklisted('gdrive_auth_state')).toBe(true)
    expect(isKeyBlacklisted('infoShown_characters')).toBe(true)
    expect(isKeyBlacklisted('infoShown_artifacts')).toBe(true)
  })

  it('returns false for non-blacklisted database keys', () => {
    expect(isKeyBlacklisted('db_ver')).toBe(false)
    expect(isKeyBlacklisted('dbIndex')).toBe(false)
    expect(isKeyBlacklisted('artifact_12345')).toBe(false)
    expect(isKeyBlacklisted('char_furina')).toBe(false)
    expect(isKeyBlacklisted('weapon_sword_favonius')).toBe(false)
    expect(isKeyBlacklisted('extraDatabase_2')).toBe(false)
    expect(isKeyBlacklisted('build_amber_1')).toBe(false)
  })

  it('supports custom blacklist configurations', () => {
    const customBlacklist: StorageKeyBlacklist = {
      exactKeys: new Set(['customKey']),
      prefixPatterns: ['custom_prefix_'],
    }

    expect(isKeyBlacklisted('customKey', customBlacklist)).toBe(true)
    expect(isKeyBlacklisted('custom_prefix_abc', customBlacklist)).toBe(true)
    expect(isKeyBlacklisted('snow', customBlacklist)).toBe(false)
    expect(isKeyBlacklisted('gdrive_sync_metadata', customBlacklist)).toBe(
      false
    )
  })
})
