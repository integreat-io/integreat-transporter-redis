import mapAny from 'map-any'
import pLimit from 'p-limit'
import debugFn from 'debug'
import { normalizeData } from '../utils/normalize.js'
import { isErrorResponse } from '../utils/is.js'
import { createError, joinErrors } from '../utils/error.js'
import { combineHashParts } from '../utils/ids.js'
import type { Response } from 'integreat'
import type { createClient } from 'redis'
import type { GenerateId } from '../types.js'

const debug = debugFn('integreat:transporter:redis')

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

async function getMember(
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

async function getCollection(
  client: ReturnType<typeof createClient>,
  generateId: GenerateId,
  concurrency: number,
  pattern?: string
) {
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

async function getMembers(
  client: ReturnType<typeof createClient>,
  generateId: GenerateId,
  concurrency: number,
  ids: string[]
) {
  // Sets max concurrency on promises called with `limit()`
  const limit = pLimit(concurrency)

  const responses: Response[] = await Promise.all(
    ids.map((id) => limit(() => getMember(client, generateId, id)))
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

export default async function sendGet(
  client: ReturnType<typeof createClient>,
  generateId: GenerateId,
  id?: string | string[],
  pattern?: string,
  concurrency = 1
): Promise<Response> {
  if (!id) {
    // Collection
    return getCollection(client, generateId, concurrency, pattern)
  } else if (Array.isArray(id)) {
    // Members
    return getMembers(client, generateId, concurrency, id)
  } else {
    // Member
    return getMember(client, generateId, id)
  }
}
