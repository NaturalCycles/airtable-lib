import { Readable } from 'node:stream'
import {
  BaseCommonDB,
  CommonDB,
  commonDBFullSupport,
  CommonDBOptions,
  CommonDBSaveOptions,
  CommonDBStreamOptions,
  CommonDBSupport,
  CommonDBType,
  DBQuery,
  queryInMemory,
  RunQueryResult,
} from '@naturalcycles/db-lib'
import {
  AppError,
  pMap,
  _by,
  _omit,
  _mapValues,
  AnyObject,
  ObjectWithId,
} from '@naturalcycles/js-lib'
import { _inspect, ReadableTyped } from '@naturalcycles/nodejs-lib'
import {
  AirtableApi,
  AirtableApiRecord,
  AirtableApiSelectOpts,
  AirtableApiTable,
} from './airtable.api'
import { AirtableRecord, AirtableErrorCode } from './airtable.model'
import { stripQueryStringFromAttachments } from './airtable.util'
import { dbQueryToAirtableSelectOptions } from './query.util'

// eslint-disable-next-line unused-imports/no-unused-vars
export interface AirtableDBCfg<BASE = any> {
  /**
   * Airtable apiKey
   */
  apiKey: string

  /**
   * Defaults to 40 seconds.
   */
  requestTimeout?: number

  /**
   * If defined - it will be used for all tables.
   *
   * If not defined - you'll need to pass `baseId` as part of the `table`, e.g `${baseId}.${table}`
   */
  baseId?: string

  /**
   * Set to true to strip away query string from attachment urls.
   * E.g
   * TAYGREWE3.JPG?ts=1651857038&userId=usrgPxsBnMxTz7qD2&cs=3ff02a34e23ce4df
   * will become:
   * TAYGREWE3.JPG
   *
   * Defaults to false.
   */
  noAttachmentQueryString?: boolean
}

export interface AirtableDBOptions extends CommonDBOptions {
  /**
   * @default `id`
   */
  idField?: string
}
export type AirtableDBStreamOptions = CommonDBStreamOptions
export interface AirtableDBSaveOptions<ROW extends ObjectWithId>
  extends AirtableDBOptions,
    CommonDBSaveOptions<ROW> {}

/**
 * CommonDB implementation based on Airtable sheets.
 */
export class AirtableDB extends BaseCommonDB implements CommonDB {
  override dbType = CommonDBType.relational

  override support: CommonDBSupport = {
    ...commonDBFullSupport,
    bufferValues: false,
    nullValues: false,
    updateByQuery: false,
    transactions: false,
    insertSaveMethod: false,
    updateSaveMethod: false,
  }

  constructor(public cfg: AirtableDBCfg) {
    super()
    // lazy-loading the library
    const airtableApi = require('airtable') as AirtableApi

    airtableApi.configure({
      // endpointURL: 'https://api.airtable.com',
      apiKey: cfg.apiKey,
      // Default is 5 minutes, we override the default to 40 seconds
      requestTimeout: cfg.requestTimeout || 40_000,
    })

    this.api = airtableApi
  }

  api: AirtableApi

  override async ping(): Promise<void> {
    // impossible to implement without having a baseId and a known Table name there
  }

  override async getByIds<ROW extends ObjectWithId>(
    table: string,
    ids: string[],
    opt: AirtableDBOptions = {},
  ): Promise<ROW[]> {
    if (!ids.length) return []

    const { idField = 'id' } = opt
    const pairs = ids.map(id => `{${idField}}="${id}"`)
    const filterByFormula = `OR(${pairs.join(',')})`

    return (
      await this.queryAirtableRecords<ROW>(
        table,
        {
          filterByFormula,
        },
        opt,
      )
    ).sort((a, b) => (a[idField as keyof ROW] > b[idField as keyof ROW] ? 1 : -1))
  }

