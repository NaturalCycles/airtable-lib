import { _Memo } from '@naturalcycles/js-lib'
import { AirtableApi } from './airtable.api'
import { AirtableLibCfg } from './airtable.model'

export class AirtableLib {
  constructor(public airtableServiceCfg: AirtableLibCfg) {}

  @_Memo()
  api(): AirtableApi {
    // lazy-loading the library
    const airtableApi = require('airtable') as AirtableApi

    const { apiKey } = this.airtableServiceCfg

    airtableApi.configure({
      // endpointURL: 'https://api.airtable.com',
      apiKey,
      // Default is 5 minutes, we override the default to 40 seconds
      requestTimeout: 40_000,
    })
    return airtableApi
  }
}
