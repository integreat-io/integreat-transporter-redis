import { createClient } from 'redis'
import mapAny = require('map-any')
import pLimit = require('p-limit')
import debugFn from 'debug'
import { Action, Response, Connection } from '.'

const debug = debugFn('integreat:transporter:redis')

type IdTypeTuple = [string, string | undefined]

interface GenerateId {
  (id: string, type?: string): string
}

const isIdTypeTuple = (value: unknown): value is IdTypeTuple =>
  Array.isArray(value)

const isObject = (data: unknown): data is Record<string, unknown> =>
  typeof data === 'object' && data !== null

const isErrorResponse = (response: Response) =>
  typeof response.status === 'string' &&
  !['ok', 'notfound', 'queued'].includes(response.status)

const joinErrors = (responses: Response[]) =>
  responses.map((response) => response.error).join(' | ')

const combineHashParts = (...parts: (string | undefined)[]) =>
  parts.filter(Boolean).join(':')

const createError = (error: Error, message: string) => ({
  status: 'error',
  error: `${message} ${error.message}`,
})

const useType = (useTypeAsPrefix: boolean, type?: string | string[]) =>
  useTypeAsPrefix && typeof type === 'string' ? type : undefined

const generateId =
  (prefix?: string, type?: string | string[], useTypeAsPrefix = true) =>
  (id: string, idType?: string) =>
    combineHashParts(prefix, useType(useTypeAsPrefix, idType || type), id)

function normalizeValue(value: string) {
  try {
    return value === '##null##' ? null : JSON.parse(value)
  } catch (err) {
    return value
  }
}

const normalizeData = (id: string) => (data: Record<string, string>) =>
  Object.entries(data).reduce(
    (data, [key, value]) => ({ id, ...data, [key]: normalizeValue(value) }),
    {}
  )

const serializeObject = (value: Record<string, unknown>) =>
  value instanceof Date ? value.toISOString() : JSON.stringify(value)

const serializeValue = (value: unknown) =>
  value === null
    ? '##null##'
    : isObject(value)
    ? serializeObject(value)
    : String(value)

async function getIds(
  client: ReturnType<typeof createClient>,
  generateId: GenerateId,
  pattern?: string
) {
  const idPattern = combineHashParts(pattern, '*')
  const findHash = generateId(idPattern)
  const prefixLength = findHash.length - idPattern.length

  debug("Get from redis key pattern '%s'.", findHash)
  try {
    const ids = await client.keys(findHash)
    debug("Redis get with key pattern '%s' returned %o", findHash, ids)
    return ids.map((id) => id.slice(prefixLength))
  } catch (error) {
    debug("Redis get with key pattern '%s' failed: %s", findHash, error)
    throw error
  }
}

async function getItem(
  client: ReturnType<typeof createClient>,
  generateId: GenerateId,
  id: string
) {
  const hash = generateId(id)

  debug("Get from redis id '%s', hash '%s'.", id, hash)
  try {
    const responseData = await client.hGetAll(hash)
    debug("Redis get with hash '%s' returned %o", hash, responseData)
    return responseData && Object.keys(responseData).length > 0
      ? { status: 'ok', data: mapAny(normalizeData(id), responseData) }
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
  client: ReturnType<typeof createClient>,
  generateId: GenerateId,
  id?: string | string[],
  pattern?: string,
  concurrency = 1
): Promise<Response> {
  // Collection
  if (!id) {
    let ids: string[] = []
    try {
      ids = await getIds(client, generateId, pattern)
    } catch (error) {
      return {
        status: 'error',
        error: `Could not get collection from Redis. ${error}`,
      }
    }
    if (ids.length === 0) {
      return { status: 'ok', data: [] }
    }
    return sendGet(client, generateId, ids, undefined, concurrency)
  }

  // Members
  if (Array.isArray(id)) {
    // Sets max concurrency on promises called with `limit()`
    const limit = pLimit(concurrency)

    const responses = await Promise.all(
      id.map((id) => limit(() => getItem(client, generateId, id)))
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
  return getItem(client, generateId, id)
}

const itemToArray = (fields: Record<string, unknown>) =>
  Object.entries(fields).reduce(
    (arr, [key, value]) =>
      value === undefined ? arr : [...arr, key, serializeValue(value)],
    [] as string[]
  )

async function setItem(
  client: ReturnType<typeof createClient>,
  generateId: GenerateId,
  item: Record<string, unknown>,
  id?: string | null
): Promise<Response> {
  const { id: itemId, ...fields } = item
  id = (itemId as string | null | undefined) || id
  if (typeof id !== 'string') {
    return { status: 'badrequest', error: 'Cannot set data with no id' }
  }
  const itemType = item.$type as string | undefined
  const hash = generateId(id, itemType)

  debug("Set to redis id '%s', hash '%s': %o", id, hash, fields)
  try {
    const ret = await client.hSet(hash, itemToArray(fields))
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
  client: ReturnType<typeof createClient>,
  generateId: GenerateId,
  id: string | string[] | null | undefined,
  data: unknown,
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

  // Sets max concurrency on promises called with `limit()`
  const limit = pLimit(concurrency)

  const results = await Promise.all(
    items.map((item) => limit(() => setItem(client, generateId, item, id)))
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
  client: ReturnType<typeof createClient>,
  generateId: GenerateId,
  id: string | string[] | null | undefined,
  data: unknown
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

  const keys = idTypes.map(([id, itemType]) => generateId(id, itemType))

  debug("Delete hashes '%s' from Redis", keys)
  try {
    const ret = await client.del(keys)
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
      error: "No redis client given to redis transporter's send method",
    }
  }
  const {
    type: actionType,
    meta,
    payload: { data, id, type, pattern },
  } = action

  const { prefix, concurrency, useTypeAsPrefix = true } = meta?.options || {}
  const client = connection.redisClient

  const generateIdFn = generateId(prefix, type, useTypeAsPrefix)

  switch (actionType) {
    case 'GET':
      return sendGet(client, generateIdFn, id, pattern, concurrency)
    case 'SET':
      return sendSet(client, generateIdFn, id, data, concurrency)
    case 'DELETE':
      return sendDel(client, generateIdFn, id, data)
    default:
      return { status: 'badrequest', error: `Unknown action '${actionType}'` }
  }
}
