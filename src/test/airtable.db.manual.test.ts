import {
  CommonDBImplementationFeatures,
  CommonDBImplementationQuirks,
  runCommonDaoTest,
  runCommonDBTest,
} from '@naturalcycles/db-lib/dist/testing'
import { requireEnvKeys } from '@naturalcycles/nodejs-lib'
import { AirtableDB } from '../airtableDB'

jest.setTimeout(60000)

require('dotenv').config()

const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = requireEnvKeys(
  'AIRTABLE_API_KEY',
  'AIRTABLE_BASE_ID',
)

const db = new AirtableDB({
  apiKey: AIRTABLE_API_KEY,
  baseId: AIRTABLE_BASE_ID,
})

const features: CommonDBImplementationFeatures = {
  bufferSupport: false,
  nullValues: false,
}

const quirks: CommonDBImplementationQuirks = {
  allowExtraPropertiesInResponse: true,
  allowBooleansAsUndefined: true,
}

describe('runCommonDBTest', () => runCommonDBTest(db, features, quirks))

describe('runCommonDaoTest', () => runCommonDaoTest(db, features, quirks))

test.skip('manual1', async () => {
  delete db.cfg.baseId

  await db.saveBatch<any>(`appT51quIWm4RiMpc.Translations`, [
    {
      id: 'push-startTesting-title2',
      'en-US': 'sdf3',
    },
  ])
})
