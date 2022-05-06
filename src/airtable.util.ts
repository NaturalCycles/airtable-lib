import { _mapValues } from '@naturalcycles/js-lib'
import { AirtableAttachment, AirtableThumbnails } from './airtable.model'

/**
 * 1. Sorts base by name of the table.
 * 2. Sort all records of all tables by key name.
 */
export function sortAirtableBase<BASE>(base: BASE): BASE {
  if (!base) return base
  const newBase = sortObjectKeys(base)

  Object.entries(newBase).forEach(([tableName, records]) => {
    newBase[tableName] = (records as any[]).map(r => sortObjectKeys(r))
  })

  return newBase
}

function sortObjectKeys<T>(o: T): T {
  return (
    Object.keys(o)
      .sort()
      // eslint-disable-next-line unicorn/no-array-reduce
      .reduce((r, k) => {
        r[k] = o[k]
        return r
      }, {} as T)
  )
}

export function isArrayOfAttachments(v: any): v is AirtableAttachment[] {
  return (
    Array.isArray(v) &&
    !!v.length &&
    v.some(item => !!item && typeof item === 'object' && !!item.url)
  )
}

export function stripQueryStringFromAttachments(v: any): AirtableAttachment[] {
  if (!isArrayOfAttachments(v)) return v

  return v.map(a => ({
    ...a,
    url: stripQueryString(a.url),
    thumbnails: _mapValues(a.thumbnails || ({} as AirtableThumbnails), (_, v) => ({
      ...v,
      url: stripQueryString(v.url),
    })),
  }))
}

function stripQueryString(url: string): string {
  return url.split('?')[0]!
}
