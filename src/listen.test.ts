import test from 'ava'
import sinon from 'sinon'
import type { createClient } from '@redis/client'

import listen from './listen.js'

// Setup

const authenticate = async () => ({
  status: 'ok',
  access: { ident: { id: 'userFromIntegreat' } },
})

const configGet = async () => ({ 'notify-keyspace-events': 'Eh' })
const configSet = async () => 'OK'

// Tests -- listen

test('should create a stand-alone client, subscribe to hset events, and return ok', async (t) => {
  const dispatch = sinon
    .stub()
    .resolves({ status: 'ok', data: JSON.stringify([{ id: 'ent1' }]) })
  const connectStub = sinon.stub().resolves()
  const subscribeStub = sinon.stub().resolves()
  const subscriber = { connect: connectStub, subscribe: subscribeStub }
  const duplicateStub = sinon.stub().returns(subscriber)
  const configGetStub = sinon
    .stub()
    .resolves({ 'notify-keyspace-events': 'Eh' })
  const configSetStub = sinon.stub().resolves('OK')
  const redisClient = {
    duplicate: duplicateStub,
    configGet: configGetStub,
    configSet: configSetStub,
  } as unknown as ReturnType<typeof createClient>
  const connection = {
    status: 'ok',
    redisClient: redisClient,
    incoming: {
      keyPattern: 'store:user:*',
    },
  }
  const expected = { status: 'ok' }

  const ret = await listen(dispatch, connection, authenticate)

  t.deepEqual(ret, expected)
  t.is(configGetStub.callCount, 1)
  t.is(configSetStub.callCount, 0) // No need to set config when already set
  t.is(duplicateStub.callCount, 1)
  t.is(connectStub.callCount, 1)
  t.is(subscribeStub.callCount, 1)
  t.is(subscribeStub.args[0][0], '__keyevent@0__:hset')
  t.is(typeof subscribeStub.args[0][1], 'function') // Listener
  t.is(dispatch.callCount, 0) // No dispatching without requests
})

test('should respond with error when client', async (t) => {
  const dispatch = sinon
    .stub()
    .resolves({ status: 'ok', data: JSON.stringify([{ id: 'ent1' }]) })
  const connection = {
    status: 'ok',
    redisClient: null,
    incoming: {
      keyPattern: 'store:user:*',
    },
  }
  const expected = { status: 'error', error: 'No Redis client' }

  const ret = await listen(dispatch, connection, authenticate)

  t.deepEqual(ret, expected)
  t.is(dispatch.callCount, 0) // No dispatching without requests
})

test('should respond with error when connection fails', async (t) => {
  const dispatch = sinon
    .stub()
    .resolves({ status: 'ok', data: JSON.stringify([{ id: 'ent1' }]) })
  const connectStub = sinon.stub().rejects(new Error('Connection failed'))
  const subscribeStub = sinon.stub().resolves()
  const subscriber = { connect: connectStub, subscribe: subscribeStub }
  const duplicateStub = sinon.stub().returns(subscriber)
  const redisClient = {
    duplicate: duplicateStub,
    configGet,
    configSet,
  } as unknown as ReturnType<typeof createClient>
  const connection = {
    status: 'ok',
    redisClient: redisClient,
    incoming: {
      keyPattern: 'store:user:*',
    },
  }
  const expected = {
    status: 'error',
    error: 'Could not subscribe to Redis. Connection failed',
  }

  const ret = await listen(dispatch, connection, authenticate)

  t.deepEqual(ret, expected)
  t.is(duplicateStub.callCount, 1)
  t.is(connectStub.callCount, 1)
  t.is(subscribeStub.callCount, 0)
  t.is(dispatch.callCount, 0)
})

