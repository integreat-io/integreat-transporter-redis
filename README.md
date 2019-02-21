# Redis adapter for Integreat

Adapter that lets
[Integreat](https://github.com/integreat-io/integreat) access content in a Redis
database.

[![npm Version](https://img.shields.io/npm/v/integreat-adapter-redis.svg)](https://www.npmjs.com/package/integreat-adapter-redis)
[![Build Status](https://travis-ci.org/integreat-io/integreat-adapter-redis.svg?branch=master)](https://travis-ci.org/integreat-io/integreat-adapter-redis)
[![Coverage Status](https://coveralls.io/repos/github/integreat-io/integreat-adapter-redis/badge.svg?branch=master)](https://coveralls.io/github/integreat-io/integreat-adapter-redis?branch=master)
[![Dependencies Status](https://tidelift.com/badges/github/integreat-io/integreat-adapter-redis?style=flat)](https://tidelift.com/repo/github/integreat-io/integreat-adapter-redis)
[![Maintainability](https://api.codeclimate.com/v1/badges/6331723a6ff61de5f232/maintainability)](https://codeclimate.com/github/integreat-io/integreat-adapter-redis/maintainability)

## Getting started

### Prerequisits

Requires node v8.6 and Integreat v0.7.

### Installing and using

Install from npm:

```
npm install integreat-adapter-redis
```

Example of use:
```javascript
const integreat = require('integreat')
const redisAdapter = require('integreat-adapter-redis')
const defs = require('./config')

const resources = integreat.resources(redisAdapter)
const great = integreat(defs, resources)

// ... and then dispatch actions as usual
```

Example source configuration:

```javascript
{
  id: 'store',
  adapter: 'redis',
  endpoints: [
    { options: { redis: { host: 'localhost', port: 6789 } } }
  ]
}
```

The `redis` endpoint options are sent as-is to `redis.createClient()`.
[See node_redis documentation for options](https://github.com/NodeRedis/node_redis#options-object-properties).

### Running the tests

The tests can be run with `npm test`.

## Contributing

Please read
[CONTRIBUTING](https://github.com/integreat-io/integreat-adapter-redis/blob/master/CONTRIBUTING.md)
for details on our code of conduct, and the process for submitting pull
requests.

## License

This project is licensed under the ISC License - see the
[LICENSE](https://github.com/integreat-io/integreat-adapter-redis/blob/master/LICENSE)
file for details.
