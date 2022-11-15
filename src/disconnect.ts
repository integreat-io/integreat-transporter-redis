import { promisify } from 'util'
import { Connection } from '.'
import debugFn from 'debug'

const debug = debugFn('integreat:transporter:redis')

export default async function disconnect(
  connection: Connection | null
): Promise<void> {
  if (connection && connection.status === 'ok' && connection.redisClient) {
    debug('Disconnect Redis client')
    await promisify(connection.redisClient.quit).bind(connection.redisClient)()
    connection.redisClient = null
  }
}
