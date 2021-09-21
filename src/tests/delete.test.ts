import test from 'ava'
import sinon = require('sinon')

import connect from '../connect'
import redisAdapter from '..'

// Tests

test('should delete data from redis service', async (t) => {
  const redisClient = {
    del: sinon.stub().yieldsRight(null, 2),
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
  const data = [
    {
      id: 'ent1',
      title: 'Entry 1',
    },
    {
      id: 'ent2',
      title: 'Entry 2',
    },
  ]
  const options = {
    prefix: 'store',
    redis: {
      uri: 'redis://localhost:6379',
    },
  }
  const action = {
    type: 'DELETE',
    payload: {
      type: 'meta',
      data,
    },
    meta: { options },
  }

  const client = await adapter.connect(options, null, null)
  const ret = await adapter.send(action, client)
  await adapter.disconnect(client)

  t.is(ret.status, 'ok', ret.error)
  t.is(ret.data, null)
  t.deepEqual(redisClient.del.args[0][0], [
    'store:meta:ent1',
    'store:meta:ent2',
  ])
})
