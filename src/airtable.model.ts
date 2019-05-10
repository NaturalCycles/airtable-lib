export enum AIRTABLE_ERROR_CODE {
  AIRTABLE_ERROR = 'AIRTABLE_ERROR',
}

export interface AirtableServiceCfg {
  apiKey: string
}

export interface AirtableRecord {
  airtableId: string
}
