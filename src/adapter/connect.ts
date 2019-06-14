import redisLib = require('redis')
import { EndpointOptions, Connection } from '.'

interface Redis {
  createClient: (options?: { [key: string]: string }) => redisLib.RedisClient
}

const wrapInOk = (redisClient: redisLib.RedisClient) => ({
  status: 'ok',
  redisClient
})

const createErrorResponse = () => ({
  status: 'error',
  error: 'No redis options',
  redisClient: null
})

export default function connect (redis: Redis) {
  return async (
    serviceOptions: EndpointOptions,
    _auth: object | null,
    connection: Connection | null
  ): Promise<Connection> => {
    if (connection) {
      return connection
    }
    return (serviceOptions && serviceOptions.redis)
      ? wrapInOk(redis.createClient(serviceOptions.redis))
      : createErrorResponse()
  }
}
