import {
  CommonDB,
  CommonDBCreateOptions,
  CommonDBOptions,
  CommonDBSaveOptions,
  CommonDBStreamOptions,
  CommonSchema,
  DBQuery,
  RunQueryResult,
  SavedDBEntity,
} from '@naturalcycles/db-lib'
import { anyToErrorMessage, AppError, by, pMap, _omit } from '@naturalcycles/js-lib'
import { ReadableTyped } from '@naturalcycles/nodejs-lib'
import { Readable } from 'stream'
import {
  AirtableApi,
  AirtableApiRecord,
  AirtableApiSelectOpts,
  AirtableApiTable,
} from './airtable.api'
import { AirtableRecord, AIRTABLE_ERROR_CODE } from './airtable.model'
import { dbQueryToAirtableSelectOptions } from './query.util'

export interface AirtableDBCfg<BASE = any> {
  /**
   * Airtable apiKey
   */
  apiKey: string

  /**
   * If defined - it will be used for all tables.
   *
   * If not defined - you'll need to pass `baseId` as part of the `table`, e.g `${baseId}.${table}`
   */
  baseId?: string
}

export interface AirtableDBOptions extends CommonDBOptions {
  /**
   * @default `id`
   */
  idField?: string
}
export interface AirtableDBStreamOptions extends CommonDBStreamOptions {}
export interface AirtableDBSaveOptions extends CommonDBSaveOptions {}

/**
 * CommonDB implementation based on Airtable sheets.
 *
 *
 */
export class AirtableDB implements CommonDB {
  constructor(public cfg: AirtableDBCfg) {
    // lazy-loading the library
    const airtableApi = require('airtable') as AirtableApi

    airtableApi.configure({
      endpointURL: 'https://api.airtable.com',
      apiKey: cfg.apiKey,
      // requestTimeout: 300000,
    })

    this.api = airtableApi
  }

  api: AirtableApi

  async getByIds<DBM extends SavedDBEntity>(
    table: string,
    ids: string[],
    opt: AirtableDBOptions = {},
  ): Promise<DBM[]> {
    if (!ids.length) return []

    const { idField = 'id' } = opt
    const pairs = ids.map(id => `{${idField}}="${id}"`)
    const filterByFormula = `OR(${pairs.join(',')})`

    return await this.queryAirtableRecords<DBM>(table, {
      filterByFormula,
    })
  }

