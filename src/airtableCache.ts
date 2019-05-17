import { omit, StringMap } from '@naturalcycles/js-lib'
import { AirtableBaseSchema, AirtableRecord } from './airtable.model'

/**
 * Holds cache of Airtable Base (all tables, all records, indexed by `airtableId` for quick access).
 * Provides API to access records.
 */
export class AirtableCache<BASE = any> {
  constructor (private base: BASE, private _baseSchema: AirtableBaseSchema) {
    this.indexBase()
  }

  /**
   * Map from airtableId to Record
   */
  private airtableIdIndex!: StringMap<AirtableRecord>

  /**
   * Indexes `this.base` by `airtableId`
   */
  private indexBase (): void {
    const airtableIndex: StringMap<AirtableRecord> = {}

    Object.values(this.base).forEach((records: AirtableRecord[]) => {
      records.forEach(r => (airtableIndex[r.airtableId] = r))
    })

    this.airtableIdIndex = airtableIndex
  }

  getBase (): BASE {
    return this.base
  }

  setBase (base: BASE): void {
    this.base = base
  }

  getTable<T extends AirtableRecord> (tableName: keyof BASE, noAirtableIds = false): T[] {
    if (noAirtableIds) {
      return ((this.base[tableName] as any) as AirtableRecord[]).map(r =>
        omit(r, ['airtableId']),
      ) as T[]
    } else {
      return (this.base[tableName] as any) as T[]
    }
  }

  get<T extends AirtableRecord> (airtableId: string): T {
    return this.airtableIdIndex[airtableId] as T
  }
}
