import debugFn from 'debug'
import { isObject } from '../utils/is.js'
import { createError } from '../utils/error.js'
import type { createClient } from 'redis'
import type { GenerateId } from '../types.js'

const debug = debugFn('integreat:transporter:redis')

type IdTypeTuple = [string, string | undefined]

export const isIdTypeTuple = (value: unknown): value is IdTypeTuple =>
  Array.isArray(value)

const idAndTypeFromItem = (item: unknown) =>
  isObject(item) ? [item.id, item.$type] : undefined

const extractIdsAndTypeFromData = (
  data: unknown
): [string, string | undefined][] =>
  (Array.isArray(data)
    ? data.map(idAndTypeFromItem)
    : [idAndTypeFromItem(data)]
  ).filter(isIdTypeTuple)

function extractIdsAndTypes(
  data: unknown,
  id?: string | string[] | null
): IdTypeTuple[] {
  const idTypes: IdTypeTuple[] = extractIdsAndTypeFromData(data).filter(Boolean)
  if (idTypes.length === 0 && id) {
    return Array.isArray(id)
      ? id.map((id) => (id ? [id, undefined] : undefined)).filter(isIdTypeTuple)
      : [[id, undefined]]
  } else {
    return idTypes
  }
}

export default async function sendDel(
  client: ReturnType<typeof createClient>,
  generateId: GenerateId,
  id: string | string[] | null | undefined,
  data: unknown
) {
  const idTypes = extractIdsAndTypes(data, id)
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
