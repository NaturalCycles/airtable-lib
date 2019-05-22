import { omit } from '@naturalcycles/js-lib'
import { requireEnvKeys } from '@naturalcycles/nodejs-lib'
import { AirtableLib } from '../../airtableLib'
import { cacheDir, tmpDir } from '../../paths.cnst'
import {
  mockBaseMap,
  mockBaseSchema,
  mockTable1,
  mockTable2,
  Table1,
  Table2,
  TestBase,
} from '../airtable.mock'

jest.setTimeout(60000)

require('dotenv').config()

const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = requireEnvKeys(
  'AIRTABLE_API_KEY',
  'AIRTABLE_BASE_ID',
)

const airtableLib = new AirtableLib({
  apiKey: AIRTABLE_API_KEY,
})

test('delete, create, update, get', async () => {
  const records = mockTable1()
  const [rec1] = records

  const dao = airtableLib.getDao<Table1>(AIRTABLE_BASE_ID, {
    tableName: 'table1',
    sort: [{ field: 'name' }],
  })

  const deleteResult = await dao.deleteRecord('nonExistingId')
  expect(deleteResult).toBe(false)

  await dao.deleteAllRecords()

  const rec1Created = await dao.createRecord(rec1)
  console.log({ rec1Created })
  expect(rec1Created).toHaveProperty('airtableId', expect.any(String))
  expect(rec1Created).toMatchObject(rec1)

  expect(await dao.getRecord(rec1Created.airtableId)).toEqual(rec1Created)

  expect(await dao.deleteRecord(rec1Created.airtableId)).toBe(true)

  expect(await dao.getRecord(rec1Created.airtableId)).toBeUndefined()

  const recordsCreated = await dao.createRecords(records)
  // console.log({recordsCreated})
  recordsCreated.forEach(record => expect(record).toHaveProperty('airtableId', expect.any(String)))
  const recordsWithoutAirtableId = recordsCreated.map(r => omit(r, ['airtableId']))
  expect(recordsWithoutAirtableId).toEqual(records)

  const recordsLoaded = await dao.getRecords()
  // console.log({recordsLoaded})
  expect(recordsLoaded).toEqual(recordsCreated)
})

test('integration: table1, table2', async () => {
  const mocks1 = mockTable1()
  const mocks2 = mockTable2()

  const dao1 = airtableLib.getDao<Table1>(AIRTABLE_BASE_ID, { tableName: 'table1' })
  const dao2 = airtableLib.getDao<Table2>(AIRTABLE_BASE_ID, { tableName: 'table2' })

  await dao1.deleteAllRecords()
  await dao2.deleteAllRecords()

  const _records1 = await dao1.createRecords(mocks1)
  const _records2 = await dao2.createRecords(mocks2)
})

test('fetchRemoteBase', async () => {
  const base = await airtableLib.fetchRemoteBase(mockBaseSchema(AIRTABLE_BASE_ID))
  console.log(JSON.stringify(base, null, 2))
})

test('fetchRemoteBasesToJson', async () => {
  await airtableLib.fetchRemoteBasesToJson(mockBaseMap(AIRTABLE_BASE_ID), cacheDir)
})

test('uploadJsonToRemoteBases', async () => {
  await airtableLib.uploadJsonToRemoteBases(mockBaseMap(AIRTABLE_BASE_ID), cacheDir)
}, 120000)

test('getAirtableCacheFromJson', async () => {
  const jsonPath = `${tmpDir}/${AIRTABLE_BASE_ID}.json`
  const cache = airtableLib.getAirtableCacheFromJson<TestBase>(
    mockBaseSchema(AIRTABLE_BASE_ID),
    jsonPath,
  )
  // console.log(cache.getBase())
  console.log(cache.getTable('categories'))
  console.log(cache.get('rec4rmK2WLHa23ead'))
})
