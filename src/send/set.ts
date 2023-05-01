import pLimit from 'p-limit'
import debugFn from 'debug'
import { serializeData } from '../utils/normalize.js'
import { isObject } from '../utils/is.js'
import { createError } from '../utils/error.js'
import type { Response } from 'integreat'
import type { createClient } from 'redis'
import type { GenerateId } from '../types.js'

const debug = debugFn('integreat:transporter:redis')

const itemToArray = (fields: Record<string, unknown>) =>
  Object.entries(fields).reduce(
    (arr, [key, value]) =>
      value === undefined ? arr : [...arr, key, serializeData(value)],
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

function generateResponse(results: Response[]) {
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

export default async function sendSet(
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

  return generateResponse(results)
}
