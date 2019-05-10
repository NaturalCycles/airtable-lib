import { anyToErrorMessage, AppError, logMillis } from '@naturalcycles/js-lib'
import { pMap } from '@naturalcycles/promise-lib'
import { AirtableLibRecord, AirtableLibTable, AirtableSelectOpts } from 'airtable'
import * as AirtableLib from 'airtable'
import { AIRTABLE_ERROR_CODE, AirtableRecord } from './airtable.model'

export class AirtableDao<T extends object> {
  constructor (airtableLib: typeof AirtableLib, public baseId: string, public tableName: string) {
    this.table = airtableLib.base(baseId)<T>(tableName)
  }

  private table!: AirtableLibTable<T>

  /**
   * Empty records are filtered out.
   */
  @logMillis()
  async getRecords (selectOpts: AirtableSelectOpts<T> = {}): Promise<(T & AirtableRecord)[]> {
    const records = await this.table
      .select({
        // defaults
        pageSize: 100,
        ...selectOpts,
      })
      .all()
      .catch(onError)

    return (
      records
        // Filter out empty records
        .filter(r => Object.keys(r.fields).length)
        .map(r => this.mapToAirtableRecord(r))
    )
  }

  @logMillis()
  async getRecord (airtableId: string): Promise<T & AirtableRecord | undefined> {
    const record = await this.table.find(airtableId).catch(onErrorOrUndefined)

    return record && this.mapToAirtableRecord(record)
  }

  /**
   * @returns created record (with generated `airtableId`)
   */
  @logMillis()
  async createRecord (record: T): Promise<T & AirtableRecord> {
    const raw = await this.table.create(record).catch(onError)

    return this.mapToAirtableRecord(raw)
  }

  /**
   * Warning:
   * Order of records is not preserved if `concurrency` is set to higher than 1!
   */
  @logMillis()
  async createRecords (records: T[], concurrency = 1): Promise<(T & AirtableRecord)[]> {
    return pMap(records, async record => this.createRecord(record), { concurrency })
  }

  /**
   * Partial update (patch) the record.
   */
  @logMillis()
  async updateRecord (airtableId: string, patch: Partial<T>): Promise<T & AirtableRecord> {
    const raw = await this.table.update(airtableId, patch).catch(onError)

    return this.mapToAirtableRecord(raw)
  }

  /**
   * Replace the record.
   * > Any fields that are not included will be cleared.
   */
  @logMillis()
  async replaceRecord (airtableId: string, record: Partial<T>): Promise<T & AirtableRecord> {
    const raw = await this.table.replace(airtableId, record).catch(onError)

    return this.mapToAirtableRecord(raw)
  }

  /**
   * @returns true if record existed.
   */
  @logMillis()
  async deleteRecord (airtableId: string): Promise<boolean> {
    return this.table
      .destroy(airtableId)
      .catch(onErrorOrUndefined)
      .then(r => !!r)
  }

  /**
   * Will first fetch all records to get their airtableIds.
   * Then will call `deleteRecord` on each of them.
   * @returns array of airtableIds of deleted records
   */
  @logMillis()
  async deleteAllRecords (concurrency = 4): Promise<string[]> {
    // Using low level commands to include empty records too
    const airtableIds = (await this.table
      .select({
        pageSize: 100,
      })
      .all()
      .catch(onError)).map(r => r.id)

    await pMap(airtableIds, airtableId => this.deleteRecord(airtableId), { concurrency })

    return airtableIds
  }

  private mapToAirtableRecord<FIELDS> (r: AirtableLibRecord<FIELDS>): FIELDS & AirtableRecord {
    return {
      airtableId: r.id,
      ...r.fields,
    }
  }
}

function onErrorOrUndefined (err: any): undefined | never {
  // Turn 404 error into `undefined`
  if (err && err.statusCode === 404) {
    return
  }

  onError(err)
}

function onError (err: any): never {
  // Wrap as AppError with code
  // Don't keep stack, cause `err` from Airtable is not instance of Error (hence no native stack)
  const msg = anyToErrorMessage(err)
  throw new AppError(msg, {
    code: AIRTABLE_ERROR_CODE.AIRTABLE_ERROR,
  })
}
