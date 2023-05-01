import type { Transporter } from 'integreat'
import { createClient } from 'redis'
import connect from './connect.js'
import disconnect from './disconnect.js'
import send from './send.js'

export interface Options extends Record<string, unknown> {
  prefix?: string
  redis?: {
    [key: string]: string
  }
  concurrency?: number
  connectionTimeout?: number
  useTypeAsPrefix?: boolean
}
export interface Connection extends Record<string, unknown> {
  status: string
  error?: string
  expire?: null | number
  redisClient?: ReturnType<typeof createClient> | null
}

const transporter: Transporter = {
  authentication: null,

  prepareOptions: (options, _serviceId) => options,

  connect: connect(createClient),

  send,

  disconnect,
}

export default transporter
