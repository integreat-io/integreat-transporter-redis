import test from 'ava'

import transporter from './index.js'

// Tests

test('should be an Integreat transporter', (t) => {
  t.truthy(transporter)
  t.is(transporter.authentication, 'asObject')
  t.is(typeof transporter.prepareOptions, 'function')
  t.is(typeof transporter.send, 'function')
  t.is(typeof transporter.connect, 'function')
  t.is(typeof transporter.disconnect, 'function')
})

// Tests -- prepareOptions

test('should have minimal prepareOptions implementation', (t) => {
  const endpointOptions = {
    prefix: 'store',
    incoming: { keyPattern: 'store:entry:*' },
  }
  const serviceId = 'entries'

  const ret = transporter.prepareOptions(endpointOptions, serviceId)

  t.deepEqual(ret, endpointOptions)
})

// Tests -- shouldListen

test('should return true when incoming keyPattern is set in options', (t) => {
  const options = {
    prefix: 'store',
    incoming: {
      keyPattern: 'store:entry:*',
    },
  }

  const ret = transporter.shouldListen!(options)

  t.true(ret)
})

test('should return false when no incoming keyPattern is not set in options', (t) => {
  const options = {
    uri: 'http://foreign.api',
    incoming: {},
  }

  const ret = transporter.shouldListen!(options)

  t.false(ret)
})

test('should return false when no incoming object is not set in options', (t) => {
  const options = {
    uri: 'http://foreign.api',
    incoming: {},
  }

  const ret = transporter.shouldListen!(options)

  t.false(ret)
})
