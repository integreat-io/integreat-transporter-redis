import { isObject, isDate } from './is.js'

function normalizeValue(value: string) {
  try {
    return value === '##null##' ? null : JSON.parse(value)
  } catch (err) {
    return value
  }
}

export const normalizeData = (id: string) => (data: Record<string, string>) =>
  Object.entries(data).reduce(
    (data, [key, value]) => ({ id, ...data, [key]: normalizeValue(value) }),
    {}
  )

const serializeObject = (value: Record<string, unknown>) =>
  value instanceof Date ? value.toISOString() : JSON.stringify(value)

export const serializeData = (value: unknown) =>
  value === null
    ? '##null##'
    : isObject(value)
    ? serializeObject(value)
    : isDate(value)
    ? value.toISOString()
    : String(value)
