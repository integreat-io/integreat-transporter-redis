import { promisify } from 'util'
import redisLib = require('redis')

export default async function disconnect (client: redisLib.RedisClient | null) {
  if (client) {
    await promisify(client.quit).bind(client)()
  }
}
