import { CommonDBTestOptions, runCommonDaoTest, runCommonDBTest } from '@naturalcycles/db-lib'
import { requireEnvKeys } from '@naturalcycles/nodejs-lib'
import { AirtableDB } from '../../airtableDB'
import { AirtableLib } from '../../airtableLib'

jest.setTimeout(60000)

require('dotenv').config()

const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = requireEnvKeys(
  'AIRTABLE_API_KEY',
  'AIRTABLE_BASE_ID',
)

const airtableLib = new AirtableLib({
  apiKey: AIRTABLE_API_KEY,
})

const db = new AirtableDB({
  airtableApi: airtableLib.api(),
  baseId: AIRTABLE_BASE_ID,
})

const opt: CommonDBTestOptions = {
  allowGetByIdsUnsorted: true,
  allowQueryUnsorted: true,
  allowStreamQueryToBeUnsorted: true,
  allowExtraPropertiesInResponse: true,
  allowBooleansAsUndefined: true,
}

describe('runCommonDBTest', () => runCommonDBTest(db, opt))

describe('runCommonDaoTest', () => runCommonDaoTest(db, opt))
