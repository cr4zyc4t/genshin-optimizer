import type { DriveFileMetadata } from './types'

export class GoogleDriveApiClient {
  private driveApiBase = 'https://www.googleapis.com/drive/v3'
  private uploadApiBase = 'https://www.googleapis.com/upload/drive/v3'

  /**
   * Search for a file by name within the hidden appDataFolder.
   */
  public async findFile(
    accessToken: string,
    fileName: string
  ): Promise<DriveFileMetadata | null> {
    const q = encodeURIComponent(`name='${fileName}' and trashed=false`)
    const fields = encodeURIComponent(
      'files(id,name,modifiedTime,size,version)'
    )
    const url = `${this.driveApiBase}/files?spaces=appDataFolder&q=${q}&fields=${fields}`

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!res.ok) {
      throw new Error(
        `Failed to search appDataFolder: ${res.status} ${res.statusText}`
      )
    }

    const data = await res.json()
    const files = data.files as DriveFileMetadata[]
    return files && files.length > 0 ? files[0] : null
  }

  /**
   * Download the raw JSON payload of a file.
   */
  public async downloadFile<T = unknown>(
    accessToken: string,
    fileId: string
  ): Promise<T> {
    const url = `${this.driveApiBase}/files/${fileId}?alt=media`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!res.ok) {
      throw new Error(
        `Failed to download file from Drive: ${res.status} ${res.statusText}`
      )
    }

    return (await res.json()) as T
  }

  /**
   * Create a new file directly inside the hidden appDataFolder using multipart upload.
   */
  public async createFile<T = unknown>(
    accessToken: string,
    fileName: string,
    data: T
  ): Promise<DriveFileMetadata> {
    const boundary = '-------314159265358979323846'
    const delimiter = `\r\n--${boundary}\r\n`
    const closeDelimiter = `\r\n--${boundary}--`

    const metadata = {
      name: fileName,
      parents: ['appDataFolder'],
    }

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(data) +
      closeDelimiter

    const url = `${this.uploadApiBase}/files?uploadType=multipart`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    })

    if (!res.ok) {
      throw new Error(
        `Failed to create file in appDataFolder: ${res.status} ${res.statusText}`
      )
    }

    return (await res.json()) as DriveFileMetadata
  }

  /**
   * Update the content of an existing file in appDataFolder.
   */
  public async updateFile<T = unknown>(
    accessToken: string,
    fileId: string,
    data: T
  ): Promise<DriveFileMetadata> {
    const url = `${this.uploadApiBase}/files/${fileId}?uploadType=media`
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      throw new Error(
        `Failed to update file in appDataFolder: ${res.status} ${res.statusText}`
      )
    }

    return (await res.json()) as DriveFileMetadata
  }
}
