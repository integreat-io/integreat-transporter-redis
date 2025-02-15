import test from 'ava'
import sinon from 'sinon'
import type { Connection } from './types.js'

import disconnect from './disconnect.js'

// Tests

test('should call disconnect on redis client', async (t) => {
  const redisClient = {
    disconnect: sinon.stub().resolves(),
  }
  const connection = {
    status: 'ok',
    redisClient: redisClient,
  } as unknown as Connection

  await disconnect(connection)

  t.is(redisClient.disconnect.callCount, 1)
  t.is(connection.redisClient, null)
})

test('should handle that redis client disconnect throws', async (t) => {
  const redisClient = {
    disconnect: sinon.stub().throws('Error'),
  }
  const connection = {
    status: 'ok',
    redisClient: redisClient,
  } as unknown as Connection

  await disconnect(connection)

  t.is(redisClient.disconnect.callCount, 1)
  t.is(connection.redisClient, null)
})

test('should do nothing when no connection', async (t) => {
  await t.notThrowsAsync(disconnect(null))
})

test('should do nothing when no client', async (t) => {
  const connection = { status: 'error', error: 'Fail', redisClient: null }

  await t.notThrowsAsync(disconnect(connection))
})
