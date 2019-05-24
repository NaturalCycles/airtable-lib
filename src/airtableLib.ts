import { filterObject, logMethod, memo, StringMap, transformValues } from '@naturalcycles/js-lib'
import { pMap, pProps } from '@naturalcycles/promise-lib'
import * as AirtableApi from 'airtable'
import * as fs from 'fs-extra'
import {
  AirtableAttachment,
  AirtableAttachmentUpload,
  AirtableBase,
  AirtableBaseMap,
  AirtableBaseSchema,
  AirtableBaseSchemaMap,
  AirtableDaoOptions,
  AirtableLibCfg,
  AirtableRecord,
  AirtableTableSchema,
} from './airtable.model'
import { AirtableCache } from './airtableCache'
import { AirtableDao } from './airtableDao'

export class AirtableLib {
  constructor (public airtableServiceCfg: AirtableLibCfg) {}

  init (): void {
    this.api()
  }

  @memo()
  api (): typeof AirtableApi {
    // lazy-loading the library
    const airtableLib = require('airtable') as typeof AirtableApi

    const { apiKey } = this.airtableServiceCfg

    airtableLib.configure({
      endpointURL: 'https://api.airtable.com',
      apiKey,
      // requestTimeout: 300000,
    })
    return airtableLib
  }

  getDao<T extends AirtableRecord = AirtableRecord> (
    baseId: string,
    tableSchema: AirtableTableSchema,
  ): AirtableDao<T> {
    return new AirtableDao<T>(this.api(), baseId, tableSchema)
  }

  @logMethod({ logStart: true, noLogArgs: true })
  async fetchRemoteBase<BASE extends AirtableBase<BASE>> (
    baseSchema: AirtableBaseSchema,
    opts: AirtableDaoOptions = {},
    concurrency = 4,
  ): Promise<BASE> {
    const { baseId, tableSchemas } = baseSchema

    return pProps(
      tableSchemas.reduce(
        (r, tableSchema) => {
          const { tableName } = tableSchema
          r[tableName] = this.getDao(baseId, tableSchema).getRecords(opts)
          return r
        },
        {} as any,
      ),
      { concurrency },
    )
  }

  /**
   * Fetches all remote Airtable Bases.
   */
  async fetchRemoteBases<BASE_MAP extends AirtableBaseMap<BASE_MAP>> (
    baseSchemaMap: AirtableBaseSchemaMap,
    opts?: AirtableDaoOptions,
  ): Promise<BASE_MAP> {
    const bases = {} as BASE_MAP

    // Concurrency: 1
    for await (const baseName of Object.keys(baseSchemaMap)) {
      bases[baseName] = await this.fetchRemoteBase(baseSchemaMap[baseName], opts)
    }

    return bases
  }

  async fetchRemoteBaseToJson (
    baseSchema: AirtableBaseSchema,
    jsonPath: string,
    opts: AirtableDaoOptions = {},
  ): Promise<void> {
    const base = await this.fetchRemoteBase(baseSchema, opts)
    await fs.ensureFile(jsonPath)
    await fs.writeJson(jsonPath, this.sortBase(base), { spaces: 2 })
  }

  /**
   * Fetches all remote Airtable Bases to json files.
   */
  async fetchRemoteBasesToJson (
    baseSchemaMap: AirtableBaseSchemaMap,
    dir: string,
    opts?: AirtableDaoOptions,
  ): Promise<void> {
    // Concurrency: 1
    for await (const baseName of Object.keys(baseSchemaMap)) {
      const jsonPath = `${dir}/${baseName}.json`
      await this.fetchRemoteBaseToJson(baseSchemaMap[baseName], jsonPath, opts)
    }
  }

  /**
   * @returns number of records saved
   *
   * Multi-pass operation:
   * 1. CreateRecords without airtableId and array field, map old ids to newly createdIds
   * 2. UpdateRecords, set array fields to new airtableIds using map from #1
   *
   * preserveOrder=true means it will upload one by one: slower, but keeping the original order
   */
  async uploadBaseToRemote<BASE extends AirtableBase<BASE>> (
    base: BASE,
    baseSchema: AirtableBaseSchema,
    opts: AirtableDaoOptions = {},
    concurrency = 4,
  ): Promise<number> {
    const { skipPreservingOrder } = opts
    const { baseId, tableSchemas } = baseSchema
    const cache = new AirtableCache<BASE>(base, baseSchema)
    // map from old airtableId to newly-created airtableId
    const idMap: StringMap = {}

    // First pass - insert records, populate idMap
    await pMap(
      tableSchemas,
      async tableSchema => {
        const { tableName } = tableSchema
        const dao = this.getDao(baseId, tableSchema)
        await dao.deleteAllRecords(concurrency)

        // One-by-one to preserve order
        await pMap(
          cache.getTable(tableName as keyof BASE),
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
          { concurrency: skipPreservingOrder ? concurrency : 1 },
        )
      },
      { concurrency },
    )

    // console.log({idMap})

    // Second pass, update records to set correct airtableIds from idMap
    await pMap(
      tableSchemas,
      async tableSchema => {
        const { tableName } = tableSchema
        const dao = this.getDao(baseId, tableSchema)

        const records = cache
          .getTable(tableName as keyof BASE)
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

    return Object.keys(idMap).length
  }

  @logMethod({ logStart: true, noLogArgs: true })
  async uploadJsonToRemoteBase (
    baseSchema: AirtableBaseSchema,
    jsonPath: string,
    opts: AirtableDaoOptions = {},
    concurrency?: number,
  ): Promise<void> {
    const base = require(jsonPath) as StringMap<AirtableRecord[]>
    await this.uploadBaseToRemote(base, baseSchema, opts, concurrency)
  }

  /**
   * Uploads all bases from json files to remote Airtable bases.
   */
  async uploadJsonToRemoteBases (
    baseSchemaMap: AirtableBaseSchemaMap,
    dir: string,
    opts?: AirtableDaoOptions,
  ): Promise<void> {
    await pMap(
      Object.keys(baseSchemaMap),
      async baseName => {
        const jsonPath = `${dir}/${baseName}.json`
        await this.uploadJsonToRemoteBase(baseSchemaMap[baseName], jsonPath, opts)
      },
      { concurrency: 1 },
    )
  }

  getAirtableCacheFromJson<BASE extends AirtableBase<BASE>> (
    baseSchema: AirtableBaseSchema,
    jsonPath: string,
  ): AirtableCache<BASE> {
    const json = require(jsonPath) as BASE
    return new AirtableCache<BASE>(json, baseSchema)
  }

  /**
   * 1. Sorts base by name of the table.
   * 2. Sort all records of all tables by key name.
   */
  sortBase<BASE extends AirtableBase<BASE>> (base: BASE): BASE {
    const newBase = sortObjectKeys(base)

    Object.entries(newBase).forEach(([tableName, records]) => {
      newBase[tableName] = (records as any[]).map(sortObjectKeys)
    })

    return newBase
  }
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
