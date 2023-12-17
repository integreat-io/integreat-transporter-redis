import type {
  Dispatch,
  Action,
  Response,
  AuthenticateExternal,
} from 'integreat'
import type { createClient } from 'redis'
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

function createKeyMatcher(
  keyPrefix: string,
  keyPattern?: string,
  isPattern = false,
) {
  if (!keyPattern) {
    return () => true
  } else if (isPattern) {
    return (key: string) => key.startsWith(keyPrefix)
  } else {
    return (key: string) => key === keyPattern
  }
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

const createListener =
  (
    dispatch: Dispatch,
    authenticate: AuthenticateExternal,
    isSubscribedKey: (key: string) => boolean,
    keyPrefix: string,
  ) =>
  async (key: string, event: string) => {
    if (isSubscribedKey(key)) {
      const authentication = { status: 'granted' }
      const action = {
        type: 'SET',
        payload: {
          id: removePrefix(key, keyPrefix),
          method: removePrefix(event, '__keyevent@0__:'),
          key,
        },
        meta: {},
      }
      const authenticateResponse = await authenticate(authentication, action)
      await dispatch(setIdentOrErrorOnAction(action, authenticateResponse))
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

  await updateConfigIfNeeded(connection.redisClient)

  const subscriber = connection.redisClient.duplicate()
  const keyPattern = connection.incoming?.keyPattern || '' // Default keyPattern to empty string
  const [keyPrefix, isPattern] = extractKeyPrefix(keyPattern)
  const isSubscribedKey = createKeyMatcher(keyPrefix, keyPattern, isPattern)

  const listener = createListener(
    dispatch,
    authenticate,
    isSubscribedKey,
    keyPrefix,
  )
  try {
    await subscriber.connect()
    await subscriber.subscribe('__keyevent@0__:hset', listener)
  } catch (error) {
    return {
      status: 'error',
      error: `Could not subscribe to Redis. ${extractError(error)}`,
    }
  }

  return { status: 'ok' }
}
