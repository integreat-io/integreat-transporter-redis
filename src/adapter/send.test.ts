import test from 'ava'
import sinon = require('sinon')

import send from './send'

// Setup

const redisOptions = {
  uri: 'redis://localhost:6379'
}

const wrapInConnection = (redisClient: any) => ({
  status: 'ok',
  redisClient
})

// Tests -- GET

test('should GET from redis', async (t) => {
  const redisData = {
    title: 'Entry 1',
    description: 'The first entry'
  }
  const redisClient = {
    hgetall: sinon.stub().yieldsRight(null, redisData)
  }
  const request = {
    action: 'GET',
    endpoint: {
      redis: redisOptions
    },
    params: {
      type: 'meta',
      id: 'meta:entries'
    }
  }
  const expected = {
    status: 'ok',
    data: redisData
  }

  const ret = await send(request, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
  t.is(redisClient.hgetall.callCount, 1)
  t.deepEqual(redisClient.hgetall.args[0][0], 'meta:entries')
})

test('should prepend prefix to redis hash', async (t) => {
  const redisData = {
    title: 'Entry 1',
    description: 'The first entry'
  }
  const redisClient = {
    hgetall: sinon.stub().yieldsRight(null, redisData)
  }
  const request = {
    action: 'GET',
    endpoint: {
      prefix: 'store',
      redis: redisOptions
    },
    params: {
      type: 'meta',
      id: 'meta:entries'
    }
  }

  await send(request, wrapInConnection(redisClient))

  t.deepEqual(redisClient.hgetall.args[0][0], 'store:meta:entries')
})

test('should return not found for GET on empty data', async (t) => {
  const redisData = {}
  const redisClient = {
    hgetall: sinon.stub().yieldsRight(null, redisData)
  }
  const request = {
    action: 'GET',
    endpoint: {
      redis: redisOptions
    },
    params: {
      type: 'meta',
      id: 'meta:entries'
    }
  }
  const expected = {
    status: 'notfound',
    error: 'Could not find hash \'meta:entries\''
  }

  const ret = await send(request, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
})

test('should return not found for GET with no id', async (t) => {
  const redisClient = {
    hgetall: sinon.stub().yieldsRight(null, null)
  }
  const request = {
    action: 'GET',
    endpoint: {
      redis: redisOptions
    },
    params: {
      type: 'meta'
    }
  }
  const expected = {
    status: 'notfound',
    error: 'Cannot get data with no id'
  }

  const ret = await send(request, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
})

// Tests -- SET

test('should SET to redis', async (t) => {
  const redisClient = {
    hmset: sinon.stub().yieldsRight(null, 'OK')
  }
  const request = {
    action: 'SET',
    endpoint: {
      prefix: 'store',
      redis: redisOptions
    },
    params: {
      type: 'meta'
    },
    data: {
      id: 'ent1',
      title: 'Entry 1',
      description: 'The first entry'
    }
  }
  const expected = {
    status: 'ok',
    data: null
  }
  const expectedArgs = ['title', 'Entry 1', 'description', 'The first entry']

  const ret = await send(request, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
  t.is(redisClient.hmset.callCount, 1)
  t.deepEqual(redisClient.hmset.args[0][0], 'store:ent1')
  t.deepEqual(redisClient.hmset.args[0][1], expectedArgs)
})

test('should SET several items to redis', async (t) => {
  const redisClient = {
    hmset: sinon.stub().yieldsRight(null, 'OK')
  }
  const request = {
    action: 'SET',
    endpoint: {
      prefix: 'store',
      redis: redisOptions
    },
    params: {
      type: 'meta'
    },
    data: [
      {
        id: 'ent1',
        title: 'Entry 1',
        description: 'The first entry'
      },
      {
        id: 'ent2',
        title: 'Entry 2',
        description: 'The second entry'
      }
    ]
  }
  const expected = {
    status: 'ok',
    data: null
  }
  const expectedArgs1 = ['title', 'Entry 1', 'description', 'The first entry']
  const expectedArgs2 = ['title', 'Entry 2', 'description', 'The second entry']

  const ret = await send(request, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
  t.is(redisClient.hmset.callCount, 2)
  t.deepEqual(redisClient.hmset.args[0][0], 'store:ent1')
  t.deepEqual(redisClient.hmset.args[0][1], expectedArgs1)
  t.deepEqual(redisClient.hmset.args[1][0], 'store:ent2')
  t.deepEqual(redisClient.hmset.args[1][1], expectedArgs2)
})

// Tests -- error handling

test('should return error when redis throws on get', async (t) => {
  const redisClient = {
    hgetall: sinon.stub().yieldsRight(new Error('Horror!'), null)
  }
  const request = {
    action: 'GET',
    endpoint: {
      redis: redisOptions
    },
    params: {
      type: 'meta',
      id: 'meta:entries'
    }
  }
  const expected = {
    status: 'error',
    error: 'Error from Redis while getting from hash \'meta:entries\'. Horror!'
  }

  const ret = await send(request, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
})

test('should return error when redis throws on set', async (t) => {
  const redisClient = {
    hmset: sinon.stub().yieldsRight(new Error('Horror!'), null)
  }
  const request = {
    action: 'SET',
    endpoint: {
      redis: redisOptions
    },
    params: {
      type: 'meta',
    },
    data: {
      id: 'ent1',
      title: 'Entry 1'
    }
  }
  const expected = {
    status: 'error',
    error: 'Error from Redis while setting on hash \'ent1\'. Horror!'
  }

  const ret = await send(request, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
})

test('should return error when redis throws on one of more sets', async (t) => {
  const redisClient = {
    hmset: sinon.stub().yieldsRight(null, 'OK')
      .onSecondCall().yieldsRight(new Error('Horror!'), null)
  }
  const request = {
    action: 'SET',
    endpoint: {
      redis: redisOptions
    },
    params: {
      type: 'meta',
    },
    data: [
      {
        id: 'ent1',
        title: 'Entry 1'
      },
      {
        id: 'ent2',
        title: 'Entry 2'
      }
    ]
  }
  const expected = {
    status: 'error',
    error: 'Error from Redis while setting on hash \'ent2\'. Horror! | The rest succeeded'
  }

  const ret = await send(request, wrapInConnection(redisClient))

  t.deepEqual(ret, expected)
})

test('should return error when no connection', async (t) => {
  const request = {
    action: 'GET',
    endpoint: {
      redis: redisOptions
    },
    params: {
      type: 'meta',
      id: 'meta:entries'
    }
  }
  const expected = {
    status: 'error',
    error: 'No redis client given to redis adapter\'s send method'
  }

  const ret = await send(request, null)

  t.deepEqual(ret, expected)
})

test('should return error when no client', async (t) => {
  const request = {
    action: 'GET',
    endpoint: {
      redis: redisOptions
    },
    params: {
      type: 'meta',
      id: 'meta:entries'
    }
  }
  const connection = { status: 'error', error: 'Fail', redisClient: null }
  const expected = {
    status: 'error',
    error: 'No redis client given to redis adapter\'s send method'
  }

  const ret = await send(request, connection)

  t.deepEqual(ret, expected)
})
