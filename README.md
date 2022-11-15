# Redis transporter for Integreat

Transporter that lets
[Integreat](https://github.com/integreat-io/integreat) access content in a Redis
database.

[![npm Version](https://img.shields.io/npm/v/integreat-transporter-redis.svg)](https://www.npmjs.com/package/integreat-transporter-redis)
[![Build Status](https://travis-ci.org/integreat-io/integreat-transporter-redis.svg?branch=master)](https://travis-ci.org/integreat-io/integreat-transporter-redis)
[![Coverage Status](https://coveralls.io/repos/github/integreat-io/integreat-transporter-redis/badge.svg?branch=master)](https://coveralls.io/github/integreat-io/integreat-transporter-redis?branch=master)
[![Dependencies Status](https://tidelift.com/badges/github/integreat-io/integreat-transporter-redis?style=flat)](https://tidelift.com/repo/github/integreat-io/integreat-transporter-redis)
[![Maintainability](https://api.codeclimate.com/v1/badges/6331723a6ff61de5f232/maintainability)](https://codeclimate.com/github/integreat-io/integreat-transporter-redis/maintainability)

## Getting started

### Prerequisits

Requires node v14 and Integreat v0.8.

### Installing and using

Install from npm:

```
npm install integreat-transporter-redis
```

Example of use:

```javascript
import Integreat, { authenticators, transformers } from 'integreat'
import redis from 'integreat-transporter-redis'
import defs from './config'

const resources = {
  authenticators,
  transformers,
  transporters: { redis: redis },
}
const great = Integreat.create(defs, resources)

// ... and then dispatch actions as usual
```

Example source configuration:

```javascript
{
  id: 'store',
  transporter: 'redis',
  endpoints: [{
    options: {
      prefix: 'store',
      redis: { url: 'redis://localhost:6379' },
      concurrency: 5
      useTypeAsPrefix: true // Default is `true`
    }
  }]
}
```

The `redis` endpoint options are sent as-is to `redis.createClient()`.
[See node_redis documentation for options](https://github.com/redis/node-redis/blob/d09732280b1ed1e41cb53b687ed04a6be0fff8ab/docs/client-configuration.md).

### Running the tests

The tests can be run with `npm test`.

## Contributing

Please read
[CONTRIBUTING](https://github.com/integreat-io/integreat-transporter-redis/blob/master/CONTRIBUTING.md)
for details on our code of conduct, and the process for submitting pull
requests.

## License

This project is licensed under the ISC License - see the
[LICENSE](https://github.com/integreat-io/integreat-transporter-redis/blob/master/LICENSE)
file for details.
