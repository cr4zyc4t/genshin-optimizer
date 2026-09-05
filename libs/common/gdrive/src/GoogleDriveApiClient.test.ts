import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GoogleDriveApiClient } from './GoogleDriveApiClient'

describe('GoogleDriveApiClient', () => {
  let client: GoogleDriveApiClient

  beforeEach(() => {
    vi.restoreAllMocks()
    client = new GoogleDriveApiClient()
  })

  it('finds file in appDataFolder when it exists', async () => {
    const mockFilesResponse = {
      files: [
        {
          id: 'file-xyz-123',
          name: 'genshin_optimizer_sync.json',
          modifiedTime: '2026-09-05T12:00:00Z',
          size: '1024',
        },
      ],
    }

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockFilesResponse,
    } as Response)

    const file = await client.findFile(
      'test-token',
      'genshin_optimizer_sync.json'
    )
    expect(file).not.toBeNull()
    expect(file?.id).toBe('file-xyz-123')
    expect(file?.modifiedTime).toBe('2026-09-05T12:00:00Z')
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('orderBy=modifiedTime%20desc'),
      expect.anything()
    )
  })

  it('returns null when file does not exist in appDataFolder', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ files: [] }),
    } as Response)

    const file = await client.findFile('test-token', 'nonexistent.json')
    expect(file).toBeNull()
  })

  it('downloads file content', async () => {
    const mockData = { version: 1, appId: 'genshin-optimizer', slots: {} }

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response)

    const content = await client.downloadFile('test-token', 'file-xyz-123')
    expect(content).toEqual(mockData)
  })

  it('creates file via multipart upload with fields query parameter', async () => {
    const mockCreateResponse = {
      id: 'new-file-id',
      name: 'genshin_optimizer_sync.json',
      modifiedTime: '2026-09-05T12:05:00Z',
    }

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockCreateResponse,
    } as Response)

    const created = await client.createFile(
      'test-token',
      'genshin_optimizer_sync.json',
      { test: true }
    )
    expect(created.id).toBe('new-file-id')
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('fields='),
      expect.anything()
    )
  })

  it('updates file content with fields query parameter', async () => {
    const mockUpdateResponse = {
      id: 'existing-file-id',
      name: 'genshin_optimizer_sync.json',
      modifiedTime: '2026-09-05T12:10:00Z',
    }

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockUpdateResponse,
    } as Response)

    const updated = await client.updateFile('test-token', 'existing-file-id', {
      test: true,
    })
    expect(updated.modifiedTime).toBe('2026-09-05T12:10:00Z')
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('fields='),
      expect.anything()
    )
  })
})
