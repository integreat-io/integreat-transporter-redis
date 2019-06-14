import test from 'ava'
import sinon = require('sinon')

import connect from '../adapter/connect'
import resources from '..'

// Tests

test('should get data from redis service', async (t) => {
  const redisData = {
    title: 'Entry 1',
    description: 'The first entry',
    author: JSON.stringify({ id: 'johnf', name: 'John F.' })
  }
  const redisClient = {
    hgetall: sinon.stub().yieldsRight(null, redisData),
    quit: sinon.stub().yieldsRight(null)
  }
  const redis = {
    createClient: sinon.stub().returns(redisClient)
  }
  const adapter = {
    ...resources.adapters.redis,
    connect: connect(redis)
  }
  const request = {
    action: 'GET',
    endpoint: {
      prefix: 'store',
      redis: {
        uri: 'redis://localhost:6379'
      }
    },
    params: {
      type: 'meta',
      id: 'meta:entries',
      keys: ['title', 'description', 'author']
    }
  }
  const expectedData = {
    title: 'Entry 1',
    description: 'The first entry',
    author: { id: 'johnf', name: 'John F.' }
  }

  const client = await adapter.connect(request.endpoint, null, null)
  const response = await adapter.send(request, client)
  const ret = await adapter.normalize(response, request)
  await adapter.disconnect(client)

  t.is(ret.status, 'ok')
  t.deepEqual(ret.data, expectedData)
  t.is(redisClient.hgetall.args[0][0], 'store:meta:entries')
})
