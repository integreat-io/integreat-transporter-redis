import test from 'ava'
import sinon = require('sinon')

import send from '../adapter/send'
import resources from '..'

// Tests

test('should set data to redis service', async (t) => {
  const redisClient = {
    hmset: sinon.stub().yieldsRight(null, 'OK')
  }
  const redis = {
    createClient: sinon.stub().returns(redisClient)
  }
  const adapter = {
    ...resources.adapters.redis,
    send: send(redis)
  }
  const data = {
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
      id: 'meta:entries',
      keys: ['title', 'description', 'author']
    }
  }
  const expectedData = [
    'title', 'Entry 1',
    'description', 'The first entry',
    'author', JSON.stringify({ id: 'johnf', name: 'John F.' })
  ]

  const serializedRequest = await adapter.serialize(request)
  const response = await adapter.send(serializedRequest)
  const ret = await adapter.normalize(response, request)

  t.is(ret.status, 'ok')
  t.is(ret.data, null)
  t.is(redisClient.hmset.args[0][0], 'store:meta:entries')
  t.deepEqual(redisClient.hmset.args[0][1], expectedData)
})