  async deleteByIds(table: string, ids: string[], opt: AirtableDBOptions = {}): Promise<number> {
    if (!ids.length) return 0

    // step 1: get airtableIds of the records
    const { idField = 'id' } = opt
    const pairs = ids.map(id => `{${idField}}="${id}"`)
    const filterByFormula = `OR(${pairs.join(',')})`
    const airtableIds = (
      await this.queryAirtableRecords<AirtableRecord & SavedDBEntity>(table, {
        fields: [], // no fields, just airtableIds
        filterByFormula,
      })
    ).map(r => r.airtableId)

    // step 2: delete by airtableIds
    const tableApi = this.tableApi<SavedDBEntity>(table)

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
  async saveBatch<DBM extends SavedDBEntity>(
    table: string,
    dbms: DBM[],
    opt?: AirtableDBSaveOptions,
  ): Promise<void> {
    const existingRecords = await this.getByIds<DBM & AirtableRecord>(
      table,
      dbms.map(r => r.id),
      opt,
    )
    const existingRecordById = by(existingRecords, r => r.id)

    await pMap(
      dbms,
      async dbm => {
        if (existingRecordById[dbm.id]) {
          await this.updateRecord(
            table,
            existingRecordById[dbm.id].airtableId,
            _omit(existingRecordById[dbm.id], ['airtableId']),
          )
        } else {
          await this.createRecord(table, _omit(dbm, ['airtableId' as keyof DBM]))
        }
      },
      { concurrency: 4 },
    )
  }

  async runQuery<DBM extends SavedDBEntity, OUT = DBM>(
    q: DBQuery<any, DBM>,
    opt?: AirtableDBOptions,
  ): Promise<RunQueryResult<OUT>> {
    const selectOpts = dbQueryToAirtableSelectOptions<DBM>(q)
    // console.log({selectOpts})

    return {
      records: await this.queryAirtableRecords<any>(q.table, selectOpts),
    }
  }

  async runQueryCount(q: DBQuery, opt?: AirtableDBOptions): Promise<number> {
    return (await this.runQuery(q.select([]), opt)).records.length
  }

  async deleteByQuery(q: DBQuery, opt?: AirtableDBOptions): Promise<number> {
    const { records } = await this.runQuery<AirtableRecord & SavedDBEntity>(q.select([]), opt)

    const tableApi = this.tableApi<SavedDBEntity>(q.table)

    await pMap(
      records.map(r => r.airtableId),
      async airtableId => {
        await tableApi
          .destroy(airtableId)
          .catch(err => this.onErrorOrUndefined(err, q.table, { airtableId }))
      },
      { concurrency: 4 },
    )

    return records.length
  }

  /**
   * Streaming is emulated by just returning the results of the query as a stream.
   */
  streamQuery<DBM extends SavedDBEntity, OUT = DBM>(
    q: DBQuery<any, DBM>,
    opt?: AirtableDBStreamOptions,
  ): ReadableTyped<OUT> {
    const readable = new Readable({
      objectMode: true,
      read() {},
    })

    void this.runQuery<DBM, OUT>(q, opt).then(({ records }) => {
      records.forEach(r => readable.push(r))
      readable.push(null) // "complete" the stream
    })

    return readable
  }

  async resetCache(table?: string): Promise<void> {
    // no-op
  }

  async getTableSchema<DBM extends SavedDBEntity>(table: string): Promise<CommonSchema<DBM>> {
    // throw new Error('not implemented')
    return {
      table,
      fields: [],
    }
  }

  async getTables(): Promise<string[]> {
    // throw new Error('not implemented')
    return []
  }

  async createTable(schema: CommonSchema, opt?: CommonDBCreateOptions): Promise<void> {
    // throw new Error('not implemented')
  }

  private tableApi<DBM extends SavedDBEntity>(table: string): AirtableApiTable<DBM> {
    let { baseId } = this.cfg

    if (!baseId) {
      if (!table.includes('.')) {
        throw new Error(`"table" should include baseId, e.g "BaseId1.TABLE1"`)
      }

      ;[baseId, table] = table.split('.', 2)
    }

    return this.api.base(baseId)<DBM>(table)
  }

  private async queryAirtableRecords<DBM extends SavedDBEntity>(
    table: string,
    selectOpts: AirtableApiSelectOpts<DBM> = {},
  ): Promise<DBM[]> {
    const records = await this.tableApi<DBM>(table)
      .select({
        // defaults
        pageSize: 100,
        view: 'Grid view',
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

    return (
      records
        // Filter out empty records
        .filter(r => Object.keys(r.fields).length)
        .map(r => this.mapToAirtableRecord(r))
    )
  }

  async createRecord<DBM extends SavedDBEntity>(table: string, record: Partial<DBM>): Promise<DBM> {
    // pre-save validation is skipped, cause we'll need to "omit" the `airtableId` from schema
    const raw = await this.tableApi<DBM>(table)
      .create(record)
      .catch(err => this.onError(err, table, { record }))

    return this.mapToAirtableRecord(raw)
  }

  private async updateRecord<DBM extends SavedDBEntity>(
    table: string,
    airtableId: string,
    patch: Partial<DBM>,
  ): Promise<DBM> {
    const raw = await this.tableApi<DBM>(table)
      .update(airtableId, patch)
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
    const msg = `${table}: ${anyToErrorMessage(err)}`
    throw new AppError(msg, {
      code: AIRTABLE_ERROR_CODE.AIRTABLE_ERROR,
      airtableTableName: table,
      airtableInput,
    })
  }

  private onErrorOrUndefined(err: any, table: string, airtableInput?: any): undefined | never {
    // Turn 404 error into `undefined`
    if (err?.statusCode === 404) {
      return
    }

    this.onError(err, table, airtableInput)
  }

  private mapToAirtableRecord<T>(r: AirtableApiRecord<T>): T {
    return {
      airtableId: r.id,
      ...r.fields,
    }
  }
}
