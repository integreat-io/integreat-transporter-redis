import test from 'node:test'
import assert from 'node:assert/strict'
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

// Tests -- listen -- keyPattern

test('should create a stand-alone client, subscribe to hset events, and return ok', async () => {
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
    incoming: { keyPattern: 'store:user:*' },
  }
  const expected = { status: 'ok' }

  const ret = await listen(dispatch, connection, authenticate)

  assert.deepEqual(ret, expected)
  assert.equal(configGetStub.callCount, 1)
  assert.equal(configSetStub.callCount, 0) // No need to set config when already set
  assert.equal(duplicateStub.callCount, 1)
  assert.equal(connectStub.callCount, 1)
  assert.equal(subscribeStub.callCount, 1)
  assert.equal(subscribeStub.args[0][0], '__keyevent@0__:hset')
  assert.equal(typeof subscribeStub.args[0][1], 'function') // Listener
  assert.equal(dispatch.callCount, 0) // No dispatching without requests
})

test('should respond with error when no client', async () => {
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

  assert.deepEqual(ret, expected)
  assert.equal(dispatch.callCount, 0) // No dispatching without requests
})

test('should respond with error when connection fails', async () => {
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

  assert.deepEqual(ret, expected)
  assert.equal(duplicateStub.callCount, 1)
  assert.equal(connectStub.callCount, 1)
  assert.equal(subscribeStub.callCount, 0)
  assert.equal(dispatch.callCount, 0)
})

test('should respond with error when subscription fails', async () => {
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

  assert.deepEqual(ret, expected)
  assert.equal(duplicateStub.callCount, 1)
  assert.equal(connectStub.callCount, 1)
  assert.equal(subscribeStub.callCount, 1)
  assert.equal(dispatch.callCount, 0)
})

// Tests -- listen -- channel

test('should create a stand-alone client, subscribe to hset events, and return ok', async () => {
  const dispatch = sinon
    .stub()
    .resolves({ status: 'ok', data: JSON.stringify([{ id: 'ent1' }]) })
  const connectStub = sinon.stub().resolves()
  const subscribeStub = sinon.stub().resolves()
  const subscriber = { connect: connectStub, subscribe: subscribeStub }
  const duplicateStub = sinon.stub().returns(subscriber)
  const configGetStub = sinon.stub().resolves({})
  const configSetStub = sinon.stub().resolves('OK')
  const redisClient = {
    duplicate: duplicateStub,
    configGet: configGetStub,
    configSet: configSetStub,
  } as unknown as ReturnType<typeof createClient>
  const connection = {
    status: 'ok',
    redisClient: redisClient,
    incoming: { channel: 'msg' },
  }
  const expected = { status: 'ok' }

  const ret = await listen(dispatch, connection, authenticate)

  assert.deepEqual(ret, expected)
  assert.equal(configGetStub.callCount, 0)
  assert.equal(configSetStub.callCount, 0) // No need to set config for channel
  assert.equal(duplicateStub.callCount, 1)
  assert.equal(connectStub.callCount, 1)
  assert.equal(subscribeStub.callCount, 1)
  assert.equal(subscribeStub.args[0][0], 'msg')
  assert.equal(typeof subscribeStub.args[0][1], 'function') // Listener
  assert.equal(dispatch.callCount, 0) // No dispatching without requests
})

test('should return noaction when no channel or keyPattern', async () => {
  const dispatch = sinon
    .stub()
    .resolves({ status: 'ok', data: JSON.stringify([{ id: 'ent1' }]) })
  const connectStub = sinon.stub().resolves()
  const subscribeStub = sinon.stub().resolves()
  const subscriber = { connect: connectStub, subscribe: subscribeStub }
  const duplicateStub = sinon.stub().returns(subscriber)
  const configGetStub = sinon.stub().resolves({})
  const configSetStub = sinon.stub().resolves('OK')
  const redisClient = {
    duplicate: duplicateStub,
    configGet: configGetStub,
    configSet: configSetStub,
  } as unknown as ReturnType<typeof createClient>
  const connection = {
    status: 'ok',
    redisClient: redisClient,
    incoming: {},
  }
  const expected = {
    status: 'noaction',
    warning: 'No `channel` or `keyPattern` to listen to',
  }

  const ret = await listen(dispatch, connection, authenticate)

  assert.deepEqual(ret, expected)
  assert.equal(configGetStub.callCount, 0)
  assert.equal(configSetStub.callCount, 0) // No need to set config for channel
  assert.equal(duplicateStub.callCount, 0)
  assert.equal(connectStub.callCount, 0)
  assert.equal(subscribeStub.callCount, 0)
  assert.equal(dispatch.callCount, 0) // No dispatching without requests
})

