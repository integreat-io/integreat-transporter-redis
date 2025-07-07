import { scheduler } from 'node:timers/promises'
import ava, { TestFn } from 'ava'
import sinon from 'sinon'
import { createClient } from '@redis/client'

import transporter from '../index.js'

interface RedisContext {
  redisClient: ReturnType<typeof createClient>
}

// Setup

const test = ava as TestFn<RedisContext>

test.before(async (t) => {
  const redisClient = createClient()
  await redisClient.connect()
  t.context = { redisClient }
})

test.after.always(async (t) => {
  const { redisClient } = t.context
  if (redisClient) {
    await redisClient.del('store:user:user1')
    await redisClient.quit()
  }
})

const emit = () => undefined
const authenticate = async () => ({
  status: 'ok',
  access: { ident: { id: 'userFromIntegreat' } },
})

// Tests

test('should listen and receive item with id on update', async (t) => {
  const { redisClient } = t.context
  const dispatch = sinon.stub().resolves({ status: 'ok' })
  const options = {
    prefix: 'store',
    redis: {
      uri: 'redis://localhost:6379',
    },
    incoming: {
      keyPattern: 'user:*',
    },
  }
  const redisData = { id: 'user1' }
  const expectedAction = {
    type: 'SET',
    payload: { id: 'user1', method: 'hset', key: 'store:user:user1' },
    meta: { ident: { id: 'userFromIntegreat' } },
  }

  const connection = await transporter.connect(options, null, null, emit)
  const ret = await transporter.listen!(
    dispatch,
    connection,
    authenticate,
    emit,
  )
  await redisClient.hSet('store:user:user1', redisData)
  await scheduler.wait(500) // Wait to make sure the change is made before we disconnect
  await transporter.disconnect(connection)

  t.is(ret.status, 'ok', ret.error)
  t.is(dispatch.callCount, 1)
  t.deepEqual(dispatch.args[0][0], expectedAction)
})
