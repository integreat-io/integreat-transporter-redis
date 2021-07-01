import test from 'ava'
import sinon = require('sinon')
import redisLib = require('redis')

import connect from './connect'
import { Connection } from '.'

// Setup

interface Listener {
  (error: Error): void
}

const client = {
  on: () => client,
} as unknown as redisLib.RedisClient

// Tests

test('should return connection object with created redis client', async (t) => {
  const redis = {
    createClient: sinon.stub().returns(client),
  }
  const options = { redis: { url: 'redis://localhost:6379' } }

  const ret = await connect(redis)(options, null, null)

  t.is(ret?.status, 'ok')
  t.is(ret?.redisClient, client)
  t.is(ret?.expire, null)
  t.is(redis.createClient.callCount, 1)
  t.deepEqual(redis.createClient.args[0][0], { url: 'redis://localhost:6379' })
})

test('should set expire when an connectionTimeout interval is given', async (t) => {
  const redis = {
    createClient: sinon.stub().returns(client),
  }
  const options = {
    redis: { url: 'redis://localhost:6379' },
    connectionTimeout: 60000,
  }
  const expectedExpire = Date.now() + 60000

  const ret = await connect(redis)(options, null, null)

  t.is(ret?.status, 'ok')
  t.is(typeof ret?.expire, 'number')
  t.true((ret?.expire as number) >= expectedExpire)
  t.true((ret?.expire as number) < expectedExpire + 100) // Give it a few ms in case of delay
})

test('should return existing client when given', async (t) => {
  const redis = {
    createClient: sinon.stub().returns(client),
  }
  const options = { redis: { url: 'redis://localhost:6379' } }
  const connection = { status: 'ok', redisClient: client }

  const ret = await connect(redis)(options, null, connection)

  t.is(ret, connection)
  t.is(redis.createClient.callCount, 0)
})

test('should reconnect when a connection is missing client', async (t) => {
  const redis = {
    createClient: sinon.stub().returns(client),
  }
  const options = { redis: { url: 'redis://localhost:6379' } }
  const connection = { status: 'ok', redisClient: null }

  const ret = await connect(redis)(options, null, connection)

  t.is(ret?.status, 'ok')
  t.is(ret?.redisClient, client)
  t.is(redis.createClient.callCount, 1)
})

test('should reconnect when connection is expired', async (t) => {
  const clientWithQuit = {
    ...client,
    quit: sinon.stub().yieldsRight(null),
  }
  const redis = {
    createClient: sinon.stub().returns(client),
  }
  const options = { redis: { url: 'redis://localhost:6379' } }
  const connection = {
    status: 'ok',
    redisClient: clientWithQuit,
    expire: Date.now() - 1000,
  }

  const ret = await connect(redis)(
    options,
    null,
    connection as unknown as Connection
  )

  t.is(ret?.status, 'ok')
  t.is(ret?.redisClient, client)
  t.is(redis.createClient.callCount, 1)
  t.is(clientWithQuit.quit.callCount, 1)
})

test('should return error when no redis options', async (t) => {
  const redis = {
    createClient: sinon.stub().returns({}),
  }
  const options = {}
  const expectedConnection = {
    status: 'error',
    error: 'No redis options',
    redisClient: null,
  }

  const ret = await connect(redis)(options, null, null)

  t.deepEqual(ret, expectedConnection)
  t.is(redis.createClient.callCount, 0)
})

test('should disconnect on error', async (t) => {
  let errorListener: Listener | null = null
  const clientWithQuit = {
    ...client,
    on: (_eventName: string, listener: Listener) => {
      errorListener = listener
    },
    quit: sinon.stub().yieldsRight(null),
  }
  const redis = {
    createClient: sinon.stub().returns(clientWithQuit),
  }
  const options = { redis: { url: 'redis://localhost:6379' } }

  const ret = await connect(redis)(options, null, null)
  t.truthy(ret?.redisClient)
  t.is(typeof errorListener, 'function')
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  errorListener!(new Error('Failure'))

  t.is(clientWithQuit.quit.callCount, 1)
})
