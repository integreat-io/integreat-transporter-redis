import test from 'ava'
import sinon = require('sinon')
import redisLib = require('redis')

import connect from './connect'

// Setup

const client = {} as redisLib.RedisClient

// Tests

test('should return created redis client', async (t) => {
  const redis = {
    createClient: sinon.stub().returns(client)
  }
  const serviceOptions = { redis: { url: 'redis://localhost:6379' } }

  const ret = await connect(redis)(serviceOptions, null, null)

  t.is(ret, client)
  t.is(redis.createClient.callCount, 1)
  t.deepEqual(redis.createClient.args[0][0], { url: 'redis://localhost:6379' })
})

test('should return existing client when given', async (t) => {
  const redis = {
    createClient: sinon.stub().returns(client)
  }
  const serviceOptions = { redis: { url: 'redis://localhost:6379' } }

  const ret = await connect(redis)(serviceOptions, null, client)

  t.is(ret, client)
  t.is(redis.createClient.callCount, 0)
})

test('should return null when no redis options', async (t) => {
  const redis = {
    createClient: sinon.stub().returns({})
  }
  const serviceOptions = {}

  const ret = await connect(redis)(serviceOptions, null, null)

  t.is(ret, null)
  t.is(redis.createClient.callCount, 0)
})
