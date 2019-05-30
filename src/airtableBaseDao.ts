import { InstanceId, logMethod, omit, StringMap } from '@naturalcycles/js-lib'
import {
  AirtableBaseDaoCfg,
  AirtableConnector,
  AirtableDaoOptions,
  AirtableRecord,
} from './airtable.model'
import { sortAirtableBase } from './airtable.util'
import { AIRTABLE_CONNECTOR_JSON } from './connector/airtableJsonConnector'

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

    // Default to JSON
    this.cfg.lazyConnectorType = this.cfg.lazyConnectorType || AIRTABLE_CONNECTOR_JSON

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

  private _cache?: BASE

  /**
   * Map from airtableId to Record
   */
  private _airtableIdIndex?: StringMap<AirtableRecord>

  getCache (): BASE {
    if (!this._cache) {
      if (!this.cfg.lazyConnectorType) {
        throw new Error(`lazyConnectorType not defined for ${this.instanceId}`)
      }

      this.setCache(this.getConnector(this.cfg.lazyConnectorType).fetchSync(this.cfg))
    }

    return this._cache!
  }

  setCache (cache: BASE): void {
    this._cache = sortAirtableBase(cache)

    // Index cache
    const airtableIndex: StringMap<AirtableRecord> = {}

    Object.values(this._cache).forEach((records: AirtableRecord[]) => {
      records.forEach(r => (airtableIndex[r.airtableId] = r))
    })

    this._airtableIdIndex = airtableIndex
  }

  private getAirtableIndex (): StringMap<AirtableRecord> {
    if (!this._airtableIdIndex) {
      this.getCache()
    }

    return this._airtableIdIndex!
  }

  getTableRecords<TABLE_NAME extends keyof BASE> (
    tableName: TABLE_NAME,
    noAirtableIds = false,
  ): BASE[TABLE_NAME] {
    if (noAirtableIds) {
      return ((this.getCache()[tableName] as any) || []).map((r: AirtableRecord) =>
        omit(r, ['airtableId']),
      )
    } else {
      return (this.getCache()[tableName] as any) || []
    }
  }

  getById<T extends AirtableRecord> (airtableId?: string): T | undefined {
    return this.getAirtableIndex()[airtableId!] as T
  }

  requireById<T extends AirtableRecord> (airtableId: string): T {
    const r = this.getAirtableIndex()[airtableId] as T
    if (!r) {
      throw new Error(`requireById ${this.cfg.baseName}.${airtableId} not found`)
    }
    return r
  }

  getByIds<T extends AirtableRecord> (airtableIds: string[] = []): T[] {
    return airtableIds.map(id => this.getAirtableIndex()[id]) as T[]
  }

  requireByIds<T extends AirtableRecord> (airtableIds: string[] = []): T[] {
    return airtableIds.map(id => {
      const r = this.getAirtableIndex()[id]
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
      return this._cache! // return here to avoid calling sortAirtableBase twice
    }

    return sortAirtableBase(base)
  }

  @logMethod({ logStart: true })
  async upload (connectorType: symbol, opts: AirtableDaoOptions = {}): Promise<void> {
    await this.getConnector(connectorType).upload(this.getCache(), this.cfg, opts)
  }
}
