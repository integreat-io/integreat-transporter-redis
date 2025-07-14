/* eslint-disable @typescript-eslint/no-non-null-assertion */
import test from 'node:test'
import assert from 'node:assert/strict'

import transporter from './index.js'

// Tests

test('should be an Integreat transporter', () => {
  assert.equal(transporter.authentication, 'asObject')
  assert.equal(typeof transporter.prepareOptions, 'function')
  assert.equal(typeof transporter.send, 'function')
  assert.equal(typeof transporter.connect, 'function')
  assert.equal(typeof transporter.disconnect, 'function')
})

// Tests -- prepareOptions

test('should have minimal prepareOptions implementation', () => {
  const endpointOptions = {
    prefix: 'store',
    incoming: { keyPattern: 'store:entry:*' },
  }
  const serviceId = 'entries'

  const ret = transporter.prepareOptions(endpointOptions, serviceId)

  assert.deepEqual(ret, endpointOptions)
})

// Tests -- shouldListen

test('should return true when incoming keyPattern is set in options', () => {
  const options = {
    prefix: 'store',
    incoming: {
      keyPattern: 'store:entry:*',
    },
  }

  const ret = transporter.shouldListen!(options)

  assert.ok(ret)
})

test('should return true when incoming channel is set in options', () => {
  const options = {
    prefix: 'store',
    incoming: {
      channel: 'msg',
    },
  }

  const ret = transporter.shouldListen!(options)

  assert.ok(ret)
})

test('should return false when no incoming keyPattern is not set in options', () => {
  const options = {
    uri: 'http://foreign.api',
    incoming: {},
  }

  const ret = transporter.shouldListen!(options)

  assert.ok(!ret)
})

test('should return false when no incoming object is not set in options', () => {
  const options = {
    uri: 'http://foreign.api',
    incoming: {},
  }

  const ret = transporter.shouldListen!(options)

  assert.ok(!ret)
})
