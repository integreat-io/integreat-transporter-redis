import debugFn from 'debug'
import { setTimeout } from 'timers/promises'
import type { Connection } from './types.js'
import type { createClient } from 'redis'

const debug = debugFn('integreat:transporter:redis')

export default async function disconnect2(
  connection: Connection | null,
): Promise<void> {
  if (connection === null) {
    debug('disconnect: connection is null')
    return
  }
  if (connection.redisClient === null) {
    debug('disconnect: connection.redisClient is null')
    return
  }
  if (connection.redisClient === undefined) {
    debug('disconnect: connection.redisClient is undefined')
    return
  }
  await Promise.race([redisDisconnect(connection.redisClient), setTimeout(100)])
  debug('disconnect: setting connection.redisClient to null')
  connection.redisClient = null
}

const redisDisconnect = async (
  redisClient: ReturnType<typeof createClient>,
) => {
  try {
    debug('disconnect - tryRedisDisconnect: disconnecting the redisClient')
    await redisClient.disconnect()
  } catch (e) {
    debug(
      `disconnect - tryRedisDisconnect: error on redisClient.disconnect: ${e}`,
    )
  }
}
