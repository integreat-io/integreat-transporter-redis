import redisLib = require('redis')
import { EndpointOptions, Connection } from '.'
import disconnect from './disconnect'
const debug = require('debug')('great:adapter:redis')

interface Redis {
  createClient: (options?: { [key: string]: string }) => redisLib.RedisClient
}

const wrapInOk = (
  redisClient: redisLib.RedisClient,
  connectionTimeout?: number
) => ({
  status: 'ok',
  redisClient,
  expire: typeof connectionTimeout === 'number'
    ? Date.now() + connectionTimeout : null
})

const createErrorResponse = () => ({
  status: 'error',
  error: 'No redis options',
  redisClient: null
})

const isExpired = (expire?: number | null) =>
  typeof expire === 'number' && expire < Date.now()

export default function connect (redis: Redis) {
  return async (
    options: EndpointOptions,
    _auth: object | null,
    connection: Connection | null
  ): Promise<Connection> => {
    // If a connection with a redisClient is given -- return it
    if (connection?.redisClient) {
      if (!isExpired(connection.expire)) {
        return connection
      }

      // ... unless it is expired. If so, disconnect and connect again
      debug('Disconnecting Redis due to expired connection (timeout reached)')
      await disconnect(connection)
    }

    // Connect to redis (create a new redis client)
    if (options && options.redis) {
      debug('Creating new Redis client')
      const client = redis.createClient(options.redis)
      const connection = wrapInOk(client, options.connectionTimeout)

      client.on('error', () => {
        debug('Redis error. Disconnecting')
        return disconnect(connection)
      })

      return connection
    } else {
      return createErrorResponse()
    }
  }
}
