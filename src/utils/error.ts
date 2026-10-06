import type { Debugger } from 'debug'
import type { Response } from 'integreat'

export const createError = (error: Error, message: string) => ({
  status: 'error',
  error: `${message} ${error.message}`,
})

export const joinErrors = (responses: Response[]) =>
  responses.map((response) => response.error).join(' | ')

export const logRedisError =
  (debug: Debugger, label: string) => (err: unknown) =>
    debug(`${label}: ${err}`)
