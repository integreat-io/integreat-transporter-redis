import test from 'node:test'
import assert from 'node:assert/strict'
import sinon from 'sinon'
import { createClient } from '@redis/client'
import type { Connection } from './types.js'

import connect from './connect.js'

// Setup

const client = {
  on: () => client,
  connect: async () => undefined,
} as unknown as ReturnType<typeof createClient>

// Tests

test('should return connection object with created redis client', async () => {
  const connectStub = sinon.stub().resolves()
  const clientWithConnect = {
    ...client,
    connect: connectStub,
  } as unknown as ReturnType<typeof createClient>
  const createClient = sinon.stub().returns(clientWithConnect)
  const options = { redis: { uri: 'redis://localhost:6379' } }

  const ret = await connect(createClient)(options, null, null)

  assert.equal(ret?.status, 'ok')
  assert.equal(ret?.redisClient, clientWithConnect)
  assert.equal(ret?.expire, null)
  assert.equal(createClient.callCount, 1)
  assert.deepEqual(createClient.args[0][0], { url: 'redis://localhost:6379' })
  assert.equal(connectStub.callCount, 1)
})

test('should set error handler before connecting', async () => {
  const connectStub = sinon.stub().resolves()
  const onStub = sinon.stub()
  const clientWithConnect = {
    ...client,
    connect: connectStub,
    on: onStub,
  } as unknown as ReturnType<typeof createClient>
  const createClient = sinon.stub().returns(clientWithConnect)
  const options = { redis: { uri: 'redis://localhost:6379' } }

  const ret = await connect(createClient)(options, null, null)

  assert.equal(ret?.status, 'ok')
  assert.ok(onStub.calledBefore(connectStub))
})

test('should provide the expected options to Redis', async () => {
  const connectStub = sinon.stub().resolves()
  const clientWithConnect = {
    ...client,
    connect: connectStub,
  } as unknown as ReturnType<typeof createClient>
  const createClient = sinon.stub().returns(clientWithConnect)
  const options = {
    redis: {
      host: 'localhost',
      port: 6379,
      database: 1,
      tls: true,
      auth: {
        key: 'johnf',
        secret: 's3cr3t',
      },
    },
  }
  const expectedRedisOptions = {
    socket: {
      host: 'localhost',
      port: 6379,
      tls: true,
    },
    database: 1,
    username: 'johnf',
    password: 's3cr3t',
  }

  const ret = await connect(createClient)(options, null, null)

  assert.equal(ret?.status, 'ok')
  assert.equal(ret?.redisClient, clientWithConnect)
  assert.equal(ret?.expire, null)
  assert.equal(createClient.callCount, 1)
  assert.deepEqual(createClient.args[0][0], expectedRedisOptions)
  assert.equal(connectStub.callCount, 1)
})

test('should return connection object with credentials from auth object', async () => {
  const connectStub = sinon.stub().resolves()
  const clientWithConnect = {
    ...client,
    connect: connectStub,
  } as unknown as ReturnType<typeof createClient>
  const createClient = sinon.stub().returns(clientWithConnect)
  const options = {
    redis: {
      host: 'localhost',
      port: 6379,
      database: 1,
      tls: true,
    },
  }
  const auth = { status: 'granted', key: 'johnf', secret: 's3cr3t' }
  const expectedRedisOptions = {
    socket: {
      host: 'localhost',
      port: 6379,
      tls: true,
    },
    database: 1,
    username: 'johnf',
    password: 's3cr3t',
  }

  const ret = await connect(createClient)(options, auth, null)

  assert.equal(ret?.status, 'ok')
  assert.equal(ret?.redisClient, clientWithConnect)
  assert.equal(ret?.expire, null)
  assert.equal(createClient.callCount, 1)
  assert.deepEqual(createClient.args[0][0], expectedRedisOptions)
  assert.equal(connectStub.callCount, 1)
})

test('should set expire when an connectionTimeout interval is given', async () => {
  const createClient = sinon.stub().returns(client)
  const options = {
    redis: { uri: 'redis://localhost:6379' },
    connectionTimeout: 60000,
  }
  const expectedExpire = Date.now() + 60000

  const ret = await connect(createClient)(options, null, null)

  assert.equal(ret?.status, 'ok')
  assert.equal(typeof ret?.expire, 'number')
  assert.ok((ret?.expire as number) >= expectedExpire)
  assert.ok((ret?.expire as number) < expectedExpire + 100) // Give it a few ms in case of delay
})

