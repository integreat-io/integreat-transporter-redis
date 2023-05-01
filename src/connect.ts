import debugFn from 'debug'
import { createClient } from 'redis'
import disconnect from './disconnect.js'
import type { Options, Connection } from './types.js'

const debug = debugFn('integreat:transporter:redis')

const wrapInOk = (
  redisClient: ReturnType<typeof createClient>,
  connectionTimeout?: number
) => ({
  status: 'ok',
  redisClient,
  expire:
    typeof connectionTimeout === 'number'
      ? Date.now() + connectionTimeout
      : null,
})

const createErrorResponse = () => ({
  status: 'error',
  error: 'No redis options',
  redisClient: null,
})

const isExpired = (expire?: number | null) =>
  typeof expire === 'number' && expire < Date.now()

async function createConnection(
  createRedis: typeof createClient,
  options: Options
) {
  debug(
    `Creating new Redis client with expire timeout ${options.connectionTimeout}.`
  )
  const client = createRedis(options.redis)
  await client.connect()
  const connection = wrapInOk(client, options.connectionTimeout)

  client.on('error', (err) => {
    debug(`Disconnecting. Redis error: ${err}`)
    return disconnect(connection)
  })

  return connection
}

export default function connect(createRedis = createClient) {
  return async (
    options: Options,
    _auth: Record<string, unknown> | null,
    connection: Connection | null
  ): Promise<Connection | null> => {
    // If a connection with a redisClient is given -- return it
    if (connection?.redisClient) {
      debug(`Redis client expire time ${connection.expire} (at ${Date.now()}).`)
      if (!isExpired(connection.expire)) {
        return connection
      }

      // ... unless it is expired. If so, disconnect and connect again
      debug('Disconnecting Redis due to expired connection (timeout reached)')
      await disconnect(connection)
    }

    // Connect to redis (create a new redis client)
    if (options && options.redis) {
      return await createConnection(createRedis, options)
    } else {
      return createErrorResponse()
    }
  }
}
