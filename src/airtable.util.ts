/**
 * 1. Sorts base by name of the table.
 * 2. Sort all records of all tables by key name.
 */
export function sortAirtableBase<BASE>(base: BASE): BASE {
  if (!base) return base
  const newBase = sortObjectKeys(base)

  Object.entries(newBase).forEach(([tableName, records]) => {
    newBase[tableName] = (records as any[]).map(sortObjectKeys)
  })

  return newBase
}

function sortObjectKeys<T>(o: T): T {
  return Object.keys(o)
    .sort()
    .reduce((r, k) => {
      r[k] = o[k]
      return r
    }, {} as T)
}