  override async deleteByIds(
    table: string,
    ids: string[],
    opt: AirtableDBOptions = {},
  ): Promise<number> {
    if (!ids.length) return 0

    // step 1: get airtableIds of the records
    const { idField = 'id' } = opt
    const pairs = ids.map(id => `{${idField}}="${id}"`)
    const filterByFormula = `OR(${pairs.join(',')})`
    const airtableIds = (
      await this.queryAirtableRecords<AirtableRecord & ObjectWithId>(
        table,
        {
          fields: [], // no fields, just airtableIds
          filterByFormula,
        },
        opt,
      )
    ).map(r => r.airtableId)

    // step 2: delete by airtableIds
    const tableApi = this.tableApi<ObjectWithId>(table)

    await pMap(
      airtableIds,
      async airtableId => {
        await tableApi
          .destroy(airtableId)
          .catch(err => this.onErrorOrUndefined(err, table, { airtableId }))
      },
      { concurrency: 4 },
    )

    return airtableIds.length
  }

  /**
   * Does "upsert" always
   */
  override async saveBatch<ROW extends ObjectWithId>(
    table: string,
    rows: ROW[],
    opt?: AirtableDBSaveOptions<ROW>,
  ): Promise<void> {
    // db-lib requires `undefined` values to not be saved/loaded
    // rows = rows.map(r => _filterUndefinedValues(r))

    const existingRows = await this.getByIds<ROW & ObjectWithId & AirtableRecord>(
      table,
      rows.map(r => r.id),
      opt,
    )
    const existingRowById = _by(existingRows, r => r.id)
    // console.log({existingRecordById})

    await pMap(
      rows,
      async r => {
        if (existingRowById[r.id]) {
          // console.log(`will update ${r.id} to ${existingRowById[r.id]!.airtableId}`)
          await this.updateRecord(table, existingRowById[r.id]!.airtableId, r)
        } else {
          await this.createRecord(table, r)
        }
      },
      { concurrency: 4 },
    )
  }

  override async runQuery<ROW extends ObjectWithId>(
    q: DBQuery<ROW>,
    opt: AirtableDBOptions = {},
  ): Promise<RunQueryResult<ROW>> {
    const selectOpts = dbQueryToAirtableSelectOptions<ROW>(q, opt)
    // console.log({selectOpts})

    // todo: opt.table
    let rows = await this.queryAirtableRecords<any>(q.table, selectOpts, opt, q)

    // Cause Airtable doesn't sort it for you
    if (q._orders.length) {
      rows = queryInMemory(q, rows)
    }

    return {
      rows,
    }
  }

  override async runQueryCount<ROW extends ObjectWithId>(
    q: DBQuery<ROW>,
    opt?: AirtableDBOptions,
  ): Promise<number> {
    return (await this.runQuery(q.select([]), opt)).rows.length
  }

  override async deleteByQuery<ROW extends ObjectWithId>(
    q: DBQuery<ROW>,
    opt?: AirtableDBOptions,
  ): Promise<number> {
    const { rows } = await this.runQuery<ROW & AirtableRecord>(q.select([]), opt)

    const tableApi = this.tableApi<ObjectWithId>(q.table)

    await pMap(
      rows.map(r => r.airtableId),
      async airtableId => {
        await tableApi
          .destroy(airtableId)
          .catch(err => this.onErrorOrUndefined(err, q.table, { airtableId }))
      },
      { concurrency: 4 },
    )

    return rows.length
  }

  /**
   * Streaming is emulated by just returning the results of the query as a stream.
   */
  override streamQuery<ROW extends ObjectWithId>(
    q: DBQuery<ROW>,
    opt?: AirtableDBStreamOptions,
  ): ReadableTyped<ROW> {
    const readable = new Readable({
      objectMode: true,
      read() {},
    })

    void this.runQuery(q, opt).then(({ rows }) => {
      rows.forEach(r => readable.push(r))
      readable.push(null) // "complete" the stream
    })

    return readable
  }

