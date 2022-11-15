import { createClient } from 'redis'
import connect from './connect'
import disconnect from './disconnect'
import send from './send'

export interface Options extends Record<string, unknown> {
  prefix?: string
  redis?: {
    [key: string]: string
  }
  concurrency?: number
  connectionTimeout?: number
  useTypeAsPrefix?: boolean
}

export interface Payload extends Record<string, unknown> {
  type?: string | string[]
  id?: string | string[]
  data?: unknown
  pattern?: string
  params?: Record<string, unknown>
}

export interface Meta extends Record<string, unknown> {
  options?: Options
}

export interface Action {
  type: string
  payload: Payload
  response?: Response
  meta?: Meta
}

export interface Response {
  status: string | null
  data?: unknown
  error?: string
}

export interface Connection extends Record<string, unknown> {
  status: string
  error?: string
  expire?: null | number
  redisClient?: ReturnType<typeof createClient> | null
}

export default {
  authentication: null,

  prepareOptions: (options: Options): Options => options,

  connect: connect(createClient),

  send,

  disconnect,
}
