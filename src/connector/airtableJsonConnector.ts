import * as fs from 'fs-extra'
import { AirtableBaseDaoCfg, AirtableConnector, AirtableDaoOptions } from '../airtable.model'

export const AIRTABLE_CONNECTOR_JSON = Symbol('AIRTABLE_CONNECTOR_JSON')

export interface AirtableJsonConnectorCfg {
  /**
   * Directory where json cache is stored.
   * Will be stored as `${cacheDir}/${baseName}.json`
   */
  cacheDir: string
}

export class AirtableJsonConnector<BASE = any> implements AirtableConnector<BASE> {
  constructor (private cfg: AirtableJsonConnectorCfg) {}

  readonly TYPE = AIRTABLE_CONNECTOR_JSON

  async fetch (baseDaoCfg: AirtableBaseDaoCfg<BASE>, opts: AirtableDaoOptions = {}): Promise<BASE> {
    // require ensures the read operation is cached
    // return require(this.jsonPath)
    // NO: going in favor of async interface for all connectors

    const jsonPath = `${this.cfg.cacheDir}/${baseDaoCfg.baseName}.json`
    return fs.readJson(jsonPath)
  }

  fetchSync (baseDaoCfg: AirtableBaseDaoCfg<BASE>, opts: AirtableDaoOptions = {}): BASE {
    const jsonPath = `${this.cfg.cacheDir}/${baseDaoCfg.baseName}.json`
    return require(jsonPath)
  }

  async upload (base: BASE, baseDaoCfg: AirtableBaseDaoCfg<BASE>): Promise<void> {
    const jsonPath = `${this.cfg.cacheDir}/${baseDaoCfg.baseName}.json`
    await fs.ensureFile(jsonPath)
    await fs.writeJson(jsonPath, base, { spaces: 2 })
  }
}
