const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files'
const MULTIPART_BOUNDARY = 'genshin_optimizer_cloud_sync'

export interface DriveFileMetadata {
  fileId: string
  modifiedTime: string
  size?: number | undefined
}

/**
 * Thin fetch-based client for the Google Drive v3 REST API, scoped entirely to the
 * `appDataFolder` special space (design doc §4/§16.1) — this client never touches the
 * user's regular Drive files/folders.
 *
 * Auth-agnostic by design: the access token is pulled from `getAccessToken()` on every
 * call (rather than stored), so it always uses whatever token `GoogleAuth` currently holds,
 * and so it can be unit-tested with a fake token provider.
 */
export class DriveClient {
  constructor(private readonly getAccessToken: () => string | undefined) {}

  private requireToken(): string {
    const token = this.getAccessToken()
    if (!token) throw new Error('Not signed in to Google Drive')
    return token
  }

  private async request(url: string, init?: RequestInit): Promise<Response> {
    const token = this.requireToken()
    const res = await fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${token}`,
      },
    })
    if (!res.ok) {
      throw new Error(
        `Google Drive API request failed: ${res.status} ${res.statusText}`
      )
    }
    return res
  }

  /** Finds the file id of an appDataFolder file by exact name, if it exists. */
  async findFileIdByName(name: string): Promise<string | undefined> {
    const params = new URLSearchParams({
      spaces: 'appDataFolder',
      q: `name = '${name.replace(/'/g, "\\'")}' and trashed = false`,
      fields: 'files(id)',
    })
    const res = await this.request(`${DRIVE_FILES_ENDPOINT}?${params}`)
    const data = (await res.json()) as { files?: { id: string }[] }
    return data.files?.[0]?.id
  }

  /** Fetches `modifiedTime`/`size` for a file, or `undefined` if it no longer exists. */
  async getFileMetadata(
    fileId: string
  ): Promise<DriveFileMetadata | undefined> {
    try {
      const params = new URLSearchParams({ fields: 'id,modifiedTime,size' })
      const res = await this.request(
        `${DRIVE_FILES_ENDPOINT}/${fileId}?${params}`
      )
      const data = (await res.json()) as {
        id: string
        modifiedTime: string
        size?: string
      }
      return {
        fileId: data.id,
        modifiedTime: data.modifiedTime,
        size: data.size !== undefined ? Number(data.size) : undefined,
      }
    } catch {
      return undefined
    }
  }

  async downloadFile(fileId: string): Promise<string> {
    const res = await this.request(
      `${DRIVE_FILES_ENDPOINT}/${fileId}?alt=media`
    )
    return res.text()
  }

  /** Creates a new file in `appDataFolder` with the given JSON string content. */
  async createFile(name: string, content: string): Promise<DriveFileMetadata> {
    const metadata = { name, parents: ['appDataFolder'] }
    const body =
      `--${MULTIPART_BOUNDARY}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${JSON.stringify(metadata)}\r\n` +
      `--${MULTIPART_BOUNDARY}\r\n` +
      'Content-Type: application/json\r\n\r\n' +
      `${content}\r\n` +
      `--${MULTIPART_BOUNDARY}--`
    const params = new URLSearchParams({
      uploadType: 'multipart',
      fields: 'id,modifiedTime,size',
    })
    const res = await this.request(`${DRIVE_UPLOAD_ENDPOINT}?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${MULTIPART_BOUNDARY}`,
      },
      body,
    })
    const data = (await res.json()) as {
      id: string
      modifiedTime: string
      size?: string
    }
    return {
      fileId: data.id,
      modifiedTime: data.modifiedTime,
      size: data.size !== undefined ? Number(data.size) : undefined,
    }
  }

  /** Overwrites an existing file's content (does not rename/move it). */
  async updateFile(
    fileId: string,
    content: string
  ): Promise<DriveFileMetadata> {
    const params = new URLSearchParams({
      uploadType: 'media',
      fields: 'id,modifiedTime,size',
    })
    const res = await this.request(
      `${DRIVE_UPLOAD_ENDPOINT}/${fileId}?${params}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: content,
      }
    )
    const data = (await res.json()) as {
      id: string
      modifiedTime: string
      size?: string
    }
    return {
      fileId: data.id,
      modifiedTime: data.modifiedTime,
      size: data.size !== undefined ? Number(data.size) : undefined,
    }
  }
}
