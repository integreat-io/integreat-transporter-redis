const useType = (useTypeAsPrefix: boolean, type?: string | string[]) =>
  useTypeAsPrefix && typeof type === 'string' ? type : undefined

export const combineHashParts = (...parts: (string | undefined)[]) =>
  parts.filter(Boolean).join(':')

export const generateId =
  (prefix?: string, type?: string | string[], useTypeAsPrefix = true) =>
  (id: string, idType?: string) =>
    combineHashParts(prefix, useType(useTypeAsPrefix, idType || type), id)
