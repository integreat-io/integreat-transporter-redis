import test from 'node:test'
import assert from 'node:assert/strict'
import sinon from 'sinon'
import type { Connection } from './types.js'

import disconnect from './disconnect.js'

// Tests

test('should call disconnect on redis client', async () => {
  const redisClient = {
    disconnect: sinon.stub().resolves(),
  }
  const connection = {
    status: 'ok',
    redisClient: redisClient,
  } as unknown as Connection

  await disconnect(connection)

  assert.equal(redisClient.disconnect.callCount, 1)
  assert.equal(connection.redisClient, null)
})

test('should handle that redis client disconnect throws', async () => {
  const redisClient = {
    disconnect: sinon.stub().throws('Error'),
  }
  const connection = {
    status: 'ok',
    redisClient: redisClient,
  } as unknown as Connection

  await disconnect(connection)

  assert.equal(redisClient.disconnect.callCount, 1)
  assert.equal(connection.redisClient, null)
})

test('should do nothing when no connection', async () => {
  await assert.doesNotReject(disconnect(null))
})

test('should do nothing when no client', async () => {
  const connection = { status: 'error', error: 'Fail', redisClient: null }

  await assert.doesNotReject(disconnect(connection))
})
