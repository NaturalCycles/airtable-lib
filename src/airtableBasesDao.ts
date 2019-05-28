import { logMethod, StringMap } from '@naturalcycles/js-lib'
import { pMap } from '@naturalcycles/promise-lib'
import { AirtableDaoOptions } from './airtable.model'
import { AirtableBaseDao } from './airtableBaseDao'

/**
 * Allows to perform operations with MANY bases at once, e.g fetch from all bases, upload all bases, etc.
 */
export class AirtableBasesDao<BASE_MAP = any> {
  constructor (private baseDaos: AirtableBaseDao<any>[]) {}

  getCacheMap (): BASE_MAP {
    const cacheMap = {} as BASE_MAP

    this.baseDaos.forEach(baseDao => {
      cacheMap[baseDao.cfg.baseName] = baseDao.getCache()
    })

    return cacheMap
  }

  /**
   * @returns map from baseName to unix timestamp of last updated (or undefined)
   */
  getLastUpdatedMap (connectorType: symbol): StringMap<number | undefined> {
    const lastUpdatedMap = {}

    this.baseDaos.forEach(baseDao => {
      lastUpdatedMap[baseDao.cfg.baseName] = baseDao.lastUpdatedMap.get(connectorType)
    })

    return lastUpdatedMap
  }

  @logMethod({ logStart: true })
  async fetchAll (
    connectorType: symbol,
    opts: AirtableDaoOptions = {},
    concurrency = 1,
  ): Promise<BASE_MAP> {
    const bases = {} as BASE_MAP

    await pMap(
      this.baseDaos,
      async baseDao => {
        bases[baseDao.cfg.baseName] = await baseDao.fetch(connectorType, opts)
      },
      { concurrency },
    )

    return bases
  }

  @logMethod({ logStart: true })
  async uploadAll (
    connectorType: symbol,
    opts?: AirtableDaoOptions,
    concurrency = 1,
  ): Promise<void> {
    await pMap(
      this.baseDaos,
      async baseDao => {
        await baseDao.upload(connectorType, opts)
      },
      { concurrency },
    )
  }
}
