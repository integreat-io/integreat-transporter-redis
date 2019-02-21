import test from 'ava'

import adapter from '.'

test('should be an Integreat adapter', (t) => {
  t.truthy(adapter)
  t.is(typeof adapter.prepareEndpoint, 'function')
  t.is(typeof adapter.send, 'function')
  t.is(typeof adapter.normalize, 'function')
  t.is(typeof adapter.serialize, 'function')
  t.is(typeof adapter.connect, 'function')
  t.is(typeof adapter.disconnect, 'function')
})

test('should have minimal prepareEndpoint implementation', (t) => {
  const endpointOptions = { prefix: 'store' }

  const ret = adapter.prepareEndpoint(endpointOptions)

  t.deepEqual(ret, endpointOptions)
})

test('should merge endpointOptions with serviceOptions', (t) => {
  const serviceOptions = { prefix: 'service', redis: { port: '8888' } }
  const endpointOptions = { prefix: 'store' }
  const expected = { prefix: 'store', redis: { port: '8888' } }

  const ret = adapter.prepareEndpoint(endpointOptions, serviceOptions)

  t.deepEqual(ret, expected)
})

test('should return null as connection', async (t) => {
  const ret = await adapter.connect({}, {}, null)

  t.is(ret, null)
})

test('should do nothing when callling disconnect', async (t) => {
  const ret = await adapter.disconnect(null)

  t.is(ret, undefined)
})
