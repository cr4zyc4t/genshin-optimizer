import type { IGOOD } from '@genshin-optimizer/gi/good'
import { z } from 'zod'
import type { ArtCharDatabase } from '../ArtCharDatabase'
import { DataEntry } from '../DataEntry'
import type { IGO, ImportResult } from '../exim'

const cloudSyncMetaSchema = z.object({
  enabled: z.boolean().catch(false),
  remoteFileId: z.string().optional().catch(undefined),
  lastSyncedLocalEdit: z.number().optional().catch(undefined),
  lastSyncedRemoteModifiedTime: z.string().optional().catch(undefined),
  lastSyncedSize: z.number().optional().catch(undefined),
})

export type ICloudSyncMeta = z.infer<typeof cloudSyncMetaSchema>

/**
 * Per-slot cloud-sync bookkeeping (design doc §7). This is deliberately **not** part of the
 * GOOD export/import format — unlike `DBMetaEntry`, `exportGOOD`/`importGOOD` are no-ops here,
 * because a `remoteFileId`/sync timestamps are only meaningful for the exact slot+browser they
 * were recorded on. Letting them travel through a manually-exported/imported GOOD file (or
 * through the cloud-sync payload itself) would let one slot's sync bookkeeping leak into
 * another slot.
 */
export class CloudSyncMetaEntry extends DataEntry<
  'cloudSyncMeta',
  'cloudSyncMeta',
  ICloudSyncMeta,
  ICloudSyncMeta
> {
  constructor(database: ArtCharDatabase) {
    super(
      database,
      'cloudSyncMeta',
      () => cloudSyncMetaSchema.parse({}),
      'cloudSyncMeta'
    )
  }
  override validate(obj: unknown): ICloudSyncMeta | undefined {
    const result = cloudSyncMetaSchema.safeParse(obj)
    return result.success ? result.data : undefined
  }
  override exportGOOD(_go: Partial<IGO & IGOOD>): void {
    // intentionally not exported — see class doc comment
  }
  override importGOOD(_go: IGO & IGOOD, _result: ImportResult): void {
    // intentionally not imported — see class doc comment
  }
}
