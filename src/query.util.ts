import { DBQuery } from '@naturalcycles/db-lib'
import { AirtableApiSelectOpts } from './airtable.api'

/**
 * https://support.airtable.com/hc/en-us/articles/203255215-Formula-Field-Reference
 */
export function dbQueryToAirtableSelectOptions<DBM>(q: DBQuery<DBM>): AirtableApiSelectOpts<DBM> {
  const o: AirtableApiSelectOpts<DBM> = {}

  // filter
  if (q._filters.length) {
    const tokens = q._filters.map(f => {
      if (f.op === 'in') throw new Error('filter by "in" is not supported!')

      let v: any
      if (typeof f.val === 'boolean') {
        if (f.val) {
          v = 'TRUE()'
        } else {
          return `OR({${f.name}}=FALSE(),{${f.name}}=BLANK())`
        }
      } else {
        v = `"${f.val}"`
      }

      return `{${f.name}}${f.op}${v}`
    })

    o.filterByFormula = `AND(${tokens.join(',')})`
  }

  // limit
  if (q._limitValue) {
    o.maxRecords = q._limitValue
  }

  // order
  if (q._orders.length) {
    o.sort = q._orders.map(o => ({
      field: o.name as keyof DBM,
      direction: o.descending ? 'desc' : 'asc',
    }))
  }

  // select
  if (q._selectedFieldNames) {
    o.fields = q._selectedFieldNames as (keyof DBM)[]

    if (!o.fields.length) {
      o.fields.push('id' as keyof DBM)
    }
  }

  return o
}
