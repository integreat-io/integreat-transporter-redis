import { promisify } from 'util'
import { Connection } from '.'
const debug = require('debug')('great:adapter:redis')

export default async function disconnect (connection: Connection | null) {
  if (connection && connection.status === 'ok' && connection.redisClient) {
    debug('Disconnect Redis client')
    await promisify(connection.redisClient.quit).bind(connection.redisClient)()
    connection.redisClient = null
  }
}
