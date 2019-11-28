import { anyToErrorMessage, AppError, InstanceId, logMethod, pMap } from '@naturalcycles/js-lib'
import { getValidationResult } from '@naturalcycles/nodejs-lib'
import {
  AirtableApi,
  AirtableApiRecord,
  AirtableApiSelectOpts,
  AirtableApiTable,
} from './airtable.api'
import {
  AIRTABLE_ERROR_CODE,
  AirtableDaoOptions,
  AirtableRecord,
  AirtableTableCfg,
} from './airtable.model'

export class AirtableTableDao<T extends AirtableRecord = any> implements InstanceId {
  constructor(
    airtableApi: AirtableApi,
    baseId: string,
    private tableName: string,
    private cfg: AirtableTableCfg<T>,
  ) {
    this.table = airtableApi.base(baseId)<T>(tableName)
    this.instanceId = [baseId, tableName].join('_')
  }

  instanceId!: string

  private table!: AirtableApiTable<T>

  /**
   * Empty records are filtered out.
   */
  @logMethod()
  async getRecords(
    opts: AirtableDaoOptions = {},
    selectOpts: AirtableApiSelectOpts<T> = {},
  ): Promise<T[]> {
    const { sort } = this.cfg

    const records = await this.table
      .select({
        // defaults
        pageSize: 100,
        view: this.cfg.view || 'Grid view',
        ...(sort && sort.length && { sort }),
        ...selectOpts,
      })
      .all()
      .catch(err => this.onError(err))

    return (
      records
        // Filter out empty records
        .filter(r => Object.keys(r.fields).length)
        .map(r => this.mapToAirtableRecord(r, opts))
    )
  }

  @logMethod()
  async getRecord(airtableId: string, opts: AirtableDaoOptions = {}): Promise<T | undefined> {
    const record = await this.table
      .find(airtableId)
      .catch(err => this.onErrorOrUndefined(err, { airtableId }))

    return record && this.mapToAirtableRecord(record, opts)
  }

  /**
   * @returns created record (with generated `airtableId`)
   */
  @logMethod()
  async createRecord(record: Exclude<T, 'airtableId'>, opts: AirtableDaoOptions = {}): Promise<T> {
    // pre-save validation is skipped, cause we'll need to "omit" the `airtableId` from schema
    const raw = await this.table
      .create(record as Partial<T>)
      .catch(err => this.onError(err, { record }))

    return this.mapToAirtableRecord(raw, opts)
  }

  /**
   * Warning:
   * Order of records is not preserved if `concurrency` is set to higher than 1!
   * Or if opts.skipPreservingOrder=true
   */
  @logMethod()
  async createRecords(
    records: Exclude<T, 'airtableId'>[],
    opts: AirtableDaoOptions = {},
  ): Promise<T[]> {
    const concurrency = opts.concurrency || (opts.skipPreservingOrder ? 4 : 1)

    return pMap(
      records,
      async record => {
        // pre-save validation is skipped
        const raw = await this.table
          .create(record as Partial<T>)
          .catch(err => this.onError(err, { record }))
        return this.mapToAirtableRecord(raw, opts)
      },
      { concurrency },
    )
  }

  /**
   * Partial update (patch) the record.
   */
  @logMethod()
  async updateRecord(
    airtableId: string,
    patch: Partial<T>,
    opts: AirtableDaoOptions = {},
  ): Promise<T> {
    // console.log('updateRecord', {airtableId, patch})
    const raw = await this.table
      .update(airtableId, patch)
      .catch(err => this.onError(err, { airtableId, patch }))

    return this.mapToAirtableRecord(raw, opts)
  }

  /**
   * Replace the record.
   * > Any fields that are not included will be cleared.
   */
  @logMethod()
  async replaceRecord(
    airtableId: string,
    record: Exclude<T, 'airtableId'>,
    opts: AirtableDaoOptions = {},
  ): Promise<T> {
    const raw = await this.table
      .replace(airtableId, record as Partial<T>)
      .catch(err => this.onError(err, { record }))

    return this.mapToAirtableRecord(raw, opts)
  }

  @logMethod()
  async replaceRecords(records: T[], opts: AirtableDaoOptions = {}): Promise<T[]> {
    const concurrency = opts.concurrency || 4
    return pMap(
      records,
      async r => {
        const { airtableId, ...record } = r
        const raw = await this.table
          .replace(airtableId, record as T)
          .catch(err => this.onError(err, { record: r }))
        return this.mapToAirtableRecord(raw, opts)
      },
      { concurrency },
    )
  }

  /**
   * @returns true if record existed.
   */
  @logMethod()
  async deleteRecord(airtableId: string): Promise<boolean> {
    return this.table
      .destroy(airtableId)
      .catch(err => this.onErrorOrUndefined(err, { airtableId }))
      .then(r => !!r)
  }

  /**
   * Will first fetch all records to get their airtableIds.
   * Then will call `deleteRecord` on each of them.
   * @returns array of airtableIds of deleted records
   */
  @logMethod()
  async deleteAllRecords(concurrency = 4): Promise<string[]> {
    // Using low level commands to include empty records too
    const airtableIds = (
      await this.table
        .select({
          pageSize: 100,
        })
        .all()
        .catch(err => this.onError(err))
    ).map(r => r.id)

    await pMap(
      airtableIds,
      airtableId => {
        return this.table
          .destroy(airtableId)
          .catch(err => this.onErrorOrUndefined(err, { airtableId }))
      },
      { concurrency },
    )

    return airtableIds
  }

  private validate<R>(record: R, opts: AirtableDaoOptions = {}): R {
    const { validationSchema } = this.cfg
    const { skipValidation, onValidationError, throwOnValidationError } = opts

    const { value, error } = getValidationResult<R>(record, validationSchema, this.tableName)

    if (error && !skipValidation) {
      if (onValidationError) onValidationError(error)

      if (throwOnValidationError) {
        throw error
      } else {
        console.log(error.message)
      }
    }

    return value
  }

  private mapToAirtableRecord(r: AirtableApiRecord<T>, opts: AirtableDaoOptions = {}): T {
    return this.validate(
      {
        airtableId: r.id,
        ...r.fields,
      },
      opts,
    )
  }

  onErrorOrUndefined(err: any, airtableInput?: any): undefined | never {
    // Turn 404 error into `undefined`
    if (err && err.statusCode === 404) {
      return
    }

    this.onError(err, airtableInput)
  }

  private onError(err: any, airtableInput?: any): never {
    // Wrap as AppError with code
    // Don't keep stack, cause `err` from Airtable is not instance of Error (hence no native stack)
    // console.error('onError', err)
    const { tableName } = this
    const msg = `${tableName}: ${anyToErrorMessage(err)}`
    throw new AppError(msg, {
      code: AIRTABLE_ERROR_CODE.AIRTABLE_ERROR,
      airtableTableName: tableName,
      airtableInput,
    })
  }
}
