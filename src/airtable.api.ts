export interface AirtableApi {
  base (baseId: string): AirtableApiBase

  configure (param: { endpointURL: string; apiKey: string; requestTimeout?: number }): void
}

export type AirtableApiBase = <T extends object>(tableName: string) => AirtableApiTable<T>

export interface AirtableApiTable<T> {
  select (selectOpts?: AirtableApiSelectOpts<T>): AirtableApiQuery<T>

  find (airtableId: string): Promise<AirtableApiRecord<T> | undefined>

  create (record: Partial<T>): Promise<AirtableApiRecord<T>>

  update (airtableId: string, patch: Partial<T>): Promise<AirtableApiRecord<T>>

  replace (airtableId: string, patch: Partial<T>): Promise<AirtableApiRecord<T>>

  /**
   * Returns deleted record
   */
  destroy (airtableId: string): Promise<T>
}

export interface AirtableApiSelectOpts<T> {
  pageSize?: number
  fields?: (keyof T)[]
  maxRecords?: number
  view?: string
  sort?: AirtableApiSort<T>[]

  /**
   * https://support.airtable.com/hc/en-us/articles/203255215-Formula-Field-Reference
   */
  filterByFormula?: string
}

export interface AirtableApiSort<T = any> {
  field: keyof T

  /**
   * @default 'asc'
   */
  direction?: 'asc' | 'desc'
}

export interface AirtableApiQuery<T> {
  all (): Promise<AirtableApiRecord<T>[]>
}

export interface AirtableApiRecord<T> {
  id: string
  fields: T
  save (): any
  patchUpdate (): any
  putUpdate (): any
  destroy (): any
  fetch (): any
  updateT (): any
  replaceT (): any
}