  private tableApi<ROW extends ObjectWithId>(table: string): AirtableApiTable<ROW> {
    let { baseId } = this.cfg

    if (!baseId) {
      if (!table.includes('.')) {
        throw new Error(`"table" should include baseId, e.g "BaseId1.TABLE1"`)
      }

      const a = table.split('.', 2)
      baseId = a[0]!
      table = a[1]!
    }

    return this.api.base(baseId)<ROW>(table)
  }

  private async queryAirtableRecords<ROW extends ObjectWithId>(
    table: string,
    selectOpts: AirtableApiSelectOpts<ROW>,
    opt: AirtableDBOptions,
    q?: DBQuery<ROW>,
  ): Promise<ROW[]> {
    const records = await this.tableApi<ROW>(table)
      .select({
        // defaults
        pageSize: 100,
        view: 'PRODUCTION_DO_NOT_TOUCH',
        // ...(sort?.length && { sort }),
        ...selectOpts,
      })
      .all()
      .catch(err => this.onError(err, table))

    // records.forEach(r => {
    //   console.log(r.fields)
    //   console.log((r as any)._rawJson)
    // })
    // console.log({records: records.map(r => [r.fields, (r as any)._rawJson])})

    const { idField = 'id' } = opt

    const rows = records
      // Filter out empty records
      // .filter(r => Object.keys(r.fields).length)
      .map(r => this.mapToAirtableRecord(r))
      // Filter out rows without an id (silently, without throwing an error)
      .filter(r => r[idField as keyof ROW])

    if (q?._selectedFieldNames && !q._selectedFieldNames.includes(idField as keyof ROW)) {
      // Special case
      // It's a projection query without an idField included
      // idField is always queried to be able to "filter empty rows"
      // So, now we have to remove idField from rows
      rows.forEach(r => delete r[idField as keyof ROW])
    }

    return rows
  }

  async createRecord<ROW extends ObjectWithId>(table: string, record: Partial<ROW>): Promise<ROW> {
    // pre-save validation is skipped, cause we'll need to "omit" the `airtableId` from schema
    const raw = await this.tableApi<ROW>(table)
      .create(_omit(record, ['airtableId'] as any))
      .catch(err => this.onError(err, table, { record }))

    return this.mapToAirtableRecord(raw)
  }

  private async updateRecord<ROW extends ObjectWithId>(
    table: string,
    airtableId: string,
    patch: Partial<ROW>,
  ): Promise<ROW> {
    const raw = await this.tableApi<ROW>(table)
      .update(airtableId, _omit(patch, ['airtableId'] as any))
      .catch(err => this.onError(err, table, { airtableId, patch }))

    return this.mapToAirtableRecord(raw)
  }

  // private async deleteRecord(table: string, airtableId: string): Promise<boolean> {
  //   return await this.tableApi(table)
  //     .destroy(airtableId)
  //     .catch(err => this.onErrorOrUndefined(err, table, { airtableId }))
  //     .then(r => !!r)
  // }

  private onError(err: any, table: string, airtableInput?: any): never {
    // Wrap as AppError with code
    // Don't keep stack, cause `err` from Airtable is not instance of Error (hence no native stack)
    // console.error('onError', err)
    const msg = `${table}: ${_inspect(err)}`
    throw new AppError(msg, {
      code: AirtableErrorCode.AIRTABLE_ERROR,
      airtableTableName: table,
      airtableInput,
      // todo: extend the stack of original error
    })
  }

  private onErrorOrUndefined(err: any, table: string, airtableInput?: any): undefined | never {
    // Turn 404 error into `undefined`
    if (err?.statusCode === 404) {
      return
    }

    this.onError(err, table, airtableInput)
  }

  private mapToAirtableRecord<T extends AnyObject>(r: AirtableApiRecord<T>): T {
    const o = {
      airtableId: r.id,
      ...r.fields,
    }

    if (this.cfg.noAttachmentQueryString) {
      _mapValues(o, (_, v) => stripQueryStringFromAttachments(v), true)
    }

    return o
  }

  override async getTables(): Promise<string[]> {
    return []
  }
}
