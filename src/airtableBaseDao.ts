import { InstanceId, StringMap, _LogMethod, _omit } from '@naturalcycles/js-lib'
import { md5 } from '@naturalcycles/nodejs-lib'
import { Subject } from 'rxjs'
import {
  AirtableBaseDaoCfg,
  AirtableConnector,
  AirtableDaoOptions,
  AirtableDaoSaveOptions,
  AirtableRecord,
  AirtableTableCfg,
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
  constructor(public cfg: AirtableBaseDaoCfg<BASE>) {
    this.connectorMap = new Map<symbol, AirtableConnector<BASE>>()
    this.lastFetchedMap = new Map<symbol, number | undefined>()

    // Default to JSON
    this.cfg.lazyConnectorType = this.cfg.lazyConnectorType || AIRTABLE_CONNECTOR_JSON

    cfg.connectors.forEach(c => {
      this.connectorMap.set(c.TYPE, c)
      this.lastFetchedMap.set(c.TYPE, undefined)
    })

    this.instanceId = this.cfg.baseName
  }

  private connectorMap!: Map<symbol, AirtableConnector<BASE>>

  instanceId!: string

  /**
   * Unix timestamp of when this Base was last fetched (for given Connector).
   */
  lastFetchedMap!: Map<symbol, number | undefined>

  /**
   * Unix timestamp of when the cache of this Base was last changed. Initially `undefined`.
   */
  lastChanged?: number

  /**
   * Fires every time when Cache is changed (including when it's set to `undefined`, including the very first fetch).
   */
  cacheUpdated$ = new Subject<BASE>()

  private _cache?: BASE

  /**
   * Deterministic hash of BASE content. Should NOT change if content is the same, should change otherwise.
   * `undefined` for empty BASE.
   * Used to detect change of content and fire `cacheUpdated$` when changed.
   */
  private contentHash?: string

  /**
   * Map from airtableId to Record
   */
  private _airtableIdIndex?: StringMap<AirtableRecord>

  /**
   * _tableIdIndex[tableName][id]
   * where id is defined by idField property
   */
  private _tableIdIndex?: StringMap<StringMap<AirtableRecord>>

  getCache(): BASE {
    if (!this._cache) {
      if (!this.cfg.lazyConnectorType) {
        throw new Error(`lazyConnectorType not defined for ${this.instanceId}`)
      }

      this.setCache(this.getConnector(this.cfg.lazyConnectorType).fetchSync(this.cfg), {
        preserveLastChanged: true,
      })
    }

    return this._cache!
  }

  setCache(cache?: BASE, opt: AirtableDaoOptions = {}): void {
    if (!cache) {
      console.warn(`AirtableBaseDao.${this.instanceId} setCache to undefined`)
      this._cache = undefined
      this._airtableIdIndex = undefined
      this.contentHash = undefined
      this.cacheUpdated$.next(undefined)
      return
    }

    cache = sortAirtableBase(cache)
    const newContentHash = md5(JSON.stringify(cache))

    if (newContentHash === this.contentHash) {
      console.log(
        `AirtableBaseDao.${this.instanceId} setCache: contentHash unchanged (${newContentHash})`,
      )
      return
    }

    const cacheWasDefined = !!this._cache
    this._cache = cache
    this.contentHash = newContentHash

    // Index cache
    const airtableIndex: StringMap<AirtableRecord> = {}

    Object.values(this._cache).forEach((records: AirtableRecord[]) => {
      records.forEach(r => (airtableIndex[r.airtableId] = r))
    })

    this._airtableIdIndex = airtableIndex

    // TableIdIndex
    const tableIdIndex: StringMap<StringMap<AirtableRecord>> = {}
    Object.entries(this.cfg.tableCfgMap).forEach(([tableName, cfg]) => {
      const { idField } = cfg as AirtableTableCfg
      tableIdIndex[tableName] = {}
      ;(this._cache![tableName] || []).forEach(
        (r: AirtableRecord) => (tableIdIndex[tableName]![r[idField]] = r),
      )
    })

    this._tableIdIndex = tableIdIndex

    // Update
    if (!opt.preserveLastChanged && cacheWasDefined) {
      this.lastChanged = Math.floor(Date.now() / 1000)
    }
    this.cacheUpdated$.next(this._cache)
  }

  private getAirtableIndex(): StringMap<AirtableRecord> {
    if (!this._airtableIdIndex) {
      this.getCache()
    }

    return this._airtableIdIndex!
  }

  private getTableIdIndex(): StringMap<StringMap<AirtableRecord>> {
    if (!this._tableIdIndex) {
      this.getCache()
    }

    return this._tableIdIndex!
  }

  getTableRecords<TABLE_NAME extends keyof BASE>(
    tableName: TABLE_NAME,
    noAirtableIds = false,
  ): BASE[TABLE_NAME] {
    if (noAirtableIds) {
      return ((this.getCache()[tableName] as any) || []).map((r: AirtableRecord) =>
        _omit(r, ['airtableId']),
      )
    } else {
      return (this.getCache()[tableName] as any) || []
    }
  }

  getById<T extends AirtableRecord>(table: string, id?: string): T | undefined {
    return this.getTableIdIndex()[table]?.[id!] as T
  }

  getByIds<T extends AirtableRecord>(table: string, ids: string[]): T[] {
    return ids.map(id => this.getTableIdIndex()[table]?.[id]) as T[]
  }

  requireById<T extends AirtableRecord>(table: string, id: string): T | undefined {
    const r = this.getTableIdIndex()[table]?.[id] as T
    if (!r) {
      throw new Error(`requireById ${this.cfg.baseName}.${table}.${id} not found`)
    }
    return r
  }

  requireByIds<T extends AirtableRecord>(table: string, ids: string[]): T[] {
    return ids.map(id => {
      const r = this.getTableIdIndex()[table]?.[id] as T
      if (!r) {
        throw new Error(`requireByIds ${this.cfg.baseName}.${table}.${id} not found`)
      }
      return r
    })
  }

  getByAirtableId<T extends AirtableRecord>(airtableId?: string): T | undefined {
    return this.getAirtableIndex()[airtableId!] as T
  }

  requireByAirtableId<T extends AirtableRecord>(airtableId: string): T {
    const r = this.getAirtableIndex()[airtableId] as T
    if (!r) {
      throw new Error(`requireByAirtableId ${this.cfg.baseName}.${airtableId} not found`)
    }
    return r
  }

  getByAirtableIds<T extends AirtableRecord>(airtableIds: string[] = []): T[] {
    return airtableIds.map(id => this.getAirtableIndex()[id]) as T[]
  }

  requireByAirtableIds<T extends AirtableRecord>(airtableIds: string[] = []): T[] {
    return airtableIds.map(id => {
      const r = this.getAirtableIndex()[id]
      if (!r) {
        throw new Error(`requireByAirtableIds ${this.cfg.baseName}.${id} not found`)
      }
      return r
    }) as T[]
  }

  private getConnector(connectorType: symbol): AirtableConnector<BASE> {
    const connector = this.connectorMap.get(connectorType)
    if (!connector) {
      throw new Error(`Connector not found by type: ${String(connectorType)}`)
    }
    return connector
  }

  /**
   * Fetches from Connector.
   *
   * If `opt.cache` is true - saves to cache.
   */
  @_LogMethod({ logStart: true })
  async fetch(connectorType: symbol, opt: AirtableDaoOptions = {}): Promise<BASE> {
    const base = await this.getConnector(connectorType).fetch(this.cfg, opt)

    if (!base) {
      console.warn(`AirtableBaseDao.${this.instanceId}.fetch returned empty base`)
      return undefined as any
    }

    if (opt.noCache) {
      return sortAirtableBase(base)
    }

    if (!opt.preserveLastFetched) {
      this.lastFetchedMap.set(connectorType, Math.floor(Date.now() / 1000))
    }

    this.setCache(base, opt)
    return this._cache!
  }

  @_LogMethod({ logStart: true })
  async upload(connectorType: symbol, opt: AirtableDaoSaveOptions = {}): Promise<void> {
    await this.getConnector(connectorType).upload(this.getCache(), this.cfg, opt)
  }
}
