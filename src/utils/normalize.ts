import { isObject, isDate } from './is.js'

function normalizeValue(value: string) {
  try {
    return value === '##null##' ? null : JSON.parse(value)
  } catch {
    return value
  }
}

export const normalizeData = (id: string) => (data: Record<string, string>) =>
  Object.entries(data).reduce(
    (data, [key, value]) => ({ id, ...data, [key]: normalizeValue(value) }),
    {},
  )

const serializeObject = (value: Record<string, unknown>) =>
  value instanceof Date ? value.toISOString() : JSON.stringify(value)

export function serializeData(value: unknown) {
  if (value === null) {
    return '##null##'
  } else if (isObject(value)) {
    return serializeObject(value)
  } else if (isDate(value)) {
    return value.toISOString()
  } else {
    return String(value)
  }
}
