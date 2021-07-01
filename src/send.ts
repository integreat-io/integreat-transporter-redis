import { promisify } from 'util'
import redisLib = require('redis')
import mapAny = require('map-any')
import pLimit = require('p-limit')
import debugFn from 'debug'
import { Action, Response, Connection } from '.'

const debug = debugFn('great:adapter:redis')

interface HMSet {
  (hash: string, fields: string[]): Promise<string>
}

const isObject = (data: unknown): data is Record<string, unknown> =>
  typeof data === 'object' && data !== null

const hashFromIdAndPrefix = (id: string, prefix?: string) =>
  typeof prefix === 'string' && prefix !== '' ? `${prefix}:${id}` : id

const createError = (error: Error, message: string) => ({
  status: 'error',
  error: `${message} ${error.message}`,
})

function normalizeValue(value: string) {
  try {
    return JSON.parse(value)
  } catch (err) {
    return value
  }
}

const normalizeData = (data: Record<string, string>) =>
  Object.entries(data).reduce(
    (data, [key, value]) => ({ ...data, [key]: normalizeValue(value) }),
    {}
  )

const serializeObject = (value: Record<string, unknown>) =>
  value instanceof Date ? value.toISOString() : JSON.stringify(value)

const serializeValue = (value: unknown) =>
  value === null || typeof value === 'undefined'
    ? ''
    : isObject(value)
    ? serializeObject(value)
    : String(value)

const sendGet = async (
  client: redisLib.RedisClient,
  id?: string,
  prefix?: string
) => {
  if (!id) {
    return { status: 'notfound', error: 'Cannot get data with no id' }
  }
  const hash = hashFromIdAndPrefix(id, prefix)
  const hgetall = promisify(client.hgetall).bind(client)

  debug("Get from redis id '%s', hash '%s'.", id, hash)
  try {
    const responseData = await hgetall(hash)
    debug("Redis get with hash '%s' returned %o", hash, responseData)
    return responseData && Object.keys(responseData).length > 0
      ? { status: 'ok', data: mapAny(normalizeData, responseData) }
      : { status: 'notfound', error: `Could not find hash '${hash}'` }
  } catch (error) {
    debug("Redis get with hash '%s' failed: %s", hash, error)
    return createError(
      error,
      `Error from Redis while getting from hash '${hash}'.`
    )
  }
}

const itemToArray = (fields: Record<string, unknown>) =>
  Object.entries(fields).reduce(
    (arr, [key, value]) => [...arr, key, serializeValue(value)],
    [] as string[]
  )

const setItem = async (
  hmset: HMSet,
  item: Record<string, unknown>,
  id?: string | null,
  prefix?: string
): Promise<Response> => {
  const { id: itemId, ...fields } = item
  id = (itemId as string | null | undefined) || id
  if (typeof id !== 'string') {
    return { status: 'badrequest', error: 'Cannot set data with no id' }
  }
  const hash = hashFromIdAndPrefix(id, prefix)

  debug("Set to redis id '%s', hash '%s': %o", id, hash, fields)
  try {
    const ret = await hmset(hash, itemToArray(fields))
    debug("Redis set with hash '%s' returned %o", hash, ret)
    return { status: 'ok', data: null }
  } catch (error) {
    debug("Redis set with hash '%s' failed: %s", hash, error)
    return createError(
      error,
      `Error from Redis while setting on hash '${hash}'.`
    )
  }
}

const sendSet = async (
  client: redisLib.RedisClient,
  id: string | null | undefined,
  data: unknown,
  prefix?: string,
  concurrency = 1
) => {
  const items = ([] as unknown[]).concat(data).filter(isObject)
  if (items.length === 0) {
    return { status: 'noaction', error: 'No data to SET' }
  }

  const hmset: HMSet = promisify<string, string[], 'OK'>(client.hmset).bind(
    client
  )

  // Sets max concurrency on promises called with `limit()`
  const limit = pLimit(concurrency)

  const results = await Promise.all(
    items.map((item) => limit(() => setItem(hmset, item, id, prefix)))
  )

  const errors = results.filter((result) => result.status !== 'ok')
  if (errors.length === 0) {
    // No error — great!
    return { status: 'ok', data: null }
  } else if (results.length === 1) {
    // One result — return error as is
    return errors[0]
  } else {
    const error = errors.map((result) => result.error).join(' | ')
    const rest = errors.length < results.length ? ' | The rest succeeded' : ''
    return { status: 'error', error: `${error}${rest}` }
  }
}

export default async function send(
  action: Action,
  connection: Connection | null
): Promise<Response> {
  if (!connection || connection.status !== 'ok' || !connection.redisClient) {
    return {
      status: 'error',
      error: "No redis client given to redis adapter's send method",
    }
  }
  const {
    type: actionType,
    meta: { options } = {},
    payload: { data, id },
  } = action

  const prefix = options?.prefix
  const client = connection.redisClient
  const concurrency = options?.concurrency

  if (Array.isArray(id)) {
    return { status: 'badrequest', error: 'Array of ids not supported' }
  }

  return actionType === 'SET'
    ? sendSet(client, id, data, prefix, concurrency)
    : sendGet(client, id, prefix)
}
