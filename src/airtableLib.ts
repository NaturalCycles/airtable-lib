import { memo } from '@naturalcycles/js-lib'
import { AirtableApi } from './airtable.api'
import { AirtableLibCfg } from './airtable.model'

export class AirtableLib {
  constructor (public airtableServiceCfg: AirtableLibCfg) {}

  @memo()
  api (): AirtableApi {
    // lazy-loading the library
    const airtableApi = require('airtable') as AirtableApi

    const { apiKey } = this.airtableServiceCfg

    airtableApi.configure({
      endpointURL: 'https://api.airtable.com',
      apiKey,
      // requestTimeout: 300000,
    })
    return airtableApi
  }
}