test('should return existing client when given', async () => {
  const createClient = sinon.stub().returns(client)
  const options = { redis: { uri: 'redis://localhost:6379' } }
  const connection = { status: 'ok', redisClient: client }

  const ret = await connect(createClient)(options, null, connection)

  assert.equal(ret, connection)
  assert.equal(createClient.callCount, 0)
})

test('should reconnect when a connection is missing client', async () => {
  const createClient = sinon.stub().returns(client)
  const options = { redis: { uri: 'redis://localhost:6379' } }
  const connection = { status: 'ok', redisClient: null }

  const ret = await connect(createClient)(options, null, connection)

  assert.equal(ret?.status, 'ok')
  assert.equal(ret?.redisClient, client)
  assert.equal(createClient.callCount, 1)
})

test('should reconnect when connection is expired', async () => {
  const clientWithDisconnect = {
    ...client,
    disconnect: sinon.stub().resolves(),
  }
  const createClient = sinon.stub().returns(client)
  const options = { redis: { uri: 'redis://localhost:6379' } }
  const connection = {
    status: 'ok',
    redisClient: clientWithDisconnect,
    expire: Date.now() - 1000,
  }

  const ret = await connect(createClient)(
    options,
    null,
    connection as unknown as Connection,
  )

  assert.equal(ret?.status, 'ok')
  assert.equal(ret?.redisClient, client)
  assert.equal(createClient.callCount, 1)
  assert.equal(clientWithDisconnect.disconnect.callCount, 1)
})

test('should return error when no redis options', async () => {
  const createClient = sinon.stub().returns({})
  const options = {}
  const expectedConnection = {
    status: 'error',
    error: 'No redis options',
    redisClient: null,
  }

  const ret = await connect(createClient)(options, null, null)

  assert.deepEqual(ret, expectedConnection)
  assert.equal(createClient.callCount, 0)
})

test('should set incoming options with keyPattern', async () => {
  const createClient = sinon.stub().returns(client)
  const options = {
    redis: { uri: 'redis://localhost:6379' },
    incoming: { keyPattern: 'store:user:*' },
  }
  const expectedIncoming = { keyPattern: 'store:user:*' }

  const ret = await connect(createClient)(options, null, null)

  assert.equal(ret?.status, 'ok')
  assert.deepEqual(ret?.incoming, expectedIncoming)
})

test('should include prefix from service options in incoming keyPattern', async () => {
  const createClient = sinon.stub().returns(client)
  const options = {
    redis: { uri: 'redis://localhost:6379' },
    incoming: { keyPattern: 'user:*' },
    prefix: 'store',
  }
  const expectedIncoming = { keyPattern: 'store:user:*' }

  const ret = await connect(createClient)(options, null, null)

  assert.equal(ret?.status, 'ok')
  assert.deepEqual(ret?.incoming, expectedIncoming)
})

test('should set incoming options with channel', async () => {
  const createClient = sinon.stub().returns(client)
  const options = {
    redis: { uri: 'redis://localhost:6379' },
    incoming: { channel: 'msg' },
  }
  const expectedIncoming = { channel: 'msg' }

  const ret = await connect(createClient)(options, null, null)

  assert.equal(ret?.status, 'ok')
  assert.deepEqual(ret?.incoming, expectedIncoming)
})

test('should include prefix from service options in incoming channel', async () => {
  const createClient = sinon.stub().returns(client)
  const options = {
    redis: { uri: 'redis://localhost:6379' },
    incoming: { channel: 'msg' },
    prefix: 'store',
  }
  const expectedIncoming = { channel: 'store:msg' }

  const ret = await connect(createClient)(options, null, null)

  assert.equal(ret?.status, 'ok')
  assert.deepEqual(ret?.incoming, expectedIncoming)
})

test('should set incoming options with several channels', async () => {
  const createClient = sinon.stub().returns(client)
  const options = {
    redis: { uri: 'redis://localhost:6379' },
    incoming: { channel: ['msg1', 'msg2'] },
  }
  const expectedIncoming = { channel: ['msg1', 'msg2'] }

  const ret = await connect(createClient)(options, null, null)

  assert.equal(ret?.status, 'ok')
  assert.deepEqual(ret?.incoming, expectedIncoming)
})

test('should include prefix from service options in incoming channels', async () => {
  const createClient = sinon.stub().returns(client)
  const options = {
    redis: { uri: 'redis://localhost:6379' },
    incoming: { channel: ['msg1', 'msg2'] },
    prefix: 'store',
  }
  const expectedIncoming = { channel: ['store:msg1', 'store:msg2'] }

  const ret = await connect(createClient)(options, null, null)

  assert.equal(ret?.status, 'ok')
  assert.deepEqual(ret?.incoming, expectedIncoming)
})
