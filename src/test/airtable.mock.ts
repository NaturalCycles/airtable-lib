import { arrayRange, filterFalsyValues } from '@naturalcycles/js-lib'
import {
  arraySchema,
  booleanSchema,
  emailSchema,
  objectSchema,
  stringSchema,
} from '@naturalcycles/nodejs-lib'
import { AirtableJsonConnector, AirtableRemoteConnector } from '..'
import { AirtableApi } from '../airtable.api'
import {
  AirtableAttachment,
  airtableAttachmentsSchema,
  airtableMultipleLinkSchema,
  AirtableRecord,
  airtableRecordSchema,
  airtableSingleLinkSchema,
} from '../airtable.model'
import { AirtableBaseDao } from '../airtableBaseDao'
import { AirtableBasesDao } from '../airtableBasesDao'
import { AirtableTableDao } from '../airtableTableDao'
import { cacheDir } from '../paths.cnst'

const _baseMap: Record<string, AirtableRecord[]> = {
  Test: [],
}

export interface BaseMap {
  TestBase: TestBase
}

export interface TestBase {
  // table1: Table1[]
  // table2: Table2[]
  users: User[]
  roles: Role[]
  permissions: Permission[]
  categories: Category[]
}

export interface Table1 extends AirtableRecord {
  name: string
  field1?: string
  numField?: number
  linkTable2?: Table2[]
}

export interface Table2 extends AirtableRecord {
  name: string
  field3?: string
  boolField?: boolean
  // _linkTable1?: Table1[]
}

export function mockTable1 (): Table1[] {
  return arrayRange(1, 10).map(
    num =>
      ({
        name: `name_${num}`,
        field1: `val ${num}`,
        ...(num % 2 === 0 && { numField: num }),
      } as Table1),
  )
}

export function mockTable2 (): Table2[] {
  return arrayRange(1, 10).map(num =>
    filterFalsyValues({
      name: `name2_${num}`,
      field3: `val3 ${num}`,
      boolField: num % 2 === 0,
    } as Table2),
  )
}

export interface User extends AirtableRecord {
  id: string
  email: string
  roles: Role[]
  category: Category[] // 1-to-1 looks same as 1-to-many in Airtable. That's a limitation
  tags: string[]
  images: AirtableAttachment[]
}

export const userSchema = objectSchema<User>({
  id: stringSchema,
  email: emailSchema,
  roles: airtableMultipleLinkSchema<Role>(),
  category: airtableSingleLinkSchema<Category>(),
  tags: arraySchema(stringSchema)
    .optional()
    .default([]),
  images: airtableAttachmentsSchema,
}).concat(airtableRecordSchema)

export interface Permission extends AirtableRecord {
  id: string
  pub?: boolean
  descr?: string
  parent: Permission[]
  roles: Role[]
}

export const permissionSchema = objectSchema<Permission>({
  id: stringSchema,
  pub: booleanSchema.optional(),
  descr: stringSchema.optional(),
  parent: airtableSingleLinkSchema<Permission>(),
  roles: airtableMultipleLinkSchema<Role>(),
}).concat(airtableRecordSchema)

export interface Role extends AirtableRecord {
  id: string
  pub?: boolean
  descr?: string
  permissions: Permission[]
  users: User[]
}

export const roleSchema = objectSchema<Role>({
  id: stringSchema,
  pub: booleanSchema.optional(),
  descr: stringSchema.optional(),
  permissions: airtableMultipleLinkSchema<Permission>(),
  users: airtableMultipleLinkSchema<User>(),
}).concat(airtableRecordSchema)

export interface Category extends AirtableRecord {
  id: string
  users: User[]
}

export const categorySchema = objectSchema<Category>({
  id: stringSchema,
  users: airtableMultipleLinkSchema<User>(),
}).concat(airtableRecordSchema)

export function mockTableDao1 (api: AirtableApi, baseId: string): AirtableTableDao<Table1> {
  return new AirtableTableDao<Table1>(api, baseId, 'table1', {
    sort: [{ field: 'name' }],
  })
}

export function mockTableDao2 (api: AirtableApi, baseId: string): AirtableTableDao<Table2> {
  return new AirtableTableDao<Table2>(api, baseId, 'table2', {
    sort: [{ field: 'name' }],
  })
}

export function mockBaseDao (api: AirtableApi, baseId: string): AirtableBaseDao<TestBase> {
  const baseName = 'Test'

  return new AirtableBaseDao<TestBase>({
    baseId,
    baseName,
    connectors: [
      new AirtableJsonConnector<TestBase>({ cacheDir }),
      new AirtableRemoteConnector<TestBase>(api, {
        tableSchemaMap: {
          users: { validationSchema: userSchema },
          roles: { validationSchema: roleSchema },
          permissions: { validationSchema: permissionSchema },
          categories: { validationSchema: categorySchema },
        },
      }),
    ],
  })
}

export function mockBasesDao (api: AirtableApi, baseId: string): AirtableBasesDao<BaseMap> {
  const baseDao = mockBaseDao(api, baseId)
  return new AirtableBasesDao<BaseMap>([baseDao])
}
