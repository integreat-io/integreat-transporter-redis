/* eslint-disable @typescript-eslint/no-non-null-assertion */
import test from 'node:test'
import assert from 'node:assert/strict'
import { scheduler } from 'node:timers/promises'
import sinon from 'sinon'
import { createClient } from '@redis/client'

import transporter from '../index.js'

// Setup

const emit = () => undefined
const authenticate = async () => ({
  status: 'ok',
  access: { ident: { id: 'userFromIntegreat' } },
})

test('listen', async (t) => {
  const redisClient = createClient()
  await redisClient.connect()

  t.after(async () => {
    if (redisClient) {
      await redisClient.del('store:user:user1')
      await redisClient.quit()
    }
  })

  // Tests

  await t.test('should listen and receive item with id on update', async () => {
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

    assert.equal(ret.status, 'ok', ret.error)
    assert.equal(dispatch.callCount, 1)
    assert.deepEqual(dispatch.args[0][0], expectedAction)
  })
})
