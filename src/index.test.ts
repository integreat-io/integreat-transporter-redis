import test from 'ava'

import transporter from './index.js'

test('should be an Integreat transporter', (t) => {
  t.truthy(transporter)
  t.is(transporter.authentication, 'asObject')
  t.is(typeof transporter.prepareOptions, 'function')
  t.is(typeof transporter.send, 'function')
  t.is(typeof transporter.connect, 'function')
  t.is(typeof transporter.disconnect, 'function')
})

test('should have minimal prepareOptions implementation', (t) => {
  const endpointOptions = { prefix: 'store' }
  const serviceId = 'entries'

  const ret = transporter.prepareOptions(endpointOptions, serviceId)

  t.deepEqual(ret, endpointOptions)
})
