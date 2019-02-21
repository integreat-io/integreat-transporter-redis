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

export default async function normalize (response: Response, _request: Request) {
  return {
    ...response,
    data: (isData(response.data)) ? map<SerializedData, Data>(normalizeValue, response.data) : null
  }
}
