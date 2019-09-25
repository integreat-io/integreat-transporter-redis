import { promisify } from 'util'
import redisLib = require('redis')
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

const noIdError = (hasData: boolean) => (hasData)
  ? { status: 'error', error: 'Cannot set data with no id' }
  : { status: 'notfound', error: 'Cannot get data with no id' }

const sendGet = async (client: redisLib.RedisClient, id?: string, prefix?: string) => {
  if (!id) {
    return noIdError(false)
  }
  const hash = hashFromIdAndPrefix(id, prefix)
  const hgetall = promisify(client.hgetall).bind(client)

  try {
    const responseData = await hgetall(hash)
    return (responseData && Object.keys(responseData).length > 0)
      ? { status: 'ok', data: responseData }
      : { status: 'notfound', error: `Could not find hash '${hash}'` }
  } catch (error) {
    return createError(error, `Error from Redis while getting from hash '${hash}'.`)
  }
}

const itemToArray = (fields: SerializedData) => Object.entries(fields)
  .reduce((arr, [key, value]) => [ ...arr, key, value ], [] as string[])

const setItem = async (hmset: HMSet, item: SerializedData, prefix?: string): Promise<Response> => {
  const { id, ...fields } = item
  const hash = hashFromIdAndPrefix(id, prefix)

  try {
    await hmset(hash, itemToArray(fields))
    return { status: 'ok', data: null }
  } catch (error) {
    return createError(error, `Error from Redis while setting on hash '${hash}'.`)
  }
}

const sendSet = async (client: redisLib.RedisClient, data: SerializedData | SerializedData[], prefix?: string) => {
  const hmset: HMSet = promisify<string, string[], 'OK'>(client.hmset).bind(client)

  const results = await Promise.all(
    ([] as SerializedData[]).concat(data).map(item => setItem(hmset, item, prefix))
  )

  const errors = results.filter(result => result.status !== 'ok')
  if (errors.length === 0) {
    return { status: 'ok', data: null }
  } else {
    if (errors.length < results.length) {
      // Looks strange, but adds this message to the end of the error message
      errors.push({ status: 'ok', error: 'The rest succeeded' })
    }
    const error = errors.map(result => result.error).join(' | ')
    return { status: 'error', error }
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

  return (isData(data))
    ? sendSet(client, data, prefix)
    : sendGet(client, id, prefix)
}

export default send
