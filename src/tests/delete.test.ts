import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@redis/client'

import transporter from '../index.js'

// Setup

const redisData2 = ['title', 'Entry 2', 'description', 'The second entry']
const redisData3 = ['title', 'Entry 3', 'description', 'The third entry']

const emit = () => undefined

test('delete', async (t) => {
  const redisClient = createClient()
  await redisClient.connect()

  t.before(async () => {
    await redisClient.hSet('store:meta:ent2', redisData2)
    await redisClient.hSet('store:meta:ent3', redisData3)
  })

  t.after(async () => {
    if (redisClient) {
      await redisClient.del('store:meta:ent2') // In case it was not deleted
      await redisClient.del('store:meta:ent3') // In case it was not deleted
      await redisClient.quit()
    }
  })

  // Tests

  await t.test('should delete data from redis service', async () => {
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

    assert.equal(ret.status, 'ok', ret.error)
    assert.equal(ret.data, null)
    const keysCount = await redisClient.exists([
      'store:meta:ent2',
      'store:meta:ent3',
    ])
    assert.equal(keysCount, 0)
  })
})
