import test from 'ava'

import serialize from './serialize'

// Tests

test('should serialize request with data', async (t) => {
  const request = {
    action: 'SET',
    data: {
      title: 'Entry 1',
      description: 'The first entry',
      author: { id: 'johnf', name: 'John F.' },
      updateCount: 3,
      draft: false,
      missing: undefined,
      nil: null,
      createdAt: new Date('2019-01-31T18:43:11Z')
    },
    params: { id: 'meta:entries', type: 'meta' }
  }
  const expected = {
    action: 'SET',
    data: {
      title: 'Entry 1',
      description: 'The first entry',
      author: JSON.stringify({ id: 'johnf', name: 'John F.' }),
      updateCount: 3,
      draft: false,
      missing: '',
      nil: '',
      createdAt: '2019-01-31T18:43:11.000Z'
    },
    params: { id: 'meta:entries', type: 'meta' }
  }

  const ret = await serialize(request)

  t.deepEqual(ret, expected)
})

test('should serialize request with array of data', async (t) => {
  const request = {
    action: 'SET',
    data: [
      {
        id: 'ent1',
        title: 'Entry 1',
        updateCount: 3,
        nil: null
      },
      {
        id: 'ent2',
        title: 'Entry 2',
        updateCount: 18,
        nil: undefined
      }
    ],
    params: { id: 'meta:entries', type: 'meta' }
  }
  const expected = {
    action: 'SET',
    data: [
      {
        id: 'ent1',
        title: 'Entry 1',
        updateCount: 3,
        nil: ''
      },
      {
        id: 'ent2',
        title: 'Entry 2',
        updateCount: 18,
        nil: ''
      }
    ],
    params: { id: 'meta:entries', type: 'meta' }
  }

  const ret = await serialize(request)

  t.deepEqual(ret, expected)
})

test('should serialize request with no data', async (t) => {
  const request = {
    action: 'SET',
    params: { id: 'meta:entries', type: 'meta' }
  }
  const expected = {
    action: 'SET',
    data: null,
    params: { id: 'meta:entries', type: 'meta' }
  }

  const ret = await serialize(request)

  t.deepEqual(ret, expected)
})

test('should serialize request with data other than object', async (t) => {
  const request = {
    action: 'SET',
    data: 'invalid',
    params: { id: 'meta:entries', type: 'meta' }
  }
  const expected = {
    action: 'SET',
    data: null,
    params: { id: 'meta:entries', type: 'meta' }
  }

  const ret = await serialize(request)

  t.deepEqual(ret, expected)
})
