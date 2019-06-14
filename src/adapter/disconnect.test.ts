import test from 'ava'
import sinon = require('sinon')

import disconnect from './disconnect'

// Tests

test('should call quit on redis client', async (t) => {
  const redisClient = {
    quit: sinon.stub().yieldsRight(null)
  }

  await disconnect(redisClient as any)

  t.is(redisClient.quit.callCount, 1)
})

test('should do nothing when no client', async (t) => {
  await t.notThrowsAsync(disconnect(null))
})
