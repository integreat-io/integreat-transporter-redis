import type { createClient } from 'redis'

export interface GenerateId {
  (id: string, type?: string): string
}

export interface RedisOptions {
  uri?: string
  host?: string
  port?: number
  database?: number
  tls?: boolean
  auth?: {
    key?: string
    secret?: string
  }
}

export interface IncomingOptions {
  keyPattern?: string
}

export interface Options extends Record<string, unknown> {
  prefix?: string
  redis?: RedisOptions
  concurrency?: number
  connectionTimeout?: number
  useTypeAsPrefix?: boolean
  incoming?: IncomingOptions
}

export interface Connection extends Record<string, unknown> {
  status: string
  error?: string
  expire?: null | number
  redisClient?: ReturnType<typeof createClient> | null
  incoming?: IncomingOptions
}
