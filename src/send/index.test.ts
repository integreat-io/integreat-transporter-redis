import test from 'ava'
import sinon from 'sinon'
import type { Connection } from '../types.js'

import send from './index.js'

// Setup

const redisOptions = {
  uri: 'redis://localhost:6379',
}

const wrapInConnection = (redisClient: unknown) =>
  ({
    status: 'ok',
    redisClient,
  }) as Connection

// Tests -- GET

test('should GET from redis', async (t) => {
  const redisData = [
    {
      title: 'Entry 1',
      description: 'The first entry',
      author: JSON.stringify({ id: 'johnf', name: 'John F.' }),
      updateCount: '3',
      draft: 'false',
      missing: '',
      nil: '##null##',
      createdAt: '2019-01-31T18:43:11.000Z',
    },
  ]
  const redisClient = {
    hGetAll: sinon.stub().resolves(redisData),
  }
  const action = {
    type: 'GET',
    payload: {
      type: 'meta',
      id: 'ent1',
    },
    meta: {
      options: { redis: redisOptions },
    },
  }
  const expected = {
    status: 'ok',
    data: [
      {
        id: 'ent1',
        title: 'Entry 1',
        description: 'The first entry',
        author: { id: 'johnf', name: 'John F.' },
        updateCount: 3,
        draft: false,
        missing: '',
        nil: null,
        createdAt: '2019-01-31T18:43:11.000Z',
      },
    ],
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
  t.is(redisClient.hGetAll.callCount, 1)
  t.deepEqual(redisClient.hGetAll.args[0][0], 'meta:ent1')
})

test('should GET several ids from redis', async (t) => {
  const redisData0 = [{ title: 'Entry 1' }]
  const redisData1 = [{ title: 'Entry 2' }]
  const redisClient = {
    hGetAll: sinon
      .stub()
      .resolves([])
      .onCall(0)
      .resolves(redisData0)
      .onCall(1)
      .resolves(redisData1),
  }
  const action = {
    type: 'GET',
    payload: {
      type: 'meta',
      id: ['entries', 'users'],
    },
    meta: {
      options: { redis: redisOptions },
    },
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.is(ret.status, 'ok', ret.error)
  t.is(redisClient.hGetAll.callCount, 2)
  t.deepEqual(redisClient.hGetAll.args[0][0], 'meta:entries')
  t.deepEqual(redisClient.hGetAll.args[1][0], 'meta:users')
  const data = ret.data as { title: string }[]
  t.is(data.length, 2)
  t.is(data[0].title, 'Entry 1')
  t.is(data[1].title, 'Entry 2')
})

test('should GET from redis with numeric id', async (t) => {
  const redisData = [
    {
      title: 'Entry 1',
      description: 'The first entry',
    },
  ]
  const redisClient = {
    hGetAll: sinon.stub().resolves(redisData),
  }
  const action = {
    type: 'GET',
    payload: {
      type: 'meta',
      id: 12345, // Numeric id
    },
    meta: {
      options: { redis: redisOptions },
    },
  }
  const expected = {
    status: 'ok',
    data: [
      {
        id: '12345',
        title: 'Entry 1',
        description: 'The first entry',
      },
    ],
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ret = await send(action as any, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
  t.is(redisClient.hGetAll.callCount, 1)
  t.deepEqual(redisClient.hGetAll.args[0][0], 'meta:12345')
})

test('should GET collection from redis', async (t) => {
  const redisData0 = [{ title: 'Entry 1' }]
  const redisData1 = [{ title: 'Entry 2' }]
  const redisClient = {
    hGetAll: sinon
      .stub()
      .resolves([])
      .onCall(0)
      .resolves(redisData0)
      .onCall(1)
      .resolves(redisData1),
    keys: sinon.stub().resolves(['meta:entries', 'meta:users']),
  }
  const action = {
    type: 'GET',
    payload: {
      type: 'meta',
      // No id => collection
    },
    meta: {
      options: { redis: redisOptions },
    },
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.is(ret.status, 'ok', ret.error)
  t.is(redisClient.keys.callCount, 1)
  t.is(redisClient.keys.args[0][0], 'meta:*')
  t.is(redisClient.hGetAll.callCount, 2)
  t.is(redisClient.hGetAll.args[0][0], 'meta:entries')
  t.is(redisClient.hGetAll.args[1][0], 'meta:users')
  const data = ret.data as { id: string; title: string }[]
  t.is(data.length, 2)
  t.is(data[0].id, 'entries')
  t.is(data[0].title, 'Entry 1')
  t.is(data[1].id, 'users')
  t.is(data[1].title, 'Entry 2')
})

test('should GET collection from redis with keys sorted alphabetically', async (t) => {
  const redisClient = {
    hGetAll: sinon
      .stub()
      .resolves([])
      .onCall(0)
      .resolves([{ title: 'Entry 1' }])
      .onCall(1)
      .resolves([{ title: 'Entry 2' }]),
    keys: sinon.stub().resolves(['meta:users', 'meta:entries']),
  }
  const action = {
    type: 'GET',
    payload: {
      type: 'meta',
      // No id => collection
    },
    meta: {
      options: { redis: redisOptions },
    },
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.is(ret.status, 'ok', ret.error)
  t.is(redisClient.keys.callCount, 1)
  t.is(redisClient.hGetAll.callCount, 2)
  const data = ret.data as { id: string; title: string }[]
  t.is(data[0].id, 'entries')
  t.is(data[1].id, 'users')
})

test('should GET collection from redis with prefix as wildcard', async (t) => {
  const redisData0 = [{ title: 'Entry 1' }]
  const redisData1 = [{ title: 'Entry 2' }]
  const redisClient = {
    hGetAll: sinon
      .stub()
      .resolves([])
      .onCall(0)
      .resolves(redisData0)
      .onCall(1)
      .resolves(redisData1),
    keys: sinon.stub().resolves(['store:meta:entries', 'store:meta:users']),
  }
  const action = {
    type: 'GET',
    payload: {
      type: 'meta',
      // No id => collection
    },
    meta: {
      options: { prefix: 'store', redis: redisOptions },
    },
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.is(ret.status, 'ok', ret.error)
  t.is(redisClient.keys.callCount, 1)
  t.is(redisClient.keys.args[0][0], 'store:meta:*')
  t.is(redisClient.hGetAll.callCount, 2)
  t.is(redisClient.hGetAll.args[0][0], 'store:meta:entries')
  t.is(redisClient.hGetAll.args[1][0], 'store:meta:users')
  const data = ret.data as { id: string; title: string }[]
  t.is(data.length, 2)
  t.is(data[0].id, 'entries')
  t.is(data[0].title, 'Entry 1')
  t.is(data[1].id, 'users')
  t.is(data[1].title, 'Entry 2')
})

test('should GET collection from redis with provided pattern', async (t) => {
  const redisData0 = [{ title: 'Entry 1' }]
  const redisData1 = [{ title: 'Entry 2' }]
  const redisClient = {
    hGetAll: sinon
      .stub()
      .resolves([])
      .onCall(0)
      .resolves(redisData0)
      .onCall(1)
      .resolves(redisData1),
    keys: sinon
      .stub()
      .resolves(['store:meta:entry:ent1', 'store:meta:entry:ent2']),
  }
  const action = {
    type: 'GET',
    payload: {
      type: 'meta',
      pattern: 'entry',
    },
    meta: {
      options: { prefix: 'store', redis: redisOptions },
    },
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.is(ret.status, 'ok', ret.error)
  t.is(redisClient.keys.callCount, 1)
  t.is(redisClient.keys.args[0][0], 'store:meta:entry:*')
  t.is(redisClient.hGetAll.callCount, 2)
  t.is(redisClient.hGetAll.args[0][0], 'store:meta:entry:ent1')
  t.is(redisClient.hGetAll.args[1][0], 'store:meta:entry:ent2')
  const data = ret.data as { id: string; title: string }[]
  t.is(data.length, 2)
  t.is(data[0].id, 'entry:ent1')
  t.is(data[0].title, 'Entry 1')
  t.is(data[1].id, 'entry:ent2')
  t.is(data[1].title, 'Entry 2')
})

test('should GET collection with only ids from redis with provided pattern', async (t) => {
  const redisClient = {
    hGetAll: sinon.stub().resolves([]),
    keys: sinon
      .stub()
      .resolves(['store:meta:entry:ent1', 'store:meta:entry:ent2']),
  }
  const action = {
    type: 'GET',
    payload: {
      type: 'meta',
      pattern: 'entry',
      onlyIds: true,
    },
    meta: {
      options: { prefix: 'store', redis: redisOptions },
    },
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.is(ret.status, 'ok', ret.error)
  t.is(redisClient.keys.callCount, 1)
  t.is(redisClient.keys.args[0][0], 'store:meta:entry:*')
  t.is(redisClient.hGetAll.callCount, 0)
  const data = ret.data as { id: string; title: string }[]
  t.is(data.length, 2)
  t.deepEqual(data[0], { id: 'entry:ent1' })
  t.deepEqual(data[1], { id: 'entry:ent2' })
})

test('should return empty error when GET collection yields no ids from redis', async (t) => {
  const redisClient = {
    hGetAll: sinon.stub().resolves(null),
    keys: sinon.stub().resolves([]),
  }
  const action = {
    type: 'GET',
    payload: {
      type: 'meta',
      // No id => collection
    },
    meta: {
      options: { redis: redisOptions },
    },
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.is(ret.status, 'ok', ret.error)
  t.is(redisClient.keys.callCount, 1)
  t.is(redisClient.keys.args[0][0], 'meta:*')
  t.is(redisClient.hGetAll.callCount, 0)
  t.deepEqual(ret.data, [])
})

test('should prepend prefix to redis hash', async (t) => {
  const redisData = {
    title: 'Entry 1',
    description: 'The first entry',
  }
  const redisClient = {
    hGetAll: sinon.stub().resolves(redisData),
  }
  const action = {
    type: 'GET',
    payload: {
      type: 'meta',
      id: 'entries',
    },
    meta: {
      options: {
        prefix: 'store',
        redis: redisOptions,
      },
    },
  }

  await send(action, wrapInConnection(redisClient))

  t.deepEqual(redisClient.hGetAll.args[0][0], 'store:meta:entries')
})

test('should prepend only prefix to redis hash when useTypeAsPrefix is false', async (t) => {
  const redisData = {
    title: 'Entry 1',
    description: 'The first entry',
  }
  const redisClient = {
    hGetAll: sinon.stub().resolves(redisData),
  }
  const action = {
    type: 'GET',
    payload: {
      type: 'meta',
      id: 'entries',
    },
    meta: {
      options: {
        prefix: 'store',
        redis: redisOptions,
        useTypeAsPrefix: false,
      },
    },
  }

  await send(action, wrapInConnection(redisClient))

  t.deepEqual(redisClient.hGetAll.args[0][0], 'store:entries')
})

test('should return not found for GET on empty data', async (t) => {
  const redisData = {}
  const redisClient = {
    hGetAll: sinon.stub().resolves(redisData),
  }
  const action = {
    type: 'GET',
    payload: {
      type: 'meta',
      id: 'entries',
    },
    meta: {
      options: {
        redis: redisOptions,
      },
    },
  }
  const expected = {
    status: 'notfound',
    error: "Could not find hash 'meta:entries'",
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
})

test('should return undefined for ids that return no data from redis', async (t) => {
  const redisData1 = [{ title: 'Entry 2' }]
  const redisClient = {
    hGetAll: sinon
      .stub()
      .resolves([])
      .onCall(0)
      .resolves(null)
      .onCall(1)
      .resolves(redisData1),
  }
  const action = {
    type: 'GET',
    payload: {
      type: 'meta',
      id: ['entries', 'users'],
    },
    meta: {
      options: { redis: redisOptions },
    },
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.is(ret.status, 'ok', ret.error)
  t.is(redisClient.hGetAll.callCount, 2)
  const data = ret.data as ({ title: string } | undefined)[]
  t.is(data.length, 2)
  t.is(data[0], undefined)
  t.is(data[1]?.title, 'Entry 2')
})

test('should return notfound when no ids return data from redis', async (t) => {
  const redisClient = {
    hGetAll: sinon.stub().resolves(null),
  }
  const action = {
    type: 'GET',
    payload: {
      type: 'meta',
      id: ['entries', 'users'],
    },
    meta: {
      options: { redis: redisOptions },
    },
  }
  const expected = {
    status: 'notfound',
    error:
      "Cannot get data. Could not find hash 'meta:entries' | Could not find hash 'meta:users'",
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
  t.is(redisClient.hGetAll.callCount, 2)
  t.is(ret.data, undefined)
})

// Tests -- SET

test('should SET to redis', async (t) => {
  const redisClient = {
    hSet: sinon.stub().resolves('OK'),
  }
  const action = {
    type: 'SET',
    payload: {
      type: 'meta',
      data: {
        id: 'ent1',
        title: 'Entry 1',
        description: 'The first entry',
        author: { id: 'johnf', name: 'John F.' },
        updateCount: 3,
        draft: false,
        missing: undefined,
        nil: null,
        createdAt: new Date('2019-01-31T18:43:11Z'),
      },
    },
    meta: {
      options: {
        prefix: 'store',
        redis: redisOptions,
      },
    },
  }
  const expected = {
    status: 'ok',
    data: null,
  }
  const expectedArgs = [
    'title',
    'Entry 1',
    'description',
    'The first entry',
    'author',
    JSON.stringify({ id: 'johnf', name: 'John F.' }),
    'updateCount',
    '3',
    'draft',
    'false',
    'nil',
    '##null##',
    'createdAt',
    '2019-01-31T18:43:11.000Z',
  ]

  const ret = await send(action, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
  t.is(redisClient.hSet.callCount, 1)
  t.deepEqual(redisClient.hSet.args[0][0], 'store:meta:ent1')
  t.deepEqual(redisClient.hSet.args[0][1], expectedArgs)
})

test('should return badrequest for SET with no id', async (t) => {
  const redisClient = {
    hSet: sinon.stub().resolves('OK'),
  }
  const action = {
    type: 'SET',
    payload: {
      type: 'meta',
      data: {
        title: 'Entry 1',
        description: 'The first entry',
      },
    },
    meta: {
      options: {
        prefix: 'store',
        redis: redisOptions,
      },
    },
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.is(ret.status, 'badrequest')
  t.is(redisClient.hSet.callCount, 0)
})

test('should SET several items to redis', async (t) => {
  const redisClient = {
    hSet: sinon.stub().resolves('OK'),
  }
  const action = {
    type: 'SET',
    payload: {
      type: 'meta',
      data: [
        {
          id: 'ent1',
          title: 'Entry 1',
          description: 'The first entry',
        },
        {
          id: 'ent2',
          title: 'Entry 2',
          description: 'The second entry',
        },
      ],
    },
    meta: {
      options: {
        prefix: 'store',
        redis: redisOptions,
        concurrency: 10,
      },
    },
  }
  const expected = {
    status: 'ok',
    data: null,
  }
  const expectedArgs1 = ['title', 'Entry 1', 'description', 'The first entry']
  const expectedArgs2 = ['title', 'Entry 2', 'description', 'The second entry']

  const ret = await send(action, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
  t.is(redisClient.hSet.callCount, 2)
  t.deepEqual(redisClient.hSet.args[0][0], 'store:meta:ent1')
  t.deepEqual(redisClient.hSet.args[0][1], expectedArgs1)
  t.deepEqual(redisClient.hSet.args[1][0], 'store:meta:ent2')
  t.deepEqual(redisClient.hSet.args[1][1], expectedArgs2)
})

test('should SET to redis with id from params', async (t) => {
  const redisClient = {
    hSet: sinon.stub().resolves('OK'),
  }
  const action = {
    type: 'SET',
    payload: {
      type: 'meta',
      id: 'ent1',
      data: {
        title: 'Entry 1',
        description: 'The first entry',
      },
    },
    meta: {
      options: {
        prefix: 'store',
        redis: redisOptions,
      },
    },
  }
  const expected = {
    status: 'ok',
    data: null,
  }
  const expectedArgs = ['title', 'Entry 1', 'description', 'The first entry']

  const ret = await send(action, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
  t.is(redisClient.hSet.callCount, 1)
  t.deepEqual(redisClient.hSet.args[0][0], 'store:meta:ent1')
  t.deepEqual(redisClient.hSet.args[0][1], expectedArgs)
})

test('should SET with type from data when set', async (t) => {
  const redisClient = {
    hSet: sinon.stub().resolves('OK'),
  }
  const action = {
    type: 'SET',
    payload: {
      type: ['meta', 'stats'],
      data: {
        id: 'ent1',
        $type: 'meta',
        title: 'Entry 1',
        description: 'The first entry',
        author: { id: 'johnf', name: 'John F.' },
        updateCount: 3,
        draft: false,
        missing: undefined,
        nil: null,
        createdAt: new Date('2019-01-31T18:43:11Z'),
      },
    },
    meta: {
      options: {
        prefix: 'store',
        redis: redisOptions,
      },
    },
  }
  const expected = {
    status: 'ok',
    data: null,
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
  t.is(redisClient.hSet.callCount, 1)
  t.deepEqual(redisClient.hSet.args[0][0], 'store:meta:ent1')
})

test('should SET without type in prefix when useTypeAsPrefix is false', async (t) => {
  const redisClient = {
    hSet: sinon.stub().resolves('OK'),
  }
  const action = {
    type: 'SET',
    payload: {
      type: 'meta',
      data: {
        id: 'ent1',
        title: 'Entry 1',
        description: 'The first entry',
        author: { id: 'johnf', name: 'John F.' },
        updateCount: 3,
        draft: false,
        missing: undefined,
        nil: null,
        createdAt: new Date('2019-01-31T18:43:11Z'),
      },
    },
    meta: {
      options: {
        prefix: 'store',
        redis: redisOptions,
        useTypeAsPrefix: false,
      },
    },
  }
  const expected = {
    status: 'ok',
    data: null,
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
  t.is(redisClient.hSet.callCount, 1)
  t.deepEqual(redisClient.hSet.args[0][0], 'store:ent1')
})

test('should SET respond with noaction when no data', async (t) => {
  const redisClient = {
    hSet: sinon.stub().resolves('OK'),
  }
  const action = {
    type: 'SET',
    payload: {
      type: 'meta',
      data: null,
    },
    meta: {
      options: {
        prefix: 'store',
        redis: redisOptions,
      },
    },
  }
  const expected = {
    status: 'noaction',
    error: 'No data to SET',
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
  t.is(redisClient.hSet.callCount, 0)
})

// Tests -- delete

test('should DELETE several data items from redis', async (t) => {
  const redisClient = {
    del: sinon.stub().resolves(2),
  }
  const action = {
    type: 'DELETE',
    payload: {
      type: 'meta',
      data: [
        {
          id: 'ent1',
          title: 'Entry 1',
          description: 'The first entry',
        },
        {
          id: 'ent2',
          title: 'Entry 2',
          description: 'The second entry',
        },
      ],
    },
    meta: {
      options: {
        prefix: 'store',
        redis: redisOptions,
      },
    },
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.is(ret.status, 'ok', ret.error)
  t.is(redisClient.del.callCount, 1)
  t.deepEqual(redisClient.del.args[0][0], [
    'store:meta:ent1',
    'store:meta:ent2',
  ])
})

test('should DELETE one data item from redis', async (t) => {
  const redisClient = {
    del: sinon.stub().resolves(2),
  }
  const action = {
    type: 'DELETE',
    payload: {
      type: 'meta',
      data: {
        id: 'ent1',
        title: 'Entry 1',
        description: 'The first entry',
      },
    },
    meta: {
      options: {
        prefix: 'store',
        redis: redisOptions,
      },
    },
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.is(ret.status, 'ok', ret.error)
  t.is(redisClient.del.callCount, 1)
  t.deepEqual(redisClient.del.args[0][0], ['store:meta:ent1'])
})

test('should DELETE several ids from redis', async (t) => {
  const redisClient = {
    del: sinon.stub().resolves(2),
  }
  const action = {
    type: 'DELETE',
    payload: {
      type: 'meta',
      id: ['ent1', 'ent2'],
    },
    meta: {
      options: {
        prefix: 'store',
        redis: redisOptions,
      },
    },
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.is(ret.status, 'ok', ret.error)
  t.is(redisClient.del.callCount, 1)
  t.deepEqual(redisClient.del.args[0][0], [
    'store:meta:ent1',
    'store:meta:ent2',
  ])
})

test('should DELETE one id from redis', async (t) => {
  const redisClient = {
    del: sinon.stub().resolves(2),
  }
  const action = {
    type: 'DELETE',
    payload: {
      type: 'meta',
      id: 'ent1',
    },
    meta: {
      options: {
        prefix: 'store',
        redis: redisOptions,
      },
    },
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.is(ret.status, 'ok', ret.error)
  t.is(redisClient.del.callCount, 1)
  t.deepEqual(redisClient.del.args[0][0], ['store:meta:ent1'])
})

test('should DELETE with id from redis when data has no id', async (t) => {
  const redisClient = {
    del: sinon.stub().resolves(2),
  }
  const action = {
    type: 'DELETE',
    payload: {
      type: 'meta',
      id: 'ent1',
      data: {},
    },
    meta: {
      options: {
        prefix: 'store',
        redis: redisOptions,
      },
    },
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.is(ret.status, 'ok', ret.error)
  t.is(redisClient.del.callCount, 1)
  t.deepEqual(redisClient.del.args[0][0], ['store:meta:ent1'])
})

test('should do nothing when DELETE has no ids', async (t) => {
  const redisClient = {
    del: sinon.stub().resolves(2),
  }
  const action = {
    type: 'DELETE',
    payload: {
      type: 'meta',
    },
    meta: {
      options: {
        prefix: 'store',
        redis: redisOptions,
      },
    },
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.is(ret.status, 'noaction', ret.error)
  t.is(redisClient.del.callCount, 0)
})

// Tests -- error handling

test('should return error when redis throws on GET', async (t) => {
  const redisClient = {
    hGetAll: sinon.stub().rejects(new Error('Horror!')),
  }
  const action = {
    type: 'GET',
    payload: {
      type: 'meta',
      id: 'entries',
    },
    meta: {
      options: {
        redis: redisOptions,
      },
    },
  }
  const expected = {
    status: 'error',
    error: "Error from Redis while getting from hash 'meta:entries'. Horror!",
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
})

test('should return error when redis throws on one of more GETs', async (t) => {
  const redisClient = {
    hGetAll: sinon.stub().resolves([]).onCall(0).rejects(new Error('Horror!')),
  }
  const action = {
    type: 'GET',
    payload: {
      type: 'meta',
      id: ['entries', 'users'],
    },
    meta: {
      options: {
        redis: redisOptions,
      },
    },
  }
  const expected = {
    status: 'error',
    error:
      "Failed to get from Redis. Error from Redis while getting from hash 'meta:entries'. Horror!",
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
})

test('should return error when getting ids from redis fails', async (t) => {
  const redisClient = {
    hGetAll: sinon.stub().resolves(null),
    keys: sinon.stub().rejects(new Error('Oh no!')),
  }
  const action = {
    type: 'GET',
    payload: {
      type: 'meta',
      // No id => collection
    },
    meta: {
      options: { redis: redisOptions },
    },
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.is(ret.status, 'error', ret.error)
  t.is(ret.error, 'Could not get collection from Redis. Error: Oh no!')
  t.is(ret.data, undefined)
  t.is(redisClient.keys.callCount, 1)
  t.is(redisClient.hGetAll.callCount, 0)
})

test('should respond with badrequest when array of ids on SET', async (t) => {
  const redisClient = {
    hGetAll: sinon.stub().resolves(null),
  }
  const action = {
    type: 'SET',
    payload: {
      type: 'meta',
      id: ['entries', 'other'], // Will this every happen?
      data: [],
    },
    meta: {
      options: { redis: redisOptions },
    },
  }
  const expected = {
    status: 'badrequest',
    error: 'Array of ids not supported for SET action',
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
  t.is(redisClient.hGetAll.callCount, 0)
})

test('should return error when redis throws on SET', async (t) => {
  const redisClient = {
    hSet: sinon.stub().rejects(new Error('Horror!')),
  }
  const action = {
    type: 'SET',
    payload: {
      type: 'meta',
      data: [
        {
          id: 'ent1',
          title: 'Entry 1',
        },
        {
          id: 'ent2',
          title: 'Entry 2',
        },
      ],
    },
    meta: {
      options: {
        redis: redisOptions,
      },
    },
  }
  const expected = {
    status: 'error',
    error:
      "Error from Redis while setting on hash 'meta:ent1'. Horror! | Error from Redis while setting on hash 'meta:ent2'. Horror!",
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
})

test('should return error when redis throws on one of more SETs', async (t) => {
  const redisClient = {
    hSet: sinon
      .stub()
      .resolves('OK')
      .onSecondCall()
      .rejects(new Error('Horror!')),
  }
  const action = {
    type: 'SET',
    payload: {
      type: 'meta',
      data: [
        {
          id: 'ent1',
          title: 'Entry 1',
        },
        {
          id: 'ent2',
          title: 'Entry 2',
        },
      ],
    },
    meta: {
      options: {
        redis: redisOptions,
      },
    },
  }
  const expected = {
    status: 'error',
    error:
      "Error from Redis while setting on hash 'meta:ent2'. Horror! | The rest succeeded",
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
})

test('should return error when no connection', async (t) => {
  const action = {
    type: 'GET',
    payload: {
      type: 'meta',
      id: 'meta:entries',
    },
    meta: {
      options: {
        redis: redisOptions,
      },
    },
  }
  const expected = {
    status: 'error',
    error: "No redis client given to redis transporter's send method",
  }

  const ret = await send(action, null)

  t.deepEqual(ret, expected)
})

test('should return error when no client', async (t) => {
  const action = {
    type: 'GET',
    payload: {
      type: 'meta',
      id: 'meta:entries',
    },
    meta: {
      options: {
        redis: redisOptions,
      },
    },
  }
  const connection = { status: 'error', error: 'Fail', redisClient: null }
  const expected = {
    status: 'error',
    error: "No redis client given to redis transporter's send method",
  }

  const ret = await send(action, connection)

  t.deepEqual(ret, expected)
})

test('should return error when no options', async (t) => {
  const action = {
    type: 'GET',
    payload: {
      type: 'meta',
      id: 'meta:entries',
    },
    meta: {},
  }
  const connection = { status: 'error', error: 'Fail', redisClient: null }
  const expected = {
    status: 'error',
    error: "No redis client given to redis transporter's send method",
  }

  const ret = await send(action, connection)

  t.deepEqual(ret, expected)
})

test('should return badrequest when unknown action', async (t) => {
  const redisClient = {
    hGetAll: sinon.stub().resolves(null),
  }
  const action = {
    type: 'UNKNOWN',
    payload: {
      type: 'meta',
      id: 'meta:entries',
    },
    meta: {
      options: { redis: redisOptions },
    },
  }
  const expected = {
    status: 'badrequest',
    error: "Unknown action 'UNKNOWN'",
  }

  const ret = await send(action, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
})
