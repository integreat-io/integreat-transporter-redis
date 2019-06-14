import { promisify } from 'util'
import { Connection } from '.'

export default async function disconnect (connection: Connection | null) {
  if (connection && connection.status === 'ok' && connection.redisClient) {
    await promisify(connection.redisClient.quit).bind(connection.redisClient)()
  }
}
