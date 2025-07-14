import type {
  Dispatch,
  Action,
  Response,
  AuthenticateExternal,
} from 'integreat'
import type { createClient } from '@redis/client'
import type { Connection } from './types.js'

const extractError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const setIdentOrErrorOnAction = (
  action: Action,
  response: Response,
): Action => ({
  ...action,
  ...(response.status !== 'ok' ? { response } : {}),
  meta: { ...action.meta, ident: response.access?.ident },
})

const removePrefix = (key: string, prefix?: string): string =>
  typeof prefix === 'string'
    ? key.startsWith(prefix)
      ? key.slice(prefix.length)
      : key
    : key

const postfixColon = (prefix: string): string =>
  prefix ? `${prefix}:` : prefix

function extractKeyPrefix(keyPattern: string): [string, boolean] {
  const isPattern = keyPattern.includes('*')
  const keyPrefix = isPattern
    ? keyPattern?.split('*')[0]
    : postfixColon(keyPattern.split(':').slice(0, -1).join(':'))
  return [keyPrefix, isPattern]
}

const extractKeyspaceEvents = (
  config: Record<string, string>,
): string | undefined => config['notify-keyspace-events']

const hasRequiredKeyspaceEvents = (keyspaceEvents?: string): boolean =>
  typeof keyspaceEvents === 'string' &&
  keyspaceEvents.includes('E') &&
  keyspaceEvents.includes('h')

function addRequiredKeyspaceEvents(keyspaceEvents?: string): string {
  const letters = new Set((keyspaceEvents || '').split(''))
  letters.add('E')
  letters.add('h')
  return [...letters].join('')
}

async function updateConfigIfNeeded(client: ReturnType<typeof createClient>) {
  const config = await client.configGet('notify-keyspace-events')
  const keyspaceEvents = extractKeyspaceEvents(config)
  if (!hasRequiredKeyspaceEvents(keyspaceEvents)) {
    const requiredEvents = addRequiredKeyspaceEvents(keyspaceEvents)
    await client.configSet('notify-keyspace-events', requiredEvents)
  }
}

function createListener(
  dispatch: Dispatch,
  authenticate: AuthenticateExternal,
  keyPattern?: string,
  channels?: string[],
) {
  const [keyPrefix, isPattern] = extractKeyPrefix(keyPattern ?? '')

  return async (message: string, incomingChannel: string) => {
    if (message && incomingChannel) {
      let action
      if (channels) {
        if (channels.includes(incomingChannel)) {
          action = {
            type: 'SET',
            payload: {
              method: 'pubsub',
              channel: incomingChannel,
              data: message, // When listening on a channel, the message holds the published data
            },
            meta: {},
          }
        }
      } else if (keyPattern) {
        if (
          isPattern ? message.startsWith(keyPrefix) : message === keyPattern
        ) {
          action = {
            type: 'SET',
            payload: {
              id: removePrefix(message, keyPrefix), // Get the id from the message by removing the prefix
              method: removePrefix(incomingChannel, '__keyevent@0__:'),
              key: message, // When listening to changes, the message holds the key that was changed
            },
            meta: {},
          }
        }
      }

      if (action) {
        const authentication = { status: 'granted' }
        const authenticateResponse = await authenticate(authentication, action)
        await dispatch(setIdentOrErrorOnAction(action, authenticateResponse))
      }
    }
  }
}

export default async function listen(
  dispatch: Dispatch,
  connection: Connection | null,
  authenticate: AuthenticateExternal,
): Promise<Response> {
  if (!connection?.redisClient) {
    return {
      status: 'error',
      error: 'No Redis client',
    }
  }

  if (connection.incoming?.keyPattern) {
    // Update Redis config on db server if needed, when we're searching for a pattern
    await updateConfigIfNeeded(connection.redisClient)
  } else if (!connection.incoming?.channel) {
    return {
      status: 'noaction',
      warning: 'No `channel` or `keyPattern` to listen to',
    }
  }

  const subscriber = connection.redisClient.duplicate()
  connection.redisSubscriber = subscriber

  // Use incoming channel(s) or listen for hset events
  const incomingChannels = Array.isArray(connection.incoming?.channel)
    ? connection.incoming.channel // Keep array
    : connection.incoming?.channel
      ? [connection.incoming.channel] // Wrap single channel in array
      : undefined
  const channels = incomingChannels ?? ['__keyevent@0__:hset'] // Use keyevent if incoming channel is not set

  const listener = createListener(
    dispatch,
    authenticate,
    connection.incoming?.keyPattern,
    incomingChannels,
  )
  try {
    await subscriber.connect()
    for (const channel of channels) {
      await subscriber.subscribe(channel, listener)
    }
  } catch (error) {
    return {
      status: 'error',
      error: `Could not subscribe to Redis. ${extractError(error)}`,
    }
  }

  return { status: 'ok' }
}
