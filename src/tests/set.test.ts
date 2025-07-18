import test from 'node:test'
import assert from 'node:assert'
import { createClient } from '@redis/client'

import transporter from '../index.js'

// Setup

const emit = () => undefined

const generateData = (count: number) =>
  [...Array(count).keys()].map((index: number) => ({
    id: `ent${index + 1}`,
    title: `Entry ${index + 1}`,
  }))

test('set', async (t) => {
  const redisClient = createClient()
  await redisClient.connect()

  t.after(async () => {
    if (redisClient) {
      await redisClient.del('store:meta:ent1')
      for (let i = 1; i <= 50; i++) {
        await redisClient.del(`store:entry:ent${i}`)
      }
      await redisClient.quit()
    }
  })

  // Tests

  await t.test('should set data to redis service', async () => {
    const data = {
      id: 'ent1',
      title: 'Entry 1',
      description: 'The first entry',
      section: undefined,
      createdAt: new Date('2021-09-05T18:43:11Z'),
      publishedAt: null,
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
      },
      meta: { options },
    }
    const expectedData = {
      title: 'Entry 1',
      description: 'The first entry',
      createdAt: '2021-09-05T18:43:11.000Z',
      publishedAt: '##null##',
      author: JSON.stringify({ id: 'johnf', name: 'John F.' }),
    }

    const client = await transporter.connect(options, null, null, emit)
    const ret = await transporter.send(action, client)
    await transporter.disconnect(client)

    assert.equal(ret.status, 'ok')
    assert.equal(ret.data, null)
    const redisData = await redisClient.hGetAll('store:meta:ent1')
    assert.deepEqual(redisData, expectedData)
  })

  await t.test('should set data array to redis service', async () => {
    const options = {
      prefix: 'store',
      redis: { uri: 'redis://localhost:6379' },
      concurrency: 5,
    }
    const action = {
      type: 'SET',
      payload: {
        type: 'entry',
        data: generateData(50),
      },
      meta: { options },
    }

    const client = await transporter.connect(options, null, null, emit)
    const ret = await transporter.send(action, client)
    await transporter.disconnect(client)

    assert.equal(ret.status, 'ok')
    assert.equal(ret.data, null)
    const keys = await redisClient.keys('store:entry:*')
    assert.equal(keys.length, 50)
    assert.ok(keys.includes('store:entry:ent1'))
    assert.ok(keys.includes('store:entry:ent50'))
  })
})
