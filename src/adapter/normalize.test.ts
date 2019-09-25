import test from 'ava'

import normalize from './normalize'

// Setup

const request = {
  action: 'GET',
  data: null
}

// Tests

test('should normalize response with data', async (t) => {
  const response = {
    status: 'ok',
    data: {
      title: 'Entry 1',
      description: 'The first entry',
      author: JSON.stringify({ id: 'johnf', name: 'John F.' }),
      updateCount: '3',
      draft: 'false',
      missing: '',
      nil: '',
      createdAt: '2019-01-31T18:43:11.000Z'
    }
  }
  const expected = {
    status: 'ok',
    data: {
      title: 'Entry 1',
      description: 'The first entry',
      author: { id: 'johnf', name: 'John F.' },
      updateCount: 3,
      draft: false,
      missing: '',
      nil: '',
      createdAt: '2019-01-31T18:43:11.000Z'
    }
  }

  const ret = await normalize(response, request)

  t.deepEqual(ret, expected)
})

test('should normalize response with data array', async (t) => {
  const response = {
    status: 'ok',
    data: [
      {
        id: 'ent1',
        title: 'Entry 1',
        updateCount: '3',
        nil: ''
      },
      {
        id: 'ent2',
        title: 'Entry 2',
        updateCount: '18',
        nil: ''
      }
    ]
  }
  const expected = {
    status: 'ok',
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
    ]
  }

  const ret = await normalize(response, request)

  t.deepEqual(ret, expected)
})

test('should normalize response with no data', async (t) => {
  const response = {
    status: 'ok',
    data: undefined
  }
  const expected = {
    status: 'ok',
    data: null
  }

  const ret = await normalize(response, request)

  t.deepEqual(ret, expected)
})
