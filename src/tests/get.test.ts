import test from 'ava'
import sinon from 'sinon'
import { createClient } from 'redis'

import connect from '../connect.js'
import redisTransporter from '../index.js'

// Tests

test('should get data from redis service', async (t) => {
  const redisData = {
    title: 'Entry 1',
    description: 'The first entry',
    publishedAt: '##null##',
    author: JSON.stringify({ id: 'johnf', name: 'John F.' }),
  }
  const redisClient = {
    connect: async () => undefined,
    hGetAll: sinon.stub().resolves(redisData),
    quit: sinon.stub().resolves(),
    on: () => redisClient,
  }
  const createRedis = () => redisClient
  const transporter = {
    ...redisTransporter,
    connect: connect(createRedis as unknown as typeof createClient),
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

  const client = await transporter.connect(options, null, null)
  const ret = await transporter.send(action, client)
  await transporter.disconnect(client)

  t.is(ret.status, 'ok')
  t.deepEqual(ret.data, expectedData)
  t.is(redisClient.hGetAll.args[0][0], 'store:meta:entries')
})
