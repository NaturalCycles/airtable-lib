import { omit, StringMap } from '@naturalcycles/js-lib'
import { AirtableBaseSchemaType, AirtableBaseType, AirtableRecord } from './airtable.model'
import { sortAirtableBase } from './airtableLib'

/**
 * Holds cache of Airtable Base (all tables, all records, indexed by `airtableId` for quick access).
 * Base is sorted (deterministic order of tables and record keys).
 * Order of rows is preserved as is.
 * Provides API to access records.
 */
export class AirtableCache<BASE extends AirtableBaseType<BASE>> {
  constructor (base: BASE, private _baseSchema: AirtableBaseSchemaType<BASE>) {
    this.setBase(base)
  }

  private base!: BASE

  /**
   * Map from airtableId to Record
   */
  private airtableIdIndex!: StringMap<AirtableRecord>

  /**
   * Indexes `this.base` by `airtableId`
   */
  private indexBase (): void {
    const airtableIndex: StringMap<AirtableRecord> = {}

    Object.values(this.base).forEach(records => {
      ;(records as AirtableRecord[]).forEach(r => (airtableIndex[r.airtableId] = r))
    })

    this.airtableIdIndex = airtableIndex
  }

  getBase (): BASE {
    return this.base
  }

  setBase (base: BASE): void {
    this.base = sortAirtableBase(base)
    this.indexBase()
  }

  getTable<TABLE_NAME extends keyof BASE> (
    tableName: TABLE_NAME,
    noAirtableIds = false,
  ): BASE[TABLE_NAME] {
    if (noAirtableIds) {
      return this.base[tableName].map(r => omit(r, ['airtableId'])) as BASE[TABLE_NAME]
    } else {
      return this.base[tableName]
    }
  }

  get<T extends AirtableRecord> (airtableId: string): T {
    return this.airtableIdIndex[airtableId] as T
  }

  getByIds<T extends AirtableRecord> (airtableIds: string[]): T[] {
    return airtableIds.map(id => this.airtableIdIndex[id]) as T[]
  }
}
