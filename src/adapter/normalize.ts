import mapAny = require('map-any')
import { map } from 'ramda'
import { Response, Request, Data, SerializedData } from '.'

const normalizeValue = (value: string) => {
  try {
    return JSON.parse(value)
  } catch (err) {
    return value
  }
}

const isData = (data: any): data is SerializedData => (typeof data === 'object' && data !== null)

export default async function normalize (response: Response, _request: Request): Promise<Response> {
  return {
    ...response,
    data: (isData(response.data))
      ? mapAny(map<SerializedData, Data>(normalizeValue), response.data)
      : null
  }
}
