import type { createClient } from 'redis'

export interface GenerateId {
  (id: string, type?: string): string
}

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
