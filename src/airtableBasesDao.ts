import { AirtableDaoOptions } from './airtable.model'
import { AirtableBaseDao } from './airtableBaseDao'

/**
 * Allows to perform operations with MANY bases at once, e.g fetch from all bases, upload all bases, etc.
 */
export class AirtableBasesDao<BASE_MAP = any> {
  constructor (private baseDaos: AirtableBaseDao<any>[]) {}

  loadAllFromJson (): void {
    this.baseDaos.forEach(baseDao => baseDao.loadFromJson())
  }

  /**
   * Fetches all remote Airtable Bases.
   */
  async fetchAllFromRemote (opts?: AirtableDaoOptions): Promise<BASE_MAP> {
    const bases = {} as BASE_MAP

    // Concurrency: 1
    for await (const baseDao of this.baseDaos) {
      const { baseName } = baseDao.cfg
      bases[baseName] = await baseDao.fetchFromRemote(opts)
    }

    return bases
  }

  /**
   * Fetches all remote Airtable Bases to json files.
   */
  async fetchAllFromRemoteToJson (opts?: AirtableDaoOptions): Promise<void> {
    // Concurrency: 1
    for await (const baseDao of this.baseDaos) {
      await baseDao.fetchFromRemoteToJson(opts)
    }
  }

  /**
   * Uploads all bases from json files to remote Airtable bases.
   */
  async uploadAllToRemote (opts?: AirtableDaoOptions): Promise<void> {
    // Concurrency: 1
    for await (const baseDao of this.baseDaos) {
      await baseDao.uploadToRemote(opts)
    }
  }
}