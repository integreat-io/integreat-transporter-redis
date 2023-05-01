import type { Response } from 'integreat'

export const isObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]'

export const isDate = (value: unknown): value is Date =>
  Object.prototype.toString.call(value) === '[object Date]'

export const isErrorResponse = (response: Response) =>
  typeof response.status === 'string' &&
  !['ok', 'notfound', 'queued'].includes(response.status)
