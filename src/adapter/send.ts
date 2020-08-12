import { promisify } from 'util'
import redisLib = require('redis')
import pLimit = require('p-limit')
const debug = require('debug')('great:adapter:redis')
import { Request, Response, SerializedData, Connection } from '.'

interface HMSet {
  (hash: string, fields: string[]): Promise<string>
}

const hashFromIdAndPrefix = (id: string, prefix?: string) =>
  (typeof prefix === 'string' && prefix !== '') ? `${prefix}:${id}` : id

const createError = (error: Error, message: string) => ({
  status: 'error',
  error: `${message} ${error.message}`
})

const sendGet = async (client: redisLib.RedisClient, id?: string, prefix?: string) => {
  if (!id) {
    return { status: 'notfound', error: 'Cannot get data with no id' }
  }
  const hash = hashFromIdAndPrefix(id, prefix)
  const hgetall = promisify(client.hgetall).bind(client)

  debug('Get from redis id \'%s\', hash \'%s\'.', id, hash)
  try {
    const responseData = await hgetall(hash)
    debug('Redis get with hash \'%s\' returned %o', hash, responseData)
    return (responseData && Object.keys(responseData).length > 0)
      ? { status: 'ok', data: responseData }
      : { status: 'notfound', error: `Could not find hash '${hash}'` }
  } catch (error) {
    debug('Redis get with hash \'%s\' failed: %s', hash, error)
    return createError(error, `Error from Redis while getting from hash '${hash}'.`)
  }
}

const itemToArray = (fields: SerializedData) => Object.entries(fields)
  .reduce((arr, [key, value]) => [ ...arr, key, value ], [] as string[])

const setItem = async (hmset: HMSet, item: SerializedData, id?: string | null, prefix?: string): Promise<Response> => {
  const { id: itemId, ...fields } = item
  id = itemId || id
  if (typeof id !== 'string') {
    return { status: 'badrequest', error: 'Cannot set data with no id' }
  }
  const hash = hashFromIdAndPrefix(id, prefix)

  debug('Set to redis id \'%s\', hash \'%s\': %o', id, hash, fields)
  try {
    const ret = await hmset(hash, itemToArray(fields))
    debug('Redis set with hash \'%s\' returned %o', hash, ret)
    return { status: 'ok', data: null }
  } catch (error) {
    debug('Redis set with hash \'%s\' failed: %s', hash, error)
    return createError(error, `Error from Redis while setting on hash '${hash}'.`)
  }
}

const sendSet = async (
  client: redisLib.RedisClient,
  id: string | null | undefined,
  data: SerializedData | SerializedData[],
  prefix?: string,
  concurrency = 1
) => {
  const hmset: HMSet = promisify<string, string[], 'OK'>(client.hmset).bind(client)

  // Sets max concurrency on promises called with `limit()`
  const limit = pLimit(concurrency)

  const results = await Promise.all(
    ([] as SerializedData[]).concat(data)
      .map(item => limit(() => setItem(hmset, item, id, prefix)))
  )

  const errors = results.filter(result => result.status !== 'ok')
  if (errors.length === 0) {
    // No error — great!
    return { status: 'ok', data: null }
  } else if (results.length === 1) {
    // One result — return error as is
    return errors[0]
  } else {
    const error = errors.map(result => result.error).join(' | ')
    const rest = (errors.length < results.length) ? ' | The rest succeeded' : ''
    return { status: 'error', error: `${error}${rest}` }
  }
}

const isData = (data: any): data is SerializedData => (typeof data === 'object' && data !== null)

const send = async (request: Request, connection: Connection | null): Promise<Response> => {
  if (!connection || connection.status !== 'ok' || !connection.redisClient) {
    return { status: 'error', error: 'No redis client given to redis adapter\'s send method' }
  }
  const { endpoint, data, params } = request

  const id = params && params.id
  const prefix = endpoint && endpoint.prefix
  const client = connection.redisClient
  const concurrency = endpoint && endpoint.concurrency

  return (isData(data))
    ? sendSet(client, id, data, prefix, concurrency)
    : sendGet(client, id, prefix)
}

export default send
