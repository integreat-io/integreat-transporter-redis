import { createClient } from '@redis/client'
import connect from './connect.js'
import disconnect from './disconnect.js'
import send from './send/index.js'
import listen from './listen.js'
import type { Transporter } from 'integreat'
import type { Options } from './types.js'

const transporter: Transporter = {
  authentication: 'asObject',

  prepareOptions: (options, _serviceId) => options,

  connect: connect(createClient),

  send,

  listen,

  // Require a `keyPattern` to start listening
  shouldListen: (options: Options) => !!options.incoming?.keyPattern,

  disconnect,
}

export default transporter