test('should respond with error when subscription fails', async (t) => {
  const dispatch = sinon
    .stub()
    .resolves({ status: 'ok', data: JSON.stringify([{ id: 'ent1' }]) })
  const connectStub = sinon.stub().resolves()
  const subscribeStub = sinon.stub().rejects(new Error('Subscription failed'))
  const subscriber = { connect: connectStub, subscribe: subscribeStub }
  const duplicateStub = sinon.stub().returns(subscriber)
  const redisClient = {
    duplicate: duplicateStub,
    configGet,
    configSet,
  } as unknown as ReturnType<typeof createClient>
  const connection = {
    status: 'ok',
    redisClient: redisClient,
    incoming: {
      keyPattern: 'store:user:*',
    },
  }
  const expected = {
    status: 'error',
    error: 'Could not subscribe to Redis. Subscription failed',
  }

  const ret = await listen(dispatch, connection, authenticate)

  t.deepEqual(ret, expected)
  t.is(duplicateStub.callCount, 1)
  t.is(connectStub.callCount, 1)
  t.is(subscribeStub.callCount, 1)
  t.is(dispatch.callCount, 0)
})

// Tests -- config

test('should enable required keyspace notification in Redis if needed', async (t) => {
  const dispatch = sinon
    .stub()
    .resolves({ status: 'ok', data: JSON.stringify([{ id: 'ent1' }]) })
  const connectStub = sinon.stub().resolves()
  const subscribeStub = sinon.stub().resolves()
  const subscriber = { connect: connectStub, subscribe: subscribeStub }
  const duplicateStub = sinon.stub().returns(subscriber)
  const configGetStub = sinon.stub().resolves({ 'notify-keyspace-events': '' })
  const configSetStub = sinon.stub().resolves('OK')
  const redisClient = {
    duplicate: duplicateStub,
    configGet: configGetStub,
    configSet: configSetStub,
  } as unknown as ReturnType<typeof createClient>
  const connection = {
    status: 'ok',
    redisClient: redisClient,
    incoming: {
      keyPattern: 'store:user:*',
    },
  }
  const expected = { status: 'ok' }

  const ret = await listen(dispatch, connection, authenticate)

  t.deepEqual(ret, expected)
  t.is(configGetStub.callCount, 1)
  t.is(configGetStub.args[0][0], 'notify-keyspace-events')
  t.is(configSetStub.callCount, 1)
  t.is(configSetStub.args[0][0], 'notify-keyspace-events')
  t.is(configSetStub.args[0][1], 'Eh')
})

test('should keep other keyspace notification letters', async (t) => {
  const dispatch = sinon
    .stub()
    .resolves({ status: 'ok', data: JSON.stringify([{ id: 'ent1' }]) })
  const connectStub = sinon.stub().resolves()
  const subscribeStub = sinon.stub().resolves()
  const subscriber = { connect: connectStub, subscribe: subscribeStub }
  const duplicateStub = sinon.stub().returns(subscriber)
  const configGetStub = sinon
    .stub()
    .resolves({ 'notify-keyspace-events': 'Kg' })
  const configSetStub = sinon.stub().resolves('OK')
  const redisClient = {
    duplicate: duplicateStub,
    configGet: configGetStub,
    configSet: configSetStub,
  } as unknown as ReturnType<typeof createClient>
  const connection = {
    status: 'ok',
    redisClient: redisClient,
    incoming: {
      keyPattern: 'store:user:*',
    },
  }
  const expected = { status: 'ok' }

  const ret = await listen(dispatch, connection, authenticate)

  t.deepEqual(ret, expected)
  t.is(configGetStub.callCount, 1)
  t.is(configGetStub.args[0][0], 'notify-keyspace-events')
  t.is(configSetStub.callCount, 1)
  t.is(configSetStub.args[0][0], 'notify-keyspace-events')
  t.is(configSetStub.args[0][1], 'KgEh')
})

test('should update when only one letter is missing', async (t) => {
  const dispatch = sinon
    .stub()
    .resolves({ status: 'ok', data: JSON.stringify([{ id: 'ent1' }]) })
  const connectStub = sinon.stub().resolves()
  const subscribeStub = sinon.stub().resolves()
  const subscriber = { connect: connectStub, subscribe: subscribeStub }
  const duplicateStub = sinon.stub().returns(subscriber)
  const configGetStub = sinon
    .stub()
    .resolves({ 'notify-keyspace-events': 'KEg' }) // Missing 'h'
  const configSetStub = sinon.stub().resolves('OK')
  const redisClient = {
    duplicate: duplicateStub,
    configGet: configGetStub,
    configSet: configSetStub,
  } as unknown as ReturnType<typeof createClient>
  const connection = {
    status: 'ok',
    redisClient: redisClient,
    incoming: {
      keyPattern: 'store:user:*',
    },
  }
  const expected = { status: 'ok' }

  const ret = await listen(dispatch, connection, authenticate)

  t.deepEqual(ret, expected)
  t.is(configGetStub.callCount, 1)
  t.is(configGetStub.args[0][0], 'notify-keyspace-events')
  t.is(configSetStub.callCount, 1)
  t.is(configSetStub.args[0][0], 'notify-keyspace-events')
  t.is(configSetStub.args[0][1], 'KEgh')
})

