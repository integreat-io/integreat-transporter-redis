import redisLib = require('redis')
import { EndpointOptions } from '.'

interface Redis {
  createClient: (options?: { [key: string]: string }) => redisLib.RedisClient
}

export default function connect (redis: Redis) {
  return async (serviceOptions: EndpointOptions, _auth: object | null, connection: redisLib.RedisClient | null) =>
    connection || ((serviceOptions && serviceOptions.redis) ? redis.createClient(serviceOptions.redis) : null)
}
