import test from 'ava'
import sinon = require('sinon')
import { createClient } from 'redis'

import connect from '../connect'
import redisTransporter from '..'

// Tests

test('should delete data from redis service', async (t) => {
  const redisClient = {
    connect: async () => undefined,
    del: sinon.stub().resolves(2),
    quit: sinon.stub().resolves(),
    on: () => redisClient,
  }
  const createRedis = () => redisClient
  const transporter = {
    ...redisTransporter,
    connect: connect(createRedis as unknown as typeof createClient),
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

  const client = await transporter.connect(options, null, null)
  const ret = await transporter.send(action, client)
  await transporter.disconnect(client)

  t.is(ret.status, 'ok', ret.error)
  t.is(ret.data, null)
  t.deepEqual(redisClient.del.args[0][0], [
    'store:meta:ent1',
    'store:meta:ent2',
  ])
})
