import debugFn from 'debug'
import { createClient } from 'redis'
import disconnect from './disconnect.js'
import { combineHashParts } from './utils/ids.js'
import type {
  Options,
  IncomingOptions,
  Connection,
  RedisOptions,
} from './types.js'

const debug = debugFn('integreat:transporter:redis')

const prepareIncoming = ({ keyPattern }: IncomingOptions, prefix?: string) => ({
  keyPattern: combineHashParts(prefix, keyPattern),
})

const wrapInOk = (
  redisClient: ReturnType<typeof createClient>,
  { connectionTimeout, incoming, prefix }: Options,
): Connection => ({
  status: 'ok',
  redisClient,
  expire:
    typeof connectionTimeout === 'number'
      ? Date.now() + connectionTimeout
      : null,
  ...(incoming ? { incoming: prepareIncoming(incoming, prefix) } : {}),
})

const createErrorResponse = () => ({
  status: 'error',
  error: 'No redis options',
  redisClient: null,
})

const isExpired = (expire?: number | null) =>
  typeof expire === 'number' && expire < Date.now()

const prepareRedisOptions = (
  { uri, host, port, database, tls, auth: { key, secret } = {} }: RedisOptions,
  auth: Record<string, unknown> | null,
) =>
  typeof uri === 'string'
    ? { url: uri }
    : {
        socket: { host, port, tls },
        database,
        username: auth?.key ?? key,
        password: auth?.secret ?? secret,
      }

async function createConnection(
  createRedis: typeof createClient,
  authObj: RedisOptions,
  options: Options,
) {
  debug(
    `Creating new Redis client with expire timeout ${options.connectionTimeout}.`,
  )
  const client = createRedis(authObj) // TS: We tested this before calling this fn
  let connection: Connection | null = null

  // We need to set the error handler before calling `connect()`, or else `redis` will not reconnect on disconnects
  client.on('error', (err) => {
    debug(`Redis error: ${err}`)
  })

  await client.connect()
  connection = wrapInOk(client, options)
  return connection
}

export default function connect(createRedis = createClient) {
  return async (
    options: Options,
    auth: Record<string, unknown> | null,
    connection: Connection | null,
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
    if (options?.redis && options) {
      const redisOptions = prepareRedisOptions(options.redis, auth)
      return await createConnection(createRedis, redisOptions, options)
    } else {
      return createErrorResponse()
    }
  }
}
