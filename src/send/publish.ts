import debugFn from 'debug'
import { createError } from '../utils/error.js'
import type { createClient } from '@redis/client'

const debug = debugFn('integreat:transporter:redis')

export default async function sendSet(
  client: ReturnType<typeof createClient>,
  channel: unknown,
  prefix: unknown,
  data: unknown,
) {
  if (typeof channel !== 'string') {
    return {
      status: 'badrequest',
      error: 'Specify a `channel` to send a message',
    }
  }
  if (!data) {
    return {
      status: 'badrequest',
      error: 'Specify `data` to send as a message',
    }
  }

  const strData = String(data)
  const channelWithPrefix =
    typeof prefix === 'string' ? `${prefix}:${channel}` : channel

  try {
    const ret = await client.publish(channelWithPrefix, strData)
    debug("Redis publish with channel '%s' returned %o", channelWithPrefix, ret)
  } catch (error) {
    return createError(
      error as Error,
      `Error from Redis while publishing to channel '${channelWithPrefix}'.`,
    )
  }

  return { status: 'ok' }
}