// Tests -- dispatch

test('should dispatch SET action when key matching pattern is updated with hset', async (t) => {
  const dispatch = sinon
    .stub()
    .resolves({ status: 'ok', data: JSON.stringify([{ id: 'ent1' }]) })
  const connectStub = sinon.stub().resolves()
  const subscribeStub = sinon.stub().resolves()
  const subscriber = { connect: connectStub, subscribe: subscribeStub }
  const duplicateStub = sinon.stub().returns(subscriber)
  const redisClient = {
    duplicate: duplicateStub,
    configGet,
    configSet,
  } as unknown as ReturnType<typeof createClient>
  const connection = {
    status: 'ok',
    redisClient: redisClient,
    incoming: {
      keyPattern: 'store:user:*',
    },
  }
  const expectedAction = {
    type: 'SET',
    payload: { id: 'user1', method: 'hset', key: 'store:user:user1' },
    meta: { ident: { id: 'userFromIntegreat' } }, // Ident comes from call to `authenticate()`
  }

  const ret = await listen(dispatch, connection, authenticate)
  const listener = subscribeStub.args[0][1]
  t.is(typeof listener, 'function')
  if (typeof listener === 'function') {
    await listener('store:user:user1', '__keyevent@0__:hset')
  }

  t.deepEqual(ret, { status: 'ok' })
  t.is(dispatch.callCount, 1)
  t.deepEqual(dispatch.args[0][0], expectedAction)
})

test('should not dispatch when key is not matching pattern', async (t) => {
  const dispatch = sinon
    .stub()
    .resolves({ status: 'ok', data: JSON.stringify([{ id: 'ent1' }]) })
  const connectStub = sinon.stub().resolves()
  const subscribeStub = sinon.stub().resolves()
  const subscriber = { connect: connectStub, subscribe: subscribeStub }
  const duplicateStub = sinon.stub().returns(subscriber)
  const redisClient = {
    duplicate: duplicateStub,
    configGet,
    configSet,
  } as unknown as ReturnType<typeof createClient>
  const connection = {
    status: 'ok',
    redisClient: redisClient,
    incoming: {
      keyPattern: 'store:user:*',
    },
  }

  const ret = await listen(dispatch, connection, authenticate)
  const listener = subscribeStub.args[0][1]
  t.is(typeof listener, 'function')
  if (typeof listener === 'function') {
    await listener('store:something:unknown1', '__keyevent@0__:hset')
  }

  t.deepEqual(ret, { status: 'ok' })
  t.is(dispatch.callCount, 0)
})

test('should match key with non-wildcard pattern', async (t) => {
  const dispatch = sinon
    .stub()
    .resolves({ status: 'ok', data: JSON.stringify([{ id: 'ent1' }]) })
  const connectStub = sinon.stub().resolves()
  const subscribeStub = sinon.stub().resolves()
  const subscriber = { connect: connectStub, subscribe: subscribeStub }
  const duplicateStub = sinon.stub().returns(subscriber)
  const redisClient = {
    duplicate: duplicateStub,
    configGet,
    configSet,
  } as unknown as ReturnType<typeof createClient>
  const connection = {
    status: 'ok',
    redisClient: redisClient,
    incoming: {
      keyPattern: 'store:user:user2', // No wildcard
    },
  }
  const expectedAction = {
    type: 'SET',
    payload: { id: 'user2', method: 'hset', key: 'store:user:user2' },
    meta: { ident: { id: 'userFromIntegreat' } }, // Ident comes from call to `authenticate()`
  }

  const ret = await listen(dispatch, connection, authenticate)
  const listener = subscribeStub.args[0][1]
  t.is(typeof listener, 'function')
  if (typeof listener === 'function') {
    await listener('store:user:user2', '__keyevent@0__:hset')
  }

  t.deepEqual(ret, { status: 'ok' })
  t.is(dispatch.callCount, 1)
  t.deepEqual(dispatch.args[0][0], expectedAction)
})

