import ava, { TestFn } from 'ava'
import { createClient } from '@redis/client'

import transporter from '../index.js'

interface RedisContext {
  redisClient: ReturnType<typeof createClient>
}

// Setup

const test = ava as TestFn<RedisContext>

const redisData2 = ['title', 'Entry 2', 'description', 'The second entry']
const redisData3 = ['title', 'Entry 3', 'description', 'The third entry']

test.before(async (t) => {
  const redisClient = createClient()
  await redisClient.connect()
  await redisClient.hSet('store:meta:ent2', redisData2)
  await redisClient.hSet('store:meta:ent3', redisData3)
  t.context = { redisClient }
})

test.after.always(async (t) => {
  const { redisClient } = t.context
  if (redisClient) {
    await redisClient.del('store:meta:ent2') // In case it was not deleted
    await redisClient.del('store:meta:ent3') // In case it was not deleted
    await redisClient.quit()
  }
})

const emit = () => undefined

// Tests

test('should delete data from redis service', async (t) => {
  const { redisClient } = t.context
  const data = [
    {
      id: 'ent2',
      title: 'Entry 2',
    },
    {
      id: 'ent3',
      title: 'Entry 3',
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

  const client = await transporter.connect(options, null, null, emit)
  const ret = await transporter.send(action, client)
  await transporter.disconnect(client)

  t.is(ret.status, 'ok', ret.error)
  t.is(ret.data, null)
  const keysCount = await redisClient.exists([
    'store:meta:ent2',
    'store:meta:ent3',
  ])
  t.is(keysCount, 0)
})
