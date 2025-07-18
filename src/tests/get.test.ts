import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@redis/client'
import transporter from '../index.js'

// Setup

const redisData1 = [
  'title',
  'Article 1',
  'description',
  'The first article',
  'publishedAt',
  '##null##',
  'author',
  JSON.stringify({ id: 'johnf', name: 'John F.' }),
]
const redisData2 = [
  'title',
  'Article 2',
  'description',
  'The second article',
  'publishedAt',
  '2023-11-18T09:14:44Z',
  'author',
  JSON.stringify({ id: 'lucyk', name: 'Lucy K.' }),
]
const redisData3 = [
  'title',
  'Article 3',
  'description',
  'The third article',
  'publishedAt',
  '##null##',
  'author',
  JSON.stringify({ id: 'johnf', name: 'John F.' }),
]

const emit = () => undefined

test('get', async (t) => {
  const redisClient = createClient()
  await redisClient.connect()

  t.before(async () => {
    await redisClient.hSet('store:article:art1', redisData1)
    await redisClient.hSet('store:article:art2', redisData2)
    await redisClient.hSet('store:article:art3', redisData3)
  })

  t.after(async () => {
    if (redisClient) {
      await redisClient.del('store:article:art1')
      await redisClient.del('store:article:art2')
      await redisClient.del('store:article:art3')
      await redisClient.quit()
    }
  })

  // Tests

  await t.test('should get data from redis service', async () => {
    const options = {
      prefix: 'store',
      redis: {
        uri: 'redis://localhost:6379',
      },
    }
    const action = {
      type: 'GET',
      payload: {
        type: 'article',
        id: 'art1',
      },
      meta: {
        options,
      },
    }
    const expectedData = {
      id: 'art1',
      title: 'Article 1',
      description: 'The first article',
      publishedAt: null,
      author: { id: 'johnf', name: 'John F.' },
    }

    const client = await transporter.connect(options, null, null, emit)
    const ret = await transporter.send(action, client)
    await transporter.disconnect(client)

    assert.equal(ret.status, 'ok')
    assert.deepEqual(ret.data, expectedData)
  })

  await t.test('should get data with several ids', async () => {
    const options = {
      prefix: 'store',
      redis: {
        uri: 'redis://localhost:6379',
      },
    }
    const action = {
      type: 'GET',
      payload: {
        type: 'article',
        id: ['art1', 'art3'],
      },
      meta: {
        options,
      },
    }

    const client = await transporter.connect(options, null, null, emit)
    const ret = await transporter.send(action, client)
    await transporter.disconnect(client)

    assert.equal(ret.status, 'ok')
    assert.ok(Array.isArray(ret.data))
    const data = ret.data as Record<string, string>[]
    assert.equal(data.length, 2)
    assert.equal(data[0].id, 'art1')
    assert.equal(data[1].id, 'art3')
  })

  await t.test('should get data with pattern', async () => {
    const options = {
      prefix: 'store',
      redis: {
        uri: 'redis://localhost:6379',
      },
    }
    const action = {
      type: 'GET',
      payload: {
        pattern: 'article',
      },
      meta: {
        options,
      },
    }
    const expectedItem0 = {
      id: 'article:art1', // We get the pattern as part of the id as we don't have a type
      title: 'Article 1',
      description: 'The first article',
      publishedAt: null,
      author: { id: 'johnf', name: 'John F.' },
    }

    const client = await transporter.connect(options, null, null, emit)
    const ret = await transporter.send(action, client)
    await transporter.disconnect(client)

    assert.equal(ret.status, 'ok')
    assert.ok(Array.isArray(ret.data))
    const data = ret.data as Record<string, string>[]
    assert.equal(data.length, 3)
    assert.deepEqual(data[0], expectedItem0)
    assert.equal(data[1].id, 'article:art2')
    assert.equal(data[2].id, 'article:art3')
  })

  await t.test('should get only ids with pattern', async () => {
    const options = {
      prefix: 'store',
      redis: {
        uri: 'redis://localhost:6379',
      },
    }
    const action = {
      type: 'GET',
      payload: {
        pattern: 'article',
        onlyIds: true,
      },
      meta: {
        options,
      },
    }

    const client = await transporter.connect(options, null, null, emit)
    const ret = await transporter.send(action, client)
    await transporter.disconnect(client)

    assert.equal(ret.status, 'ok')
    assert.ok(Array.isArray(ret.data))
    const data = ret.data as Record<string, string>[]
    assert.equal(data.length, 3)
    assert.deepEqual(data[0], { id: 'article:art1' })
    assert.deepEqual(data[1], { id: 'article:art2' })
    assert.deepEqual(data[2], { id: 'article:art3' })
  })
})