test('should not match key that start with pattern when non-wildcard pattern', async (t) => {
  const dispatch = sinon
    .stub()
    .resolves({ status: 'ok', data: JSON.stringify([{ id: 'ent1' }]) })
  const connectStub = sinon.stub().resolves()
  const subscribeStub = sinon.stub().resolves()
  const subscriber = { connect: connectStub, subscribe: subscribeStub }
  const duplicateStub = sinon.stub().returns(subscriber)
  const redisClient = {
    duplicate: duplicateStub,
    configGet,
    configSet,
  } as unknown as ReturnType<typeof createClient>
  const connection = {
    status: 'ok',
    redisClient: redisClient,
    incoming: {
      keyPattern: 'store:user:user2', // No wildcard
    },
  }

  const ret = await listen(dispatch, connection, authenticate)
  const listener = subscribeStub.args[0][1]
  t.is(typeof listener, 'function')
  if (typeof listener === 'function') {
    await listener('store:user:user22', '__keyevent@0__:hset') // Should not match without wildcard
  }

  t.deepEqual(ret, { status: 'ok' })
  t.is(dispatch.callCount, 0)
})

test('should match everything with wildcard only pattern', async (t) => {
  const dispatch = sinon
    .stub()
    .resolves({ status: 'ok', data: JSON.stringify([{ id: 'ent1' }]) })
  const connectStub = sinon.stub().resolves()
  const subscribeStub = sinon.stub().resolves()
  const subscriber = { connect: connectStub, subscribe: subscribeStub }
  const duplicateStub = sinon.stub().returns(subscriber)
  const redisClient = {
    duplicate: duplicateStub,
    configGet,
    configSet,
  } as unknown as ReturnType<typeof createClient>
  const connection = {
    status: 'ok',
    redisClient: redisClient,
    incoming: {
      keyPattern: '*',
    },
  }
  const expectedAction = {
    type: 'SET',
    payload: {
      id: 'store:user:user22',
      method: 'hset',
      key: 'store:user:user22',
    },
    meta: { ident: { id: 'userFromIntegreat' } }, // Ident comes from call to `authenticate()`
  }

  const ret = await listen(dispatch, connection, authenticate)
  const listener = subscribeStub.args[0][1]
  t.is(typeof listener, 'function')
  if (typeof listener === 'function') {
    await listener('store:user:user22', '__keyevent@0__:hset')
  }

  t.deepEqual(ret, { status: 'ok' })
  t.is(dispatch.callCount, 1)
  t.deepEqual(dispatch.args[0][0], expectedAction)
})

test('should dispatch auth error', async (t) => {
  const authenticate = async () => ({
    status: 'noaccess',
    error: 'Not authorized',
    access: { ident: undefined },
  })
  const dispatch = sinon
    .stub()
    .resolves({ status: 'ok', data: JSON.stringify([{ id: 'ent1' }]) })
  const connectStub = sinon.stub().resolves()
  const subscribeStub = sinon.stub().resolves()
  const subscriber = { connect: connectStub, subscribe: subscribeStub }
  const duplicateStub = sinon.stub().returns(subscriber)
  const redisClient = {
    duplicate: duplicateStub,
    configGet,
    configSet,
  } as unknown as ReturnType<typeof createClient>
  const connection = {
    status: 'ok',
    redisClient: redisClient,
    incoming: {
      keyPattern: 'store:user:*',
    },
  }
  const expectedAction = {
    type: 'SET',
    payload: { id: 'user1', method: 'hset', key: 'store:user:user1' },
    response: {
      status: 'noaccess',
      error: 'Not authorized',
      access: { ident: undefined },
    },
    meta: { ident: undefined },
  }

  const ret = await listen(dispatch, connection, authenticate)
  const listener = subscribeStub.args[0][1]
  t.is(typeof listener, 'function')
  if (typeof listener === 'function') {
    await listener('store:user:user1', '__keyevent@0__:hset')
  }

  t.deepEqual(ret, { status: 'ok' })
  t.is(dispatch.callCount, 1)
  t.deepEqual(dispatch.args[0][0], expectedAction)
})
