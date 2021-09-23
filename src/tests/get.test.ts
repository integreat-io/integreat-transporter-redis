import test from 'ava'
import sinon = require('sinon')

import connect from '../connect'
import redisAdapter from '..'

// Tests

test('should get data from redis service', async (t) => {
  const redisData = {
    title: 'Entry 1',
    description: 'The first entry',
    publishedAt: '##null##',
    author: JSON.stringify({ id: 'johnf', name: 'John F.' }),
  }
  const redisClient = {
    hgetall: sinon.stub().yieldsRight(null, redisData),
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
  const options = {
    prefix: 'store',
    redis: {
      uri: 'redis://localhost:6379',
    },
  }
  const action = {
    type: 'GET',
    payload: {
      type: 'meta',
      id: 'entries',
      params: {
        keys: ['title', 'description', 'publishedAt', 'author'],
      },
    },
    meta: {
      options,
    },
  }
  const expectedData = {
    id: 'entries',
    title: 'Entry 1',
    description: 'The first entry',
    publishedAt: null,
    author: { id: 'johnf', name: 'John F.' },
  }

  const client = await adapter.connect(options, null, null)
  const ret = await adapter.send(action, client)
  await adapter.disconnect(client)

  t.is(ret.status, 'ok')
  t.deepEqual(ret.data, expectedData)
  t.is(redisClient.hgetall.args[0][0], 'store:meta:entries')
})
