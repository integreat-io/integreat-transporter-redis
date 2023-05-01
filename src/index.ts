import type { Transporter } from 'integreat'
import { createClient } from 'redis'
import connect from './connect.js'
import disconnect from './disconnect.js'
import send from './send/index.js'

const transporter: Transporter = {
  authentication: null,

  prepareOptions: (options, _serviceId) => options,

  connect: connect(createClient),

  send,

  disconnect,
}

export default transporter
