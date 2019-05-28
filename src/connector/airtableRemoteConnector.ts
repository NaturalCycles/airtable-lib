import { filterObject, StringMap, transformValues } from '@naturalcycles/js-lib'
import { pMap, pProps } from '@naturalcycles/promise-lib'
import { AirtableApi } from '../airtable.api'
import {
  AirtableAttachment,
  AirtableAttachmentUpload,
  AirtableConnector,
  AirtableDaoOptions,
  AirtableRecord,
  AirtableTableDaoCfg,
} from '../airtable.model'
import { AirtableTableDao } from '../airtableTableDao'

export const AIRTABLE_CONNECTOR_REMOTE = Symbol('AIRTABLE_CONNECTOR_JSON')

export interface AirtableRemoteConnectorCfg<BASE> {
  baseId: string
  tableSchemaMap: { [tableName in keyof BASE]: AirtableTableDaoCfg }
}

export class AirtableRemoteConnector<BASE = any> implements AirtableConnector<BASE> {
  constructor (private airtableApi: AirtableApi, private cfg: AirtableRemoteConnectorCfg<BASE>) {}

  readonly TYPE = AIRTABLE_CONNECTOR_REMOTE

  async fetch (opts: AirtableDaoOptions = {}): Promise<BASE> {
    const { tableSchemaMap } = this.cfg

    return pProps(
      Object.keys(tableSchemaMap).reduce(
        (r, tableName) => {
          r[tableName] = this.getTableDao(tableName as keyof BASE).getRecords(opts)
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
  async upload (base: BASE, opts: AirtableDaoOptions = {}): Promise<void> {
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
          (base[tableName] as any) as AirtableRecord[],
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
            patch = transformValues(patch, (_k, v: string[]) => v.map(oldId => idMap[oldId]))
            // console.log({patch2: patch})
            await dao.updateRecord(idMap[airtableId], patch, opts)
          },
          { concurrency },
        )
      },
      { concurrency },
    )
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
