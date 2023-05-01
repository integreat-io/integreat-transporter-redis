import test from 'ava'
import sinon from 'sinon'
import type { Connection } from './index.js'

import disconnect from './disconnect.js'

// Tests

test('should call quit on redis client', async (t) => {
  const redisClient = {
    quit: sinon.stub().resolves(),
  }
  const connection = {
    status: 'ok',
    redisClient: redisClient,
  } as unknown as Connection

  await disconnect(connection)

  t.is(redisClient.quit.callCount, 1)
  t.is(connection.redisClient, null)
})

test('should do nothing when no connection', async (t) => {
  await t.notThrowsAsync(disconnect(null))
})

test('should do nothing when no client', async (t) => {
  const connection = { status: 'error', error: 'Fail', redisClient: null }

  await t.notThrowsAsync(disconnect(connection))
})
