import { arrayRange } from '@naturalcycles/js-lib'

export interface Table1 {
  name: string
  field1?: string
  numField?: number
}

export function mockTable1 (): Table1[] {
  return arrayRange(1, 10).map(num => ({
    name: `name_${num}`,
    field1: `val ${num}`,
    ...(num % 2 === 0 && { numField: num }),
  }))
}
