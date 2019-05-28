import * as fs from 'fs-extra'
import { AirtableConnector, AirtableDaoOptions } from '../airtable.model'

export const AIRTABLE_CONNECTOR_JSON = Symbol('AIRTABLE_CONNECTOR_JSON')

export interface AirtableJsonConnectorCfg {
  baseName: string

  /**
   * Directory where json cache is stored.
   * Will be stored as `${cacheDir}/${baseName}.json`
   */
  cacheDir: string
}

export class AirtableJsonConnector<BASE = any> implements AirtableConnector<BASE> {
  constructor (cfg: AirtableJsonConnectorCfg) {
    this.jsonPath = `${cfg.cacheDir}/${cfg.baseName}.json`
  }

  readonly TYPE = AIRTABLE_CONNECTOR_JSON

  jsonPath!: string

  async fetch (opts: AirtableDaoOptions = {}): Promise<BASE> {
    // require ensures the read operation is cached
    // return require(this.jsonPath)
    // NO: going in favor of async interface for all connectors

    return fs.readJson(this.jsonPath)
  }

  async upload (base: BASE): Promise<void> {
    await fs.ensureFile(this.jsonPath)
    await fs.writeJson(this.jsonPath, base, { spaces: 2 })
  }
}
