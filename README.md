# Redis transporter for Integreat

Transporter that lets
[Integreat](https://github.com/integreat-io/integreat) access content in a Redis
database.

[![npm Version](https://img.shields.io/npm/v/integreat-transporter-redis.svg)](https://www.npmjs.com/package/integreat-transporter-redis)
[![Maintainability](https://qlty.sh/gh/integreat-io/projects/integreat-transporter-redis/maintainability.svg)](https://qlty.sh/gh/integreat-io/projects/integreat-transporter-redis)

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

Available options:

- `useTypeAsPrefix`: When set to `true`, the key will be made up of
  `<type>:<id>`, where `type` and `id` are properties on the action `payload`.
  Otherwise, the key will just be the `id`. Default is `true`.
- `prefix`: A prefix used with all Redis keys. The prefix and the key will be
  separated by colon `:`. This prefix is added even when `useTypeAsPrefix` is
  `true` and comes in from of the type prefix. Default is no prefix.
- `concurrency`: When fetching more keys in one action, you may specify how many
   to fetch in parallel with the `concurrency` option. The default is `1`,
   meaning they will be fetching in sequence.
- `connectionTimeout`: When set to a number of milliseconds, the Redis
  connection will be renewed after this timeout regardless of the state of the
  connection.
- `incoming`: See [Listening to changes](#listening-to-changes) below.

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

#### Fetching keys and values

You may fetch a single key from Redis with an `id`, several keys with an array
of ids on `id`, or all keys starting with the prefix and type (if
`useTypeAsPrefix` is `true` or not set). When fetching all keys, the keys will
be sorted alphabetically.

By default, all fields on the key is fetched (using `hgetall`), but you may also
fetch only the ids of the keys, by setting `onlyIds` to `true`. This does not
make a lot of sense when you're fetching by id or ids, but could be useful when
fetching a collection of keys.

Each key is fetched with a separate call to Redis, and you may specify how many
to fetch in parallel with the `concurrency` option. The default is `1`.

#### Fetching with patterns

In addition, you may fetch keys with a pattern, by setting the `pattern` option
to a string, which may be one or more key "segments" separated by a colon `':'`.
This string is appended to the prefix and type (if `useTypeAsPrefix` is `true`
or not set), and used as a pattern to fetch keys. Behind the scenes `':*'` is
appended too. For example, if the prefix is `'store'` and the type is
`'product'`, the pattern `'category:shoes'` will fetch keys with the pattern
`'store:product:category:shoes:*'`.

The keys will be sorted alphabetically.

This may be combined with `onlyIds` to only fetch the ids of the matching keys.

#### Setting keys and values

When dispatching a `SET` action with one or more data items, the `id` of each
data item will be used as the key in Redis, possibly prefixed with the `prefix`
option and the `type` (if `useTypeAsPrefix` is `true` or not set).

#### Pinging Redis

To send a [PING command](https://redis.io/docs/latest/commands/ping/) to Redis,
dispatch a `SERVICE` action with type `ping`:

```javascript
const response = await great.dispatch({
  type: 'SERVICE',
  payload: { type: 'ping' },
})
```

`response.data` will hold the response data from Redis.

#### Sending and listening to pub/sub messages

Redis supports posting messages to a pub/sub channel. To post a message you
dispatch a `SET` action with method `'pubsub'`, the channel as `channel`, and
the message as `data`. `data` will be forced to a string, so it's usually best
to provide it as a string to have control over how it is stringified.

To listen to messages on a channnel, you configure a listen endpoint on a
service with the desired channel. Set `channel` in the `incoming` object on
`options` on the service. When the Integreat instance is set up, call `listen()`
on the instance, and Integreat will dispatch a `SET` action for each message
comming on the queue. The payload of the action will have `'pubsub'` as
`method`, the channel as `channel`, and the message as `data`.

In other words, the `SET` action dispatch to send a message to the channel, is
exactly like the `SET` action you receive when you listen to a channel, so it
will be like you're dispatching the action to your listeners.

If you set a `prefix` on the service options, the channel you provide will be
prefixed with it, separated by a colon (`:`).

Note that you set both `channel` and `prefix` on the service, not on the
endpoints, and for now an incoming message action will match any endpoint, so
you should have only one endpoint for a listening service to avoid unexpected
behavior if we open up for having more specific endpoints in the future.

Also, we only allow one incoming `channel` per service, and any `keyPattern`
will be disregarded when `channel` is set. This may also change in the future.

The Redis pub/sub has an _at-most-once_ policy, meaning that you will never get
duplicate messages, but that you _may_ loose a message. See the [Redis pub/sub docs](https://redis.io/docs/latest/develop/pubsub/)
for more details.

#### Listening to changes

The Redis transporter supports listening to changes in the database. To enable
this, set the `keyPattern` in the `incoming` object on service `options`. When
the Integreat instance is set up, call `listen()` on the instance, and Integreat
will dispatch `SET` action to changes to keys matching the pattern.

If a `prefix` is set on the service `options`, the `keyPattern` will be prefixed
with it, separated by a colon (`:`).

We only listen for `hset` changes for now.

Note that we only listen to one `keyPattern` per service right now, and we
disregard any `keyPattern` or `prefix` set on endpoint `options`. The dispatched
action will match any endpoint regardless of what is specified on the endpoint.
In the future we may allow different patterns and prefixes for different
endpoints and direct the dispatched action to the correct endpoint, so only
specify this on the service to make sure you are future compatible.

Also, you may not listen to both `channel` and `keyPattern` on the same service,
and `channel` will be preferred.

If the Redis database is not configured to send notifications, it will be
enabled automatically. The `notify-keyspace-events` letters `'E'` (keyevent
events) and `'h'` (hash commands) will be added when `listen()` is run. See the
[Redis keyspace notification docs](https://redis.io/docs/latest/develop/pubsub/keyspace-notifications/)
for more.

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
