import { filterObject, logMethod, memo, StringMap, transformValues } from '@naturalcycles/js-lib'
import { pMap, pProps } from '@naturalcycles/promise-lib'
import * as AirtableApi from 'airtable'
import * as fs from 'fs-extra'
import {
  AirtableBaseSchema,
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
  async fetchBase<BASE> (
    baseSchema: AirtableBaseSchema,
    opts: AirtableDaoOptions = {},
  ): Promise<BASE> {
    const { baseId, tableSchemas } = baseSchema

    return pProps(
      tableSchemas.reduce(
        (r, tableSchema) => {
          const { tableName } = tableSchema
          r[tableName] = this.getDao(baseId, tableSchema).getRecords(opts)
          return r
        },
        {} as BASE,
      ),
    )
  }

  getBaseFromJson<BASE> (baseSchema: AirtableBaseSchema, jsonPath: string): AirtableCache<BASE> {
    const json = require(jsonPath) as BASE
    return new AirtableCache<BASE>(json, baseSchema)
  }

  /**
   * @returns number of records saved
   *
   * todo: multi-pass
   * 1. CreateRecords without airtableId and array field, map old ids to newly createdIds
   * 2. UpdateRecords, set array fields to new airtableIds using map from #1
   */
  async uploadBase<BASE = any> (
    base: BASE,
    baseSchema: AirtableBaseSchema,
    opts: AirtableDaoOptions = {},
    concurrency = 4,
  ): Promise<number> {
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
            // Set all array values as empty array (to avoid `Record ID xxx does not exist` error)
            r = transformValues(r, (_k, v) => (Array.isArray(v) ? [] : v))

            const newRecord = await dao.createRecord(r, opts)
            idMap[oldId] = newRecord.airtableId
          },
          { concurrency: 1 },
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
          .filter(r => Object.values(r).some(v => Array.isArray(v) && !!v.length))

        await pMap(
          records,
          async r => {
            const { airtableId } = r
            // only array values
            let patch = filterObject(r, (_k, v) => Array.isArray(v) && !!v.length)
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
  async fetchBaseToJson (
    baseSchema: AirtableBaseSchema,
    jsonPath: string,
    opts: AirtableDaoOptions = {},
  ): Promise<void> {
    const base = await this.fetchBase(baseSchema, opts)
    await fs.ensureFile(jsonPath)
    await fs.writeJson(jsonPath, this.sortBase(base), { spaces: 2 })
  }

  @logMethod({ logStart: true, noLogArgs: true })
  async uploadJsonToBase (
    baseSchema: AirtableBaseSchema,
    jsonPath: string,
    opts: AirtableDaoOptions = {},
    concurrency?: number,
  ): Promise<void> {
    const base = require(jsonPath) as StringMap<AirtableRecord[]>
    await this.uploadBase(base, baseSchema, opts, concurrency)
  }

  /**
   * 1. Sorts base by name of the table.
   * 2. Sort all records of all tables by key name.
   */
  sortBase<BASE> (base: BASE): BASE {
    const newBase = sortObjectKeys(base)

    Object.entries(newBase).forEach(([tableName, records]) => {
      newBase[tableName] = records.map(sortObjectKeys)
    })

    return newBase
  }

  /**
   * Mutates the base!
   */
  /*
  private resolveBase (base: StringMap<AirtableRecord[]>): void {
    const idMap: StringMap<AirtableRecord> = {}

    // First pass: populate idMap
    Object.values(base).forEach(records => {
      records.forEach(r => idMap[r.airtableId] = r)
    })

    // Second pass: resolve using idMap
    Object.values(base).forEach(records => {
      records.forEach(r => {
        filterObject(r, k => !k.startsWith('_'), true)
        return transformValues(r, (k, v) => {
          if (Array.isArray(v) && v.length) {
            // todo: throw on unresolved?..
            return v.map((airtableId: string) => {
              if (!idMap[airtableId]) throw new Error(`Cannot resolve ${airtableId}`)
              return idMap[airtableId]
            })
          }
          return v
        }, true)
      })
    })
  }
   */
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
