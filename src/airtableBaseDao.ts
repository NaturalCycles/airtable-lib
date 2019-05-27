import {
  filterObject,
  InstanceId,
  logMethod,
  omit,
  StringMap,
  transformValues,
} from '@naturalcycles/js-lib'
import { pMap, pProps } from '@naturalcycles/promise-lib'
import * as fs from 'fs-extra'
import { AirtableApi } from './airtable.api'
import {
  AirtableAttachment,
  AirtableAttachmentUpload,
  AirtableBaseDaoCfg,
  AirtableDaoOptions,
  AirtableRecord,
} from './airtable.model'
import { AirtableTableDao } from './airtableTableDao'

/**
 * Holds cache of Airtable Base (all tables, all records, indexed by `airtableId` for quick access).
 * Base is sorted (deterministic order of tables and record keys).
 * Order of rows is preserved as is.
 * Provides API to access records.
 *
 * Call .loadFromJson() to loads json cache from cacheDir.
 */
export class AirtableBaseDao<BASE = any> implements InstanceId {
  constructor (
    protected airtableApi: AirtableApi,
    public cfg: AirtableBaseDaoCfg<BASE>,
    cache?: BASE,
  ) {
    if (cache) {
      this.setCache(cache)
    }

    this.jsonPath = `${this.cfg.cacheDir}/${this.cfg.baseName}.json`
    this.instanceId = this.cfg.baseName
  }

  instanceId!: string

  jsonPath!: string

  /**
   * Unix timestamp of when this Base was last updated.
   */
  lastUpdated?: number

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

    Object.values(this.cache).forEach(records => {
      ;(records as AirtableRecord[]).forEach(r => (airtableIndex[r.airtableId] = r))
    })

    this.airtableIdIndex = airtableIndex
  }

  init (): void {
    this.getCache()
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

  getTableDao<T extends AirtableRecord = AirtableRecord> (
    tableName: keyof BASE,
  ): AirtableTableDao<T> {
    return new AirtableTableDao<T>(
      this.airtableApi,
      this.cfg.baseId,
      tableName as string,
      this.cfg.tableSchemaMap[tableName],
    )
  }

  loadFromJson (): void {
    this.setCache(require(this.jsonPath))
  }

  /**
   * Returned base is sorted.
   */
  @logMethod({ logStart: true, noLogArgs: true })
  async fetchFromRemote (opts: AirtableDaoOptions = {}): Promise<BASE> {
    const { tableSchemaMap } = this.cfg

    const base: BASE = await pProps(
      Object.keys(tableSchemaMap).reduce(
        (r, tableName) => {
          r[tableName] = this.getTableDao(tableName as keyof BASE).getRecords(opts)
          return r
        },
        {} as BASE,
      ),
      { concurrency: opts.concurrency || 4 },
    )

    if (opts.cache) {
      this.lastUpdated = Math.floor(Date.now() / 1000)
      this.setCache(base)
    }

    return sortAirtableBase(base)
  }

  async fetchFromRemoteToJson (opts: AirtableDaoOptions = {}): Promise<void> {
    const base = await this.fetchFromRemote(opts)

    await fs.ensureFile(this.jsonPath)
    await fs.writeJson(this.jsonPath, base, { spaces: 2 })
  }

  // todo: override baseId (for backup)? Or create new AirtableBaseDao with baseId of backup base
  /**
   * @returns number of records saved
   *
   * Multi-pass operation:
   * 1. CreateRecords without airtableId and array field, map old ids to newly createdIds
   * 2. UpdateRecords, set array fields to new airtableIds using map from #1
   *
   * preserveOrder=true means it will upload one by one: slower, but keeping the original order
   */
  async uploadToRemote (opts: AirtableDaoOptions = {}): Promise<number> {
    const concurrency = opts.concurrency || 4
    const { tableSchemaMap } = this.cfg
    // map from old airtableId to newly-created airtableId
    const idMap: StringMap = {}
    const tableNames = Object.keys(tableSchemaMap) as (keyof BASE)[]

    // First pass - insert records, populate idMap
    await pMap(
      tableNames,
      async tableName => {
        const dao = this.getTableDao(tableName)
        await dao.deleteAllRecords(concurrency)

        // One-by-one to preserve order
        await pMap(
          (this.getTableRecords(tableName) as any) as AirtableRecord[],
          async _r => {
            const oldId = _r.airtableId

            let r = { ..._r }
            delete r.airtableId
            // Set all array values that are Links as empty array (to avoid `Record ID xxx does not exist` error)
            r = transformValues(r, (_k, v) => (isArrayOfLinks(v) ? [] : v))

            // Transform Attachments
            r = transformValues(r, transformAttachments)

            const newRecord = await dao.createRecord(r, opts)
            idMap[oldId] = newRecord.airtableId
          },
          { concurrency: opts.skipPreservingOrder ? concurrency : 1 },
        )
      },
      { concurrency },
    )

    // console.log({idMap})

    // Second pass, update records to set correct airtableIds from idMap
    await pMap(
      tableNames,
      async tableName => {
        const dao = this.getTableDao(tableName)

        const records = ((this.getTableRecords(tableName) as any) as AirtableRecord[])
          // Only records with non-empty array values
          .filter(r => Object.values(r).some(isArrayOfLinks))

        await pMap(
          records,
          async r => {
            const { airtableId } = r
            // only array values
            let patch = filterObject(r, (_k, v) => isArrayOfLinks(v))
            // console.log({patch1: patch})
            // use idMap
            patch = transformValues(patch, (_k, v: string[]) => v.map(oldId => idMap[oldId]))
            // console.log({patch2: patch})
            await dao.updateRecord(idMap[airtableId], patch, opts)
          },
          { concurrency },
        )
      },
      { concurrency },
    )

    // todo: check if this.cache needs to be updated with new airtableIds

    return Object.keys(idMap).length
  }
}

function isArrayOfLinks (v: any): boolean {
  return (
    Array.isArray(v) &&
    !!v.length &&
    v.some(item => typeof item === 'string' && item.startsWith('rec'))
  )
}

function isArrayOfAttachments (v: any): boolean {
  return (
    Array.isArray(v) &&
    !!v.length &&
    v.some(item => !!item && typeof item === 'object' && !!item.url)
  )
}

function transformAttachments (_k: any, v: AirtableAttachment[]): AirtableAttachmentUpload[] {
  if (!isArrayOfAttachments(v)) return v

  return v.map(a => ({
    url: a.url,
    filename: a.filename,
  }))
}

/**
 * 1. Sorts base by name of the table.
 * 2. Sort all records of all tables by key name.
 */
export function sortAirtableBase<BASE> (base: BASE): BASE {
  const newBase = sortObjectKeys(base)

  Object.entries(newBase).forEach(([tableName, records]) => {
    newBase[tableName] = (records as any[]).map(sortObjectKeys)
  })

  return newBase
}

function sortObjectKeys<T> (o: T): T {
  return Object.keys(o)
    .sort()
    .reduce(
      (r, k) => {
        r[k] = o[k]
        return r
      },
      {} as T,
    )
}
