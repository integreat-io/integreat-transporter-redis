import test from 'ava'
import sinon = require('sinon')

import disconnect from './disconnect'

// Tests

test('should call quit on redis client', async (t) => {
  const redisClient = {
    quit: sinon.stub().yieldsRight(null)
  }
  const connection = { status: 'ok', redisClient: redisClient as any }

  await disconnect(connection)

  t.is(redisClient.quit.callCount, 1)
})

test('should do nothing when no connection', async (t) => {
  await t.notThrowsAsync(disconnect(null))
})

test('should do nothing when no client', async (t) => {
  const connection = { status: 'error', error: 'Fail', redisClient: null }

  await t.notThrowsAsync(disconnect(connection))
})
