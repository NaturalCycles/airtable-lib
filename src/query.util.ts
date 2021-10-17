import { DBQuery, DBQueryFilterOperator, ObjectWithId } from '@naturalcycles/db-lib'
import { _uniq } from '@naturalcycles/js-lib'
import { AirtableApiSelectOpts } from './airtable.api'
import { AirtableDBOptions } from './airtableDB'

const OP_MAP: Partial<Record<DBQueryFilterOperator, string>> = {
  '==': '=',
}

/**
 * https://support.airtable.com/hc/en-us/articles/203255215-Formula-Field-Reference
 */
export function dbQueryToAirtableSelectOptions<ROW extends ObjectWithId>(
  q: DBQuery<ROW>,
  opt: AirtableDBOptions,
): AirtableApiSelectOpts<ROW> {
  const o: AirtableApiSelectOpts<ROW> = {}

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

      const op = OP_MAP[f.op] || f.op

      return `{${f.name}}${op}${v}`
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
      field: o.name,
      direction: o.descending ? 'desc' : 'asc',
    }))
  }

  // select
  if (q._selectedFieldNames) {
    const { idField = 'id' } = opt

    // idField must be always included, to be able to "filter empty rows" (by checking if id is empty or not)
    o.fields = _uniq([idField, ...q._selectedFieldNames]) as (keyof ROW)[]
  }

  return o
}
