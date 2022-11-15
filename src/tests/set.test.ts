import test from 'ava'
import sinon = require('sinon')
import { createClient } from 'redis'

import connect from '../connect'
import redisTransporter from '..'

// Setup

const generateData = (count: number) =>
  [...Array(count).keys()].map((index: number) => ({
    id: `ent${index + 1}`,
    title: `Entry ${index + 1}`,
  }))

// Tests

test('should set data to redis service', async (t) => {
  const redisClient = {
    connect: async () => undefined,
    hSet: sinon.stub().resolves('OK'),
    quit: sinon.stub().resolves(),
    on: () => redisClient,
  }
  const createRedis = () => redisClient
  const transporter = {
    ...redisTransporter,
    connect: connect(createRedis as unknown as typeof createClient),
  }
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
      params: {
        keys: [
          'title',
          'description',
          'author',
          'section',
          'createdAt',
          'publishedAt',
        ],
      },
    },
    meta: { options },
  }
  const expectedData = [
    'title',
    'Entry 1',
    'description',
    'The first entry',
    'createdAt',
    '2021-09-05T18:43:11.000Z',
    'publishedAt',
    '##null##',
    'author',
    JSON.stringify({ id: 'johnf', name: 'John F.' }),
  ]

  const client = await transporter.connect(options, null, null)
  const ret = await transporter.send(action, client)
  await transporter.disconnect(client)

  t.is(ret.status, 'ok')
  t.is(ret.data, null)
  t.is(redisClient.hSet.args[0][0], 'store:meta:ent1')
  t.deepEqual(redisClient.hSet.args[0][1], expectedData)
})

test('should set data array to redis service', async (t) => {
  const redisClient = {
    connect: async () => undefined,
    hSet: sinon.stub().resolves('OK'),
    quit: sinon.stub().resolves(),
    on: () => redisClient,
  }
  const transporter = {
    ...redisTransporter,
    connect: connect((() => redisClient) as unknown as typeof createClient),
  }
  const options = {
    prefix: 'store',
    redis: { uri: 'redis://localhost:6379' },
    concurrency: 5,
  }
  const action = {
    type: 'SET',
    payload: {
      type: 'meta',
      data: generateData(50),
    },
    meta: { options },
  }

  const client = await transporter.connect(options, null, null)
  const ret = await transporter.send(action, client)
  await transporter.disconnect(client)

  t.is(ret.status, 'ok')
  t.is(ret.data, null)
  t.is(redisClient.hSet.callCount, 50)
  t.is(redisClient.hSet.args[0][0], 'store:meta:ent1')
  t.is(redisClient.hSet.args[49][0], 'store:meta:ent50')
})
