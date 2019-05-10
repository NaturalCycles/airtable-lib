declare module 'airtable' {
  export function base (baseId: string): AirtableLibBase

  export type AirtableLibBase = <T extends object>(tableName: string) => AirtableLibTable<T>

  export interface AirtableLibTable<T> {
    select (selectOpts?: AirtableSelectOpts<T>): AirtableQuery<T>

    find (airtableId: string): Promise<AirtableLibRecord<T> | undefined>

    create (record: T): Promise<AirtableLibRecord<T>>

    update (airtableId: string, patch: Partial<T>): Promise<AirtableLibRecord<T>>

    replace (airtableId: string, patch: Partial<T>): Promise<AirtableLibRecord<T>>

    /**
     * Returns deleted record
     */
    destroy (airtableId: string): Promise<T>
  }

  export interface AirtableSelectOpts<T> {
    pageSize?: number
    fields?: (keyof T)[]
    maxRecords?: number
    view?: string
    sort?: AirtableSort<T>[]

    /**
     * https://support.airtable.com/hc/en-us/articles/203255215-Formula-Field-Reference
     */
    filterByFormula?: string
  }

  export interface AirtableSort<T> {
    field: keyof T

    /**
     * @default 'asc'
     */
    direction?: 'asc' | 'desc'
  }

  export interface AirtableQuery<T> {
    all (): Promise<AirtableLibRecord<T>[]>
  }

  export interface AirtableLibRecord<T> {
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

  export function configure (param: {
    endpointURL: string
    apiKey: string
    requestTimeout?: number
  }): void
}
