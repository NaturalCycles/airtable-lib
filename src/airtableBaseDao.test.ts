import { MOCK_TS_2018_06_21, mockTime } from '@naturalcycles/test-lib'
import { AirtableLib } from './airtableLib'
import { AIRTABLE_CONNECTOR_JSON } from './connector/airtableJsonConnector'
import { mockBaseDao } from './test/airtable.mock'

beforeEach(() => {
  mockTime()
})

const airtableLib = new AirtableLib({
  apiKey: 'fakekey',
})

test('getCache', async () => {
  const baseDao = mockBaseDao(airtableLib.api(), 'baseId')

  expect(baseDao.lastChanged).toBeUndefined()
  expect(baseDao.lastFetchedMap.get(AIRTABLE_CONNECTOR_JSON)).toBeUndefined()

  const cache = baseDao.getCache()
  // console.log(cache)

  expect(cache).toMatchSnapshot()

  expect(baseDao.lastChanged).toBe(MOCK_TS_2018_06_21)
})

test('cacheUpdated$', async () => {
  const baseDao = mockBaseDao(airtableLib.api(), 'baseId')

  let updatedTimes = 0
  baseDao.cacheUpdated$.subscribe(() => updatedTimes++)

  expect(updatedTimes).toBe(0)

  baseDao.getCache() // should trigger cacheUpdated$
  expect(updatedTimes).toBe(1)

  baseDao.getCache() // should NOT trigger cacheUpdated$
  expect(updatedTimes).toBe(1)

  const fakeCache: any = { table1: [{ airtableId: 'asd' }] }
  baseDao.setCache(fakeCache) // trigger
  expect(updatedTimes).toBe(2)

  baseDao.setCache(fakeCache) // NOT trigger (data is the same)
  expect(updatedTimes).toBe(2)

  baseDao.setCache(undefined) // trigger
  expect(updatedTimes).toBe(3)
})

// todo: getById should lazyLoad
// todo: getTableRecords should lazyLoad
