import mapAny from 'map-any'
import sendGet from './get.js'
import sendSet from './set.js'
import sendDel from './delete.js'
import { generateId } from '../utils/ids.js'
import type { Action, Response } from 'integreat'
import type { Connection } from '../types.js'

const numberToString = (value: unknown) =>
  typeof value === 'number'
    ? String(value)
    : typeof value === 'string'
    ? value
    : undefined

const parseAction = ({ payload, meta: { options } = {} }: Action) => ({
  data: payload.data,
  id: mapAny(numberToString, payload.id),
  type: payload.type,
  pattern: typeof payload.pattern === 'string' ? payload.pattern : undefined,
  prefix: typeof options?.prefix === 'string' ? options?.prefix : undefined,
  concurrency:
    typeof options?.concurrency === 'number' ? options?.concurrency : undefined,
  useTypeAsPrefix: options?.useTypeAsPrefix === false ? false : true,
})

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
  const { data, id, type, pattern, prefix, concurrency, useTypeAsPrefix } =
    parseAction(action)
  const client = connection.redisClient
  const generateIdFn = generateId(prefix, type, useTypeAsPrefix)

  switch (action.type) {
    case 'GET':
      return sendGet(client, generateIdFn, id, pattern, concurrency)
    case 'SET':
      return sendSet(client, generateIdFn, id, data, concurrency)
    case 'DELETE':
      return sendDel(client, generateIdFn, id, data)
    default:
      return { status: 'badrequest', error: `Unknown action '${action.type}'` }
  }
}
