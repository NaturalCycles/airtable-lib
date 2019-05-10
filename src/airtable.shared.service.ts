import { memoInstance } from '@naturalcycles/js-lib'
import * as AirtableLib from 'airtable'
import { AirtableDao } from './airtable.dao'
import { AirtableServiceCfg } from './airtable.model'

export class AirtableSharedService {
  constructor (public airtableServiceCfg: AirtableServiceCfg) {}

  init (): void {
    this.airtableLib()
  }

  @memoInstance()
  airtableLib (): typeof AirtableLib {
    // lazy-loading the library
    const airtableLib = require('airtable') as typeof AirtableLib

    const { apiKey } = this.airtableServiceCfg

    airtableLib.configure({
      endpointURL: 'https://api.airtable.com',
      apiKey,
      // requestTimeout: 300000,
    })
    return airtableLib
  }

  getDao<T extends object> (baseId: string, tableName: string): AirtableDao<T> {
    return new AirtableDao<T>(this.airtableLib(), baseId, tableName)
  }
}
