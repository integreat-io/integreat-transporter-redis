import test from 'ava'
import sinon = require('sinon')

import connect from '../connect'
import redisAdapter from '..'

// Setup

const generateData = (count: number) =>
  [...Array(count).keys()].map((index: number) => ({
    id: `ent${index + 1}`,
    title: `Entry ${index + 1}`,
  }))

// Tests

test('should set data to redis service', async (t) => {
  const redisClient = {
    hmset: sinon.stub().yieldsRight(null, 'OK'),
    quit: sinon.stub().yieldsRight(null),
    on: () => redisClient,
  }
  const redis = {
    createClient: sinon.stub().returns(redisClient),
  }
  const adapter = {
    ...redisAdapter,
    connect: connect(redis),
  }
  const data = {
    id: 'ent1',
    title: 'Entry 1',
    description: 'The first entry',
    author: { id: 'johnf', name: 'John F.' },
  }
  const options = {
    prefix: 'store',
    redis: {
      uri: 'redis://localhost:6379',
    },
  }
  const action = {
    type: 'SET',
    payload: {
      type: 'meta',
      data,
      params: {
        keys: ['title', 'description', 'author'],
      },
    },
    meta: { options },
  }
  const expectedData = [
    'title',
    'Entry 1',
    'description',
    'The first entry',
    'author',
    JSON.stringify({ id: 'johnf', name: 'John F.' }),
  ]

  const client = await adapter.connect(options, null, null)
  const ret = await adapter.send(action, client)
  await adapter.disconnect(client)

  t.is(ret.status, 'ok')
  t.is(ret.data, null)
  t.is(redisClient.hmset.args[0][0], 'store:meta:ent1')
  t.deepEqual(redisClient.hmset.args[0][1], expectedData)
})

test('should set data array to redis service', async (t) => {
  const redisClient = {
    hmset: sinon.stub().yieldsRight(null, 'OK'),
    quit: sinon.stub().yieldsRight(null),
    on: () => redisClient,
  }
  const adapter = {
    ...redisAdapter,
    connect: connect({
      createClient: sinon.stub().returns(redisClient),
    }),
  }
  const options = {
    prefix: 'store',
    redis: { uri: 'redis://localhost:6379' },
    concurrency: 5,
  }
  const action = {
    type: 'SET',
    payload: {
      type: 'meta',
      data: generateData(50),
    },
    meta: { options },
  }

  const client = await adapter.connect(options, null, null)
  const ret = await adapter.send(action, client)
  await adapter.disconnect(client)

  t.is(ret.status, 'ok')
  t.is(ret.data, null)
  t.is(redisClient.hmset.callCount, 50)
  t.is(redisClient.hmset.args[0][0], 'store:meta:ent1')
  t.is(redisClient.hmset.args[49][0], 'store:meta:ent50')
})
