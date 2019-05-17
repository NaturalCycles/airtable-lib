import { AppError } from '@naturalcycles/js-lib'
import { AIRTABLE_ERROR_CODE } from './airtable.model'
import { AirtableLib } from './airtableLib'

test('wrong apiKey should throw', async () => {
  const airtableService = new AirtableLib({
    apiKey: 'apiKey123',
  })
  const dao = airtableService.getDao('someBaseId', { tableName: 'someTable' })

  // await expect(airtableService.getRecords('someBaseId.someTable')).rejects.toThrow(AppError)
  const err = await dao.getRecords().catch(e => e)
  expect(err).toBeInstanceOf(AppError)
  expect(err).toMatchObject({
    message: expect.any(String),
    stack: expect.any(String),
    data: {
      code: AIRTABLE_ERROR_CODE.AIRTABLE_ERROR,
    },
  })
})

test('test1', async () => {
  const airtableService = new AirtableLib({
    apiKey: 'apiKey123',
  })

  airtableService.init() // for coverage
  const airtableLib = airtableService.api()

  console.log(airtableLib)
  expect(airtableLib).not.toBeUndefined()
})
