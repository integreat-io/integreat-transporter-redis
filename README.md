# Redis transporter for Integreat

Transporter that lets
[Integreat](https://github.com/integreat-io/integreat) access content in a Redis
database.

[![npm Version](https://img.shields.io/npm/v/integreat-transporter-redis.svg)](https://www.npmjs.com/package/integreat-transporter-redis)
[![Maintainability](https://api.codeclimate.com/v1/badges/ec5c6ab91498f0c064ab/maintainability)](https://codeclimate.com/github/integreat-io/integreat-transporter-redis/maintainability)

## Getting started

### Prerequisits

Requires node v18 and Integreat v1.0.

### Installing and using

Install from npm:

```
npm install integreat-transporter-redis
```

Example of use:

```javascript
import Integreat from 'integreat'
import redisbullTransporter from 'integreat-transport-redis'
import defs from './config'

const great = Integreat.create(defs, {
  transporters: { bull: redisTransporter() },
})

// ... and then dispatch actions as usual
```

Example source configuration:

```javascript
{
  id: 'store',
  transporter: 'redis',
  auth: true,
  endpoints: [{
    options: {
      prefix: 'store',
      redis: { uri: 'redis://localhost:6379' },
      concurrency: 5
      useTypeAsPrefix: true // Default is `true`
    }
  }]
}
```

The available properties for the `redis` options object are as follow:

- `uri`: The entire URL of Redis database
- `host`: The Redis server hostname, default is `localhost`
- `port`: The Redis server port, default is `6379`
- `database`: The Redis database number. Get this in Redis with [`SELECT index`](https://redis.io/commands/select/)
- `auth`: The Redis username as `key` and Redis password as `secret`
- `tls`: Set to `true` to enable TLS. Default is `false`

You may choose to set the `uri` or specify the individual properties.

Redis options can also be given the credentials, i.e. the `key` and `secret`
values, through an authenticator, like the `options` authenticator.

#### Listening to changes

The Redis transporter supports listening to changes in the database. To enable
this, set the `keyPattern` in the `incoming` object on `options`. When the
Integreat instance is set up, call `listen()` on the instance, and Integreat
will dispatch `SET` action to changes to keys matching the pattern.

Note that we only listen for `hset` changes for now.

### Debugging

Run Integreat with env variable `DEBUG=integreat:transporter:redis`, to receive
debug messages.

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
