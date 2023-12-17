import ava, { TestFn } from 'ava'
import { createClient } from 'redis'

import transporter from '../index.js'

interface RedisContext {
  redisClient: ReturnType<typeof createClient>
}

// Setup

const test = ava as TestFn<RedisContext>

const redisData = [
  'title',
  'Entry 1',
  'description',
  'The first entry',
  'publishedAt',
  '##null##',
  'author',
  JSON.stringify({ id: 'johnf', name: 'John F.' }),
]

test.before(async (t) => {
  const redisClient = createClient()
  await redisClient.connect()
  await redisClient.hSet('store:meta:entries', redisData)
  t.context = { redisClient }
})

test.after.always(async (t) => {
  const { redisClient } = t.context
  if (redisClient) {
    await redisClient.del('store:meta:entries')
    await redisClient.quit()
  }
})

const emit = () => undefined

// Tests

test('should get data from redis service', async (t) => {
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

  const client = await transporter.connect(options, null, null, emit)
  const ret = await transporter.send(action, client)
  await transporter.disconnect(client)

  t.is(ret.status, 'ok')
  t.deepEqual(ret.data, expectedData)
})
