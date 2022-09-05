import { pMap, StringMap, _LogMethod, AnyObject } from '@naturalcycles/js-lib'
import { AirtableDaoOptions, AirtableDaoSaveOptions } from './airtable.model'
import { AirtableBaseDao } from './airtableBaseDao'

/**
 * Allows to perform operations with MANY bases at once, e.g fetch from all bases, upload all bases, etc.
 */
export class AirtableBasesDao<BASE_MAP extends AnyObject = any> {
  constructor(public baseDaos: AirtableBaseDao<any>[]) {}

  getDao<BASE extends AnyObject = any>(baseName: string): AirtableBaseDao<BASE> {
    const dao = this.baseDaos.find(dao => dao.cfg.baseName === baseName)
    if (!dao) throw new Error(`AirtableBaseDao not found for base: ${baseName}`)
    return dao
  }

  getCacheMap(): BASE_MAP {
    const cacheMap = {} as BASE_MAP

    this.baseDaos.forEach(baseDao => {
      cacheMap[baseDao.cfg.baseName as keyof BASE_MAP] = baseDao.getCache()
    })

    return cacheMap
  }

  /**
   * @returns map from baseName to unix timestamp of last fetched (or undefined)
   */
  getLastFetchedMap(connectorType: symbol): StringMap<number | undefined> {
    const map: StringMap<number | undefined> = {}

    this.baseDaos.forEach(baseDao => {
      map[baseDao.cfg.baseName] = baseDao.lastFetchedMap.get(connectorType)
    })

    return map
  }

  /**
   * @returns map from baseName to unix timestamp of when it's cache was last changed
   */
  getLastChangedMap(): StringMap<number | undefined> {
    const map: StringMap<number | undefined> = {}

    this.baseDaos.forEach(baseDao => {
      map[baseDao.cfg.baseName] = baseDao.lastChanged
    })

    return map
  }

  @_LogMethod({ logStart: true })
  async fetchAll(
    connectorType: symbol,
    opt: AirtableDaoOptions = {},
    concurrency = 1,
  ): Promise<BASE_MAP> {
    const bases = {} as BASE_MAP

    await pMap(
      this.baseDaos,
      async baseDao => {
        bases[baseDao.cfg.baseName as keyof BASE_MAP] = await baseDao.fetch(connectorType, opt)
      },
      { concurrency },
    )

    return bases
  }

  @_LogMethod({ logStart: true })
  async uploadAll(
    connectorType: symbol,
    opt?: AirtableDaoSaveOptions,
    concurrency = 1,
  ): Promise<void> {
    await pMap(
      this.baseDaos,
      async baseDao => {
        await baseDao.upload(connectorType, opt)
      },
      { concurrency },
    )
  }
}
