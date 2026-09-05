# Contract: Google Drive & Identity Client

**Feature**: Google Drive Cloud Synchronization  
**Module**: `@genshin-optimizer/common/gdrive`  
**Spec**: [spec.md](../spec.md)

This contract defines the client-side API for Google Identity Services authentication and Google Drive Application Data Folder operations.

---

## 1. GoogleIdentityClient Interface

```typescript
export interface GISConfig {
  clientId: string
  scope: string // default: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email'
}

export interface IGoogleIdentityClient {
  /**
   * Initializes the Google Identity Services token client.
   * Dynamically injects the GSI script if not already present.
   */
  init(config: GISConfig): Promise<void>

  /**
   * Requests user authorization via GIS popup.
   * Resolves with CloudAccountSession upon approval.
   */
  requestLogin(): Promise<CloudAccountSession>

  /**
   * Attempts a non-interactive silent token refresh if session is near expiration.
   */
  silentRefresh(): Promise<CloudAccountSession | null>

  /**
   * Retrieves user profile details using the active access token.
   */
  fetchUserProfile(accessToken: string): Promise<{
    email: string
    name: string
    picture?: string
  }>

  /**
   * Revokes the current token and clears cached credentials.
   */
  logout(): Promise<void>
}
```

---

## 2. IGoogleDriveApiClient Interface

```typescript
export interface DriveFileMetadata {
  id: string
  name: string
  modifiedTime: string
  size?: string
  version?: string
}

export interface IGoogleDriveApiClient {
  /**
   * Searches the hidden appDataFolder for the sync package file.
   * Returns metadata if exists, or null if file does not exist.
   */
  findFile(
    accessToken: string,
    fileName: string
  ): Promise<DriveFileMetadata | null>

  /**
   * Downloads the raw JSON content of the file from Google Drive.
   */
  downloadFile<T = unknown>(
    accessToken: string,
    fileId: string
  ): Promise<T>

  /**
   * Uploads a new file into the hidden appDataFolder via multipart upload.
   */
  createFile<T = unknown>(
    accessToken: string,
    fileName: string,
    data: T
  ): Promise<DriveFileMetadata>

  /**
   * Overwrites the content of an existing file in appDataFolder.
   */
  updateFile<T = unknown>(
    accessToken: string,
    fileId: string,
    data: T
  ): Promise<DriveFileMetadata>
}
```
