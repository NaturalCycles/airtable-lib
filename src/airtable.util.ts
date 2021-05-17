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
