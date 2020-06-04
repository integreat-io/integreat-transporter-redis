import test from 'ava'
import sinon = require('sinon')
import redisLib = require('redis')

import connect from './connect'

// Setup

interface Listener {
  (error: Error): void
}

const client = {
  on: () => client
} as unknown as redisLib.RedisClient

// Tests

test('should return connection object with created redis client', async (t) => {
  const redis = {
    createClient: sinon.stub().returns(client)
  }
  const serviceOptions = { redis: { url: 'redis://localhost:6379' } }

  const ret = await connect(redis)(serviceOptions, null, null)

  t.is(ret.status, 'ok')
  t.is(ret.redisClient, client)
  t.is(redis.createClient.callCount, 1)
  t.deepEqual(redis.createClient.args[0][0], { url: 'redis://localhost:6379' })
})

test('should return existing client when given', async (t) => {
  const redis = {
    createClient: sinon.stub().returns(client)
  }
  const serviceOptions = { redis: { url: 'redis://localhost:6379' } }
  const connection = { status: 'ok', redisClient: client }

  const ret = await connect(redis)(serviceOptions, null, connection)

  t.is(ret, connection)
  t.is(redis.createClient.callCount, 0)
})

test('should return error when no redis options', async (t) => {
  const redis = {
    createClient: sinon.stub().returns({})
  }
  const serviceOptions = {}
  const expectedConnection = { status: 'error', error: 'No redis options', redisClient: null }

  const ret = await connect(redis)(serviceOptions, null, null)

  t.deepEqual(ret, expectedConnection)
  t.is(redis.createClient.callCount, 0)
})

test('should disconnect on error', async (t) => {
  let errorListener: Listener | null = null
  const clientWithQuit = {
    ...client,
    on: (_eventName: string, listener: Listener) => { errorListener = listener },
    quit: sinon.stub().yieldsRight(null)
  }
  const redis = {
    createClient: sinon.stub().returns(clientWithQuit)
  }
  const serviceOptions = { redis: { url: 'redis://localhost:6379' } }

  const connection = await connect(redis)(serviceOptions, null, null)
  t.truthy(connection.redisClient)
  t.is(typeof errorListener, 'function')
  errorListener!(new Error('Failure'))

  t.is(clientWithQuit.quit.callCount, 1)
})
