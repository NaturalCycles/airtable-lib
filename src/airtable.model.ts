import {
  arraySchema,
  integerSchema,
  JoiValidationError,
  objectSchema,
  stringSchema,
  urlSchema,
} from '@naturalcycles/nodejs-lib'
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

/* Example:

  "filename": "nc_product_landscape_4_1200_6243.jpg",
  "id": "attmPr95JznHLp4UY",
  "size": 152338,
  "thumbnails": {
    "full": {
      "height": 583,
      "url": "https://dl.airtable.com/Umt8YV0wSNCZzVG4nGEh_full_nc_product_landscape_4_1200_6243.jpg",
      "width": 932
    },
    "large": {
      "height": 512,
      "url": "https://dl.airtable.com/VuG1E7mRyTlK3ZQFzQKg_large_nc_product_landscape_4_1200_6243.jpg",
      "width": 818
    },
    "small": {
      "height": 36,
      "url": "https://dl.airtable.com/zQo9TzDHRda8WYhtL1Hc_small_nc_product_landscape_4_1200_6243.jpg",
      "width": 58
    }
  },
  "type": "image/jpeg",
  "url": "https://dl.airtable.com/RZECUa9NS2q3bTR8B0Hg_nc_product_landscape_4_1200_6243.jpg"
 */

export interface AirtableThumbnail {
  width: number
  height: number
  url: string
}

export const airtableThumbnailSchema = objectSchema<AirtableThumbnail>({
  width: integerSchema.min(0),
  height: integerSchema.min(0),
  url: urlSchema(),
})

export interface AirtableAttachment {
  id: string
  url: string
  filename: string
  size?: number
  type?: string
  thumbnails?: {
    full: AirtableThumbnail
    large: AirtableThumbnail
    small: AirtableThumbnail
  }
}

export interface AirtableAttachmentUpload {
  url: string
  filename?: string
}

export const airtableAttachmentSchema = objectSchema<AirtableAttachment>({
  id: stringSchema,
  url: urlSchema(),
  filename: stringSchema,
  size: integerSchema.optional(),
  type: stringSchema.optional(),
  thumbnails: objectSchema({
    full: airtableThumbnailSchema,
    large: airtableThumbnailSchema,
    small: airtableThumbnailSchema,
  })
    .options({ stripUnknown: false })
    .optional(),
}).options({ stripUnknown: false })

export const airtableAttachmentsSchema = arraySchema<AirtableAttachment>(airtableAttachmentSchema)
  .optional()
  .default([])

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

  /**
   * Applies only to "upload to remote Airtable" tasks.
   * `true` means it will upload rows concurrently and the order will NOT be preserved.
   * Otherwise order is preserved, but upload is sequential and slower.
   */
  skipPreservingOrder?: boolean

  /**
   * Use given concurrency instead of default concurrency for given method (differs per method).
   */
  concurrency?: number

  /**
   * Cache fetched results inside AirtableBaseDao (applicable to AirtableBaseDao methods that fetch data,
   * not applicable to AirtableTableDao methods).
   * @default false
   */
  cache?: boolean
}
