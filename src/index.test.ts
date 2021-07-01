import test from 'ava'

import adapter from '.'

test('should be an Integreat adapter', (t) => {
  t.truthy(adapter)
  t.is(typeof adapter.prepareOptions, 'function')
  t.is(typeof adapter.send, 'function')
  t.is(typeof adapter.connect, 'function')
  t.is(typeof adapter.disconnect, 'function')
})

test('should have minimal prepareOptions implementation', (t) => {
  const endpointOptions = { prefix: 'store' }

  const ret = adapter.prepareOptions(endpointOptions)

  t.deepEqual(ret, endpointOptions)
})
