import test from 'ava'

import transporter from '.'

test('should be an Integreat transporter', (t) => {
  t.truthy(transporter)
  t.is(typeof transporter.prepareOptions, 'function')
  t.is(typeof transporter.send, 'function')
  t.is(typeof transporter.connect, 'function')
  t.is(typeof transporter.disconnect, 'function')
})

test('should have minimal prepareOptions implementation', (t) => {
  const endpointOptions = { prefix: 'store' }

  const ret = transporter.prepareOptions(endpointOptions)

  t.deepEqual(ret, endpointOptions)
})
