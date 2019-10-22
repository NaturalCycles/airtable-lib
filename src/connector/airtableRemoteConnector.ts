import { _mapValues, filterObject, pMap, pProps, StringMap } from '@naturalcycles/js-lib'
import { AirtableApi } from '../airtable.api'
import {
  AirtableAttachment,
  AirtableAttachmentUpload,
  AirtableBaseDaoCfg,
  AirtableConnector,
  AirtableDaoOptions,
  AirtableRecord,
} from '../airtable.model'
import { AirtableTableDao } from '../airtableTableDao'

export const AIRTABLE_CONNECTOR_REMOTE = Symbol('AIRTABLE_CONNECTOR_JSON')

// export interface AirtableRemoteConnectorCfg<BASE> {}

export class AirtableRemoteConnector<BASE = any> implements AirtableConnector<BASE> {
  constructor(private airtableApi: AirtableApi) {}

  readonly TYPE = AIRTABLE_CONNECTOR_REMOTE

  async fetch(baseDaoCfg: AirtableBaseDaoCfg<BASE>, opts: AirtableDaoOptions = {}): Promise<BASE> {
    const { tableCfgMap } = baseDaoCfg

    return pProps(
      Object.keys(tableCfgMap).reduce(
        (r, tableName) => {
          r[tableName] = this.getTableDao(baseDaoCfg, tableName as keyof BASE).getRecords(opts)
          return r
        },
        {} as BASE,
      ),
      { concurrency: opts.concurrency || 4 },
    )
  }

  /**
   * Multi-pass operation:
   * 1. CreateRecords without airtableId and array field, map old ids to newly createdIds
   * 2. UpdateRecords, set array fields to new airtableIds using map from #1
   *
   * preserveOrder=true means it will upload one by one: slower, but keeping the original order
   */
  async upload(
    base: BASE,
    baseDaoCfg: AirtableBaseDaoCfg<BASE>,
    opts: AirtableDaoOptions = {},
  ): Promise<void> {
    const concurrency = opts.concurrency || 4
    const { tableCfgMap } = baseDaoCfg
    // map from old airtableId to newly-created airtableId
    const idMap: StringMap = {}
    const tableNames = Object.keys(tableCfgMap) as (keyof BASE)[]

    // First pass - insert records, populate idMap
    await pMap(
      tableNames,
      async tableName => {
        const dao = this.getTableDao(baseDaoCfg, tableName)
        await dao.deleteAllRecords(concurrency)

        // One-by-one to preserve order
        await pMap(
          (base[tableName] as any) as AirtableRecord[],
          async _r => {
            const oldId = _r.airtableId

            let r = { ..._r }
            delete r.airtableId
            // Set all array values that are Links as empty array (to avoid `Record ID xxx does not exist` error)
            r = _mapValues(r, v => (isArrayOfLinks(v) ? [] : v))

            // Transform Attachments
            r = _mapValues(r, v => transformAttachments(v as any))

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
        const dao = this.getTableDao(baseDaoCfg, tableName)

        const records = ((base[tableName] as any) as AirtableRecord[])
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
            patch = _mapValues(patch, v => ((v as any) as string[]).map(oldId => idMap[oldId]))
            // console.log({patch2: patch})
            await dao.updateRecord(idMap[airtableId], patch, opts)
          },
          { concurrency },
        )
      },
      { concurrency },
    )
  }

  fetchSync(): never {
    throw new Error('fetchSync not supported for AirtableRemoteConnector')
  }

  private getTableDao<T extends AirtableRecord = AirtableRecord>(
    baseDaoCfg: AirtableBaseDaoCfg<BASE>,
    tableName: keyof BASE,
  ): AirtableTableDao<T> {
    return new AirtableTableDao<T>(
      this.airtableApi,
      baseDaoCfg.baseId,
      tableName as string,
      baseDaoCfg.tableCfgMap[tableName],
    )
  }
}

function isArrayOfLinks(v: any): boolean {
  return (
    Array.isArray(v) &&
    !!v.length &&
    v.some(item => typeof item === 'string' && item.startsWith('rec'))
  )
}

function isArrayOfAttachments(v: any): boolean {
  return (
    Array.isArray(v) &&
    !!v.length &&
    v.some(item => !!item && typeof item === 'object' && !!item.url)
  )
}

function transformAttachments(v: AirtableAttachment[]): AirtableAttachmentUpload[] {
  if (!isArrayOfAttachments(v)) return v

  return v.map(a => ({
    url: a.url,
    filename: a.filename,
  }))
}
