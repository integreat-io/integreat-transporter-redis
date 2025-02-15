import debugFn from 'debug'
import { setTimeout } from 'timers/promises'
import type { Connection } from './types.js'
import type { createClient } from '@redis/client'

const debug = debugFn('integreat:transporter:redis')

const redisDisconnect = async (
  redisClient: ReturnType<typeof createClient>,
) => {
  try {
    debug('disconnect - redisDisconnect: disconnecting the redisClient')
    await redisClient.disconnect()
  } catch (e) {
    debug(`disconnect - redisDisconnect: error on redisClient.disconnect: ${e}`)
  }
}

/**
 * Disconnect. Will try and disconnect the redisClient, but timeout after 100ms.
 */
export default async function disconnect(
  connection: Connection | null,
): Promise<void> {
  if (!connection || !connection.redisClient) {
    debug('disconnect: No connection or redisClient')
    return
  }

  // Disconnect the redisClient, but timeout after 100ms
  await Promise.race([redisDisconnect(connection.redisClient), setTimeout(100)])

  debug('disconnect: setting connection.redisClient to null')
  connection.redisClient = null
}
