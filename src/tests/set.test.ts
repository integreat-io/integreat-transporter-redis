import test from 'ava'
import sinon = require('sinon')

import connect from '../adapter/connect'
import resources from '..'

// Setup

const generateData = (count: number) => [...Array(count).keys()]
  .map((index: number) => ({
    id: `ent${index + 1}`,
    title: `Entry ${index + 1}`
  }))

// Tests

test('should set data to redis service', async (t) => {
  const redisClient = {
    hmset: sinon.stub().yieldsRight(null, 'OK'),
    quit: sinon.stub().yieldsRight(null)
  }
  const redis = {
    createClient: sinon.stub().returns(redisClient)
  }
  const adapter = {
    ...resources.adapters.redis,
    connect: connect(redis)
  }
  const data = {
    id: 'ent1',
    title: 'Entry 1',
    description: 'The first entry',
    author: { id: 'johnf', name: 'John F.' }
  }
  const request = {
    action: 'SET',
    endpoint: {
      prefix: 'store',
      redis: {
        uri: 'redis://localhost:6379'
      }
    },
    data,
    params: {
      type: 'meta',
      keys: ['title', 'description', 'author']
    }
  }
  const expectedData = [
    'title', 'Entry 1',
    'description', 'The first entry',
    'author', JSON.stringify({ id: 'johnf', name: 'John F.' })
  ]

  const serializedRequest = await adapter.serialize(request)
  const client = await adapter.connect(request.endpoint, null, null)
  const response = await adapter.send(serializedRequest, client)
  const ret = await adapter.normalize(response, request)
  await adapter.disconnect(client)

  t.is(ret.status, 'ok')
  t.is(ret.data, null)
  t.is(redisClient.hmset.args[0][0], 'store:ent1')
  t.deepEqual(redisClient.hmset.args[0][1], expectedData)
})

test('should set data array to redis service', async (t) => {
  const redisClient = {
    hmset: sinon.stub().yieldsRight(null, 'OK'),
    quit: sinon.stub().yieldsRight(null)
  }
  const adapter = {
    ...resources.adapters.redis,
    connect: connect({
      createClient: sinon.stub().returns(redisClient)
    })
  }
  const data = generateData(50)
  const request = {
    action: 'SET',
    endpoint: {
      prefix: 'store',
      redis: { uri: 'redis://localhost:6379' },
      concurrency: 5
    },
    data,
    params: { type: 'meta' }
  }

  const serializedRequest = await adapter.serialize(request)
  const client = await adapter.connect(request.endpoint, null, null)
  const response = await adapter.send(serializedRequest, client)
  const ret = await adapter.normalize(response, request)
  await adapter.disconnect(client)

  t.is(ret.status, 'ok')
  t.is(ret.data, null)
  t.is(redisClient.hmset.callCount, 50)
  t.is(redisClient.hmset.args[0][0], 'store:ent1')
  t.is(redisClient.hmset.args[49][0], 'store:ent50')
})