// Tests -- config

test('should enable required keyspace notification in Redis if needed', async () => {
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

  assert.deepEqual(ret, expected)
  assert.equal(configGetStub.callCount, 1)
  assert.equal(configGetStub.args[0][0], 'notify-keyspace-events')
  assert.equal(configSetStub.callCount, 1)
  assert.equal(configSetStub.args[0][0], 'notify-keyspace-events')
  assert.equal(configSetStub.args[0][1], 'Eh')
})

test('should keep other keyspace notification letters', async () => {
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

  assert.deepEqual(ret, expected)
  assert.equal(configGetStub.callCount, 1)
  assert.equal(configGetStub.args[0][0], 'notify-keyspace-events')
  assert.equal(configSetStub.callCount, 1)
  assert.equal(configSetStub.args[0][0], 'notify-keyspace-events')
  assert.equal(configSetStub.args[0][1], 'KgEh')
})

test('should update when only one letter is missing', async () => {
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

  assert.deepEqual(ret, expected)
  assert.equal(configGetStub.callCount, 1)
  assert.equal(configGetStub.args[0][0], 'notify-keyspace-events')
  assert.equal(configSetStub.callCount, 1)
  assert.equal(configSetStub.args[0][0], 'notify-keyspace-events')
  assert.equal(configSetStub.args[0][1], 'KEgh')
})

// Tests -- dispatch

test('should dispatch SET action when key matching pattern is updated with hset', async () => {
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
  assert.equal(typeof listener, 'function')
  if (typeof listener === 'function') {
    await listener('store:user:user1', '__keyevent@0__:hset')
  }

  assert.deepEqual(ret, { status: 'ok' })
  assert.equal(dispatch.callCount, 1)
  assert.deepEqual(dispatch.args[0][0], expectedAction)
})

test('should not dispatch when key is not matching pattern', async () => {
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
  assert.equal(typeof listener, 'function')
  if (typeof listener === 'function') {
    await listener('store:something:unknown1', '__keyevent@0__:hset')
  }

  assert.deepEqual(ret, { status: 'ok' })
  assert.equal(dispatch.callCount, 0)
})

test('should match key with non-wildcard pattern', async () => {
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
  assert.equal(typeof listener, 'function')
  if (typeof listener === 'function') {
    await listener('store:user:user2', '__keyevent@0__:hset')
  }

  assert.deepEqual(ret, { status: 'ok' })
  assert.equal(dispatch.callCount, 1)
  assert.deepEqual(dispatch.args[0][0], expectedAction)
})

test('should not match key that start with pattern when non-wildcard pattern', async () => {
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
  assert.equal(typeof listener, 'function')
  if (typeof listener === 'function') {
    await listener('store:user:user22', '__keyevent@0__:hset') // Should not match without wildcard
  }

  assert.deepEqual(ret, { status: 'ok' })
  assert.equal(dispatch.callCount, 0)
})

test('should match everything with wildcard only pattern', async () => {
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
  assert.equal(typeof listener, 'function')
  if (typeof listener === 'function') {
    await listener('store:user:user22', '__keyevent@0__:hset')
  }

  assert.deepEqual(ret, { status: 'ok' })
  assert.equal(dispatch.callCount, 1)
  assert.deepEqual(dispatch.args[0][0], expectedAction)
})

test('should dispatch SET action with channel', async () => {
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
      channel: 'msg',
    },
  }
  const expectedAction = {
    type: 'SET',
    payload: { method: 'pubsub', channel: 'msg', data: '{"id":"ent1"}' },
    meta: { ident: { id: 'userFromIntegreat' } }, // Ident comes from call to `authenticate()`
  }

  const ret = await listen(dispatch, connection, authenticate)
  const listener = subscribeStub.args[0][1]
  assert.equal(typeof listener, 'function')
  if (typeof listener === 'function') {
    await listener('{"id":"ent1"}', 'msg')
  }

  assert.deepEqual(ret, { status: 'ok' })
  assert.equal(dispatch.callCount, 1)
  assert.deepEqual(dispatch.args[0][0], expectedAction)
})

test('should dispatch auth error', async () => {
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
  assert.equal(typeof listener, 'function')
  if (typeof listener === 'function') {
    await listener('store:user:user1', '__keyevent@0__:hset')
  }

  assert.deepEqual(ret, { status: 'ok' })
  assert.equal(dispatch.callCount, 1)
  assert.deepEqual(dispatch.args[0][0], expectedAction)
})
