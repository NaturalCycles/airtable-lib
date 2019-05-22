import {
  AnySchemaTyped,
  arraySchema,
  JoiValidationError,
  objectSchema,
  stringSchema,
} from '@naturalcycles/nodejs-lib'
import { AirtableApiSort } from 'airtable'
import { AirtableRecord } from './index'

export enum AIRTABLE_ERROR_CODE {
  AIRTABLE_ERROR = 'AIRTABLE_ERROR',
}

export type AirtableId<T = any> = string

export const airtableIdSchema = stringSchema // todo: apply certain restrictions

export const airtableMultipleLinkSchema = <T>() =>
  arraySchema<AirtableId<T>>(airtableIdSchema)
    .optional()
    .default([])

export const airtableSingleLinkSchema = <T>() => airtableMultipleLinkSchema<T>().max(1)

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

export const airtableRecordSchema = objectSchema<AirtableRecord>({
  airtableId: airtableIdSchema,
  // id: stringSchema,
})

export interface AirtableBaseSchema {
  baseId: string
  tableSchemas: AirtableTableSchema[]
}

export interface AirtableTableSchema<T = any> {
  tableName: string
  validationSchema?: AnySchemaTyped<T>
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
