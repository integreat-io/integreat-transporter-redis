import redisLib = require('redis')
import { EndpointOptions, Connection } from '.'
import disconnect from './disconnect'

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
      await disconnect(connection)
    }

    // Connect to redis (create a new redis client)
    if (options?.redis) {
      const client = redis.createClient(options.redis)
      const connection = wrapInOk(client, options.connectionTimeout)

      client.on('error', () => disconnect(connection))

      return connection
    } else {
      return createErrorResponse()
    }
  }
}
