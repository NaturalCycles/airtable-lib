import { InstanceId, logMethod, omit, StringMap } from '@naturalcycles/js-lib'
import {
  AirtableBaseDaoCfg,
  AirtableConnector,
  AirtableDaoOptions,
  AirtableRecord,
} from './airtable.model'
import { sortAirtableBase } from './airtable.util'

/**
 * Holds cache of Airtable Base (all tables, all records, indexed by `airtableId` for quick access).
 * Base is sorted (deterministic order of tables and record keys).
 * Order of rows is preserved as is.
 * Provides API to access records.
 * Provides API to fetch or upload records via provided Connectors (e.g Json, Remote).
 */
export class AirtableBaseDao<BASE = any> implements InstanceId {
  constructor (public cfg: AirtableBaseDaoCfg<BASE>) {
    this.connectorMap = new Map<symbol, AirtableConnector<BASE>>()
    this.lastUpdatedMap = new Map<symbol, number | undefined>()

    cfg.connectors.forEach(c => {
      this.connectorMap.set(c.TYPE, c)
      this.lastUpdatedMap.set(c.TYPE, undefined)
    })

    this.instanceId = this.cfg.baseName
  }

  private connectorMap!: Map<symbol, AirtableConnector<BASE>>

  instanceId!: string

  /**
   * Unix timestamp of when this Base was last updated.
   */
  lastUpdatedMap!: Map<symbol, number | undefined>

  protected cache!: BASE

  /**
   * Map from airtableId to Record
   */
  protected airtableIdIndex!: StringMap<AirtableRecord>

  /**
   * Indexes `this.cache` by `airtableId`
   */
  protected indexCache (): void {
    const airtableIndex: StringMap<AirtableRecord> = {}

    Object.values(this.cache).forEach((records: AirtableRecord[]) => {
      records.forEach(r => (airtableIndex[r.airtableId] = r))
    })

    this.airtableIdIndex = airtableIndex
  }

  getCache (): BASE {
    return this.cache
  }

  setCache (cache: BASE): void {
    this.cache = sortAirtableBase(cache)
    this.indexCache()
  }

  getTableRecords<TABLE_NAME extends keyof BASE> (
    tableName: TABLE_NAME,
    noAirtableIds = false,
  ): BASE[TABLE_NAME] {
    if (noAirtableIds) {
      return ((this.cache[tableName] as any) || []).map((r: AirtableRecord) =>
        omit(r, ['airtableId']),
      )
    } else {
      return (this.cache[tableName] as any) || []
    }
  }

  getById<T extends AirtableRecord> (airtableId?: string): T | undefined {
    return this.airtableIdIndex[airtableId!] as T
  }

  requireById<T extends AirtableRecord> (airtableId: string): T {
    const r = this.airtableIdIndex[airtableId] as T
    if (!r) {
      throw new Error(`requireById ${this.cfg.baseName}.${airtableId} not found`)
    }
    return r
  }

  getByIds<T extends AirtableRecord> (airtableIds: string[] = []): T[] {
    return airtableIds.map(id => this.airtableIdIndex[id]) as T[]
  }

  requireByIds<T extends AirtableRecord> (airtableIds: string[] = []): T[] {
    return airtableIds.map(id => {
      const r = this.airtableIdIndex[id]
      if (!r) {
        throw new Error(`requireByIds ${this.cfg.baseName}.${id} not found`)
      }
      return r
    }) as T[]
  }

  private getConnector (connectorType: symbol): AirtableConnector<BASE> {
    const connector = this.connectorMap.get(connectorType)
    if (!connector) {
      throw new Error(`Connector not found by type: ${String(connectorType)}`)
    }
    return connector
  }

  /**
   * Fetches from Connector.
   *
   * If `opts.cache` is true - saves to cache.
   */
  @logMethod({ logStart: true })
  async fetch (connectorType: symbol, opts: AirtableDaoOptions = {}): Promise<BASE> {
    const base = await this.getConnector(connectorType).fetch(this.cfg, opts)

    if (!opts.preserveLastUpdated) {
      this.lastUpdatedMap.set(connectorType, Math.floor(Date.now() / 1000))
    }

    if (!opts.noCache) {
      this.setCache(base)
      return this.cache // return here to avoid calling sortAirtableBase twice
    }

    return sortAirtableBase(base)
  }

  @logMethod({ logStart: true })
  async upload (connectorType: symbol, opts: AirtableDaoOptions = {}): Promise<void> {
    await this.getConnector(connectorType).upload(this.cache, this.cfg, opts)
  }
}
