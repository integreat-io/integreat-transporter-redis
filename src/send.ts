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

type IdTypeTuple = [string, string | undefined]

const isIdTypeTuple = (value: unknown): value is IdTypeTuple =>
  Array.isArray(value)

const isObject = (data: unknown): data is Record<string, unknown> =>
  typeof data === 'object' && data !== null

const isErrorResponse = (response: Response) =>
  typeof response.status === 'string' &&
  !['ok', 'notfound', 'queued'].includes(response.status)

const joinErrors = (responses: Response[]) =>
  responses.map((response) => response.error).join(' | ')

const hashFromIdAndPrefix = (id: string, type?: string, prefix?: string) =>
  [prefix, type, id].filter(Boolean).join(':')

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

const useType = (useTypeAsPrefix: boolean, type?: string | string[]) =>
  useTypeAsPrefix && typeof type === 'string' ? type : undefined

async function getIds(
  client: redisLib.RedisClient,
  useTypeAsPrefix: boolean,
  type?: string | string[],
  prefix?: string
) {
  const hashPattern = hashFromIdAndPrefix(
    '*',
    useType(useTypeAsPrefix, type),
    prefix
  )
  const getKeys = promisify(client.keys).bind(client)

  debug("Get from redis key pattern '%s'.", hashPattern)
  try {
    const ids = await getKeys(hashPattern)
    debug("Redis get with key pattern '%s' returned %o", hashPattern, ids)
    return ids
  } catch (error) {
    debug("Redis get with key pattern '%s' failed: %s", hashPattern, error)
    throw error
  }
}

async function getItem(
  client: redisLib.RedisClient,
  useTypeAsPrefix: boolean,
  id: string,
  type?: string | string[],
  prefix?: string
) {
  const hash = hashFromIdAndPrefix(id, useType(useTypeAsPrefix, type), prefix)
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
      error as Error,
      `Error from Redis while getting from hash '${hash}'.`
    )
  }
}

async function sendGet(
  client: redisLib.RedisClient,
  useTypeAsPrefix: boolean,
  id?: string | string[],
  type?: string | string[],
  prefix?: string,
  concurrency = 1
): Promise<Response> {
  // Collection
  if (!id) {
    let ids: string[] = []
    try {
      ids = await getIds(client, useTypeAsPrefix, type, prefix)
    } catch (error) {
      return {
        status: 'error',
        error: `Could not get collection from Redis. ${error}`,
      }
    }
    if (ids.length === 0) {
      return { status: 'ok', data: [] }
    }
    return sendGet(client, false, ids, type, undefined, concurrency)
  }

  // Members
  if (Array.isArray(id)) {
    // Sets max concurrency on promises called with `limit()`
    const limit = pLimit(concurrency)

    const responses = await Promise.all(
      id.map((id) =>
        limit(() => getItem(client, useTypeAsPrefix, id, type, prefix))
      )
    )

    if (responses.every((response) => response.status === 'notfound')) {
      return {
        status: 'notfound',
        error: `Cannot get data. ${joinErrors(responses)}`,
      }
    }
    const errors = responses.filter(isErrorResponse)
    if (errors.length > 0) {
      return {
        status: 'error',
        error: `Failed to get from Redis. ${joinErrors(errors)}`,
      }
    }

    const data = responses.flatMap((response) => response.data)
    return { status: 'ok', data }
  }

  // Member
  return getItem(client, useTypeAsPrefix, id, type, prefix)
}

const itemToArray = (fields: Record<string, unknown>) =>
  Object.entries(fields).reduce(
    (arr, [key, value]) => [...arr, key, serializeValue(value)],
    [] as string[]
  )

async function setItem(
  hmset: HMSet,
  useTypeAsPrefix: boolean,
  item: Record<string, unknown>,
  id?: string | null,
  type?: string | string[],
  prefix?: string
): Promise<Response> {
  const { id: itemId, ...fields } = item
  id = (itemId as string | null | undefined) || id
  if (typeof id !== 'string') {
    return { status: 'badrequest', error: 'Cannot set data with no id' }
  }
  const itemType = item.$type as string | undefined
  const hash = hashFromIdAndPrefix(
    id,
    useType(useTypeAsPrefix, itemType || type),
    prefix
  )

  debug("Set to redis id '%s', hash '%s': %o", id, hash, fields)
  try {
    const ret = await hmset(hash, itemToArray(fields))
    debug("Redis set with hash '%s' returned %o", hash, ret)
    return { status: 'ok', data: null }
  } catch (error) {
    debug("Redis set with hash '%s' failed: %s", hash, error)
    return createError(
      error as Error,
      `Error from Redis while setting on hash '${hash}'.`
    )
  }
}

async function sendSet(
  client: redisLib.RedisClient,
  useTypeAsPrefix: boolean,
  id: string | string[] | null | undefined,
  type: string | string[] | undefined,
  data: unknown,
  prefix?: string,
  concurrency = 1
) {
  if (Array.isArray(id)) {
    return {
      status: 'badrequest',
      error: 'Array of ids not supported for SET action',
    }
  }

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
    items.map((item) =>
      limit(() => setItem(hmset, useTypeAsPrefix, item, id, type, prefix))
    )
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

const idAndTypeFromItem = (item: unknown) =>
  isObject(item) ? [item.id, item.$type] : undefined

const extractIdsAndTypeFromData = (
  data: unknown
): [string, string | undefined][] =>
  (Array.isArray(data)
    ? data.map(idAndTypeFromItem)
    : [idAndTypeFromItem(data)]
  ).filter(isIdTypeTuple)

async function sendDel(
  client: redisLib.RedisClient,
  useTypeAsPrefix: boolean,
  id: string | string[] | null | undefined,
  type: string | string[] | undefined,
  data: unknown,
  prefix?: string
) {
  let idTypes: IdTypeTuple[] = extractIdsAndTypeFromData(data).filter(Boolean)
  if (idTypes.length === 0 && id) {
    idTypes = Array.isArray(id)
      ? id.map((id) => (id ? [id, undefined] : undefined)).filter(isIdTypeTuple)
      : [[id, undefined]]
  }

  if (idTypes.length === 0) {
    return { status: 'noaction', error: 'No ids to delete' }
  }

  const keys = idTypes.map(([id, itemType]) =>
    hashFromIdAndPrefix(id, useType(useTypeAsPrefix, itemType || type), prefix)
  )

  const deleteKey = promisify<string[]>(client.del).bind(client)

  debug("Delete hashes '%s' from Redis", keys)
  try {
    const ret = await deleteKey(keys)
    debug("Redis deleted hashes '%s' returned %o", keys, ret)
    return { status: 'ok', data: null }
  } catch (error) {
    debug("Failed to delete hashes '%s' from Redis: %s", keys, error)
    return createError(
      error as Error,
      `Error from Redis while deleting hashes '${keys.join("', '")}'.`
    )
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
    meta,
    payload: { data, id, type },
  } = action

  const { prefix, concurrency, useTypeAsPrefix = true } = meta?.options || {}
  const client = connection.redisClient

  switch (actionType) {
    case 'GET':
      return sendGet(client, useTypeAsPrefix, id, type, prefix, concurrency)
    case 'SET':
      return sendSet(
        client,
        useTypeAsPrefix,
        id,
        type,
        data,
        prefix,
        concurrency
      )
    case 'DELETE':
      return sendDel(client, useTypeAsPrefix, id, type, data, prefix)
    default:
      return { status: 'badrequest', error: `Unknown action '${actionType}'` }
  }
}
