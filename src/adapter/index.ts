import redis = require('redis')
import connect from './connect'
import disconnect from './disconnect'
import serialize from './serialize'
import send from './send'
import normalize from './normalize'

export type DataProperty = string | number | boolean | object

export interface Data {
  [key: string]: DataProperty
}

export interface SerializedData {
  [key: string]: string
}

export type RequestData = Data | Data[] | DataProperty | null

export interface EndpointOptions {
  prefix?: string
  redis?: {
    [key: string]: string
  }
  concurrency?: number
}

export interface Params {
  id?: string,
  type: string
}

export interface Request {
  action: string,
  data?: RequestData,
  endpoint?: EndpointOptions,
  params?: Params
}

export interface Response {
  status: string,
  data?: any,
  error?: string
}

export interface Connection {
  status: string,
  error?: string,
  redisClient: redis.RedisClient | null
}

export default {
  authentication: null,

  prepareEndpoint: (endpointOptions: EndpointOptions, serviceOptions?: EndpointOptions) =>
    (serviceOptions) ? { ...serviceOptions, ...endpointOptions } : endpointOptions,

  connect: connect(redis),

  serialize,

  send,

  normalize,

  disconnect
}
