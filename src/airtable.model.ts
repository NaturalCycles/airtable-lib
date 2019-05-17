import { AnySchema } from '@hapi/joi'
import {
  arraySchema,
  JoiValidationError,
  objectSchema,
  stringSchema,
} from '@naturalcycles/nodejs-lib'
import { AirtableApiSort } from 'airtable'

export enum AIRTABLE_ERROR_CODE {
  AIRTABLE_ERROR = 'AIRTABLE_ERROR',
}

export type AirtableId = string

export const airtableIdSchema = stringSchema // todo: apply certain restrictions

export const airtableMultipleLinkSchema = arraySchema.items(airtableIdSchema).optional()
export const airtableSingleLinkSchema = arraySchema
  .items(airtableIdSchema)
  .max(1)
  .optional()

export interface AirtableLibCfg {
  apiKey: string
}

export interface AirtableRecord {
  /**
   * `airtableId` changes every time you re-upload data from json to Airtable,
   * so not to be relied upon.
   * The purpose of `airtableId` is to link records between each other.
   */
  airtableId: AirtableId

  /**
   * Convention for each Airtable table to have a string `id` property.
   */
  // id: string
}

export const airtableRecordSchema = objectSchema({
  airtableId: airtableIdSchema,
  // id: stringSchema,
})

export interface AirtableBaseSchema {
  baseId: string
  tableSchemas: AirtableTableSchema[]
}

export interface AirtableTableSchema<T = any> {
  tableName: string
  validationSchema?: AnySchema
  sort?: AirtableApiSort<T>[]
}

export interface AirtableDaoOptions {
  /**
   * @default false
   *
   * Will still _transform_ the value.
   */
  skipValidation?: boolean

  /**
   * @default false
   */
  throwOnValidationError?: boolean

  onValidationError?: (err: JoiValidationError) => any
}
