import { existsSync, readFileSync } from 'fs-extra'
import { Location, Range } from 'vscode-languageserver'

import { URL_file, URL_toFile } from './URL'
import { Position_fromOffsetOrFail } from './vscode-languageserver-types'

/**
 * find "env()" expressions in a prisma file using regex
 * @param prismaSchemaFilePath
 */
export function* prisma_parseEnvExpressionsInFile(
  prismaSchemaFilePath: string
) {
  const uri = URL_file(prismaSchemaFilePath)
  const file = URL_toFile(uri) // convert back and forth in case someone passed a uri
  if (!existsSync(file)) return [] // fail silently
  const src = readFileSync(file).toString()
  const exprs = prisma_parseEnvExpressions(src)
  for (const { range, key } of exprs) {
    const location: Location = { uri, range }
    yield { location, key }
  }
}

/**
 * find "env()" expressions in a prisma file using regex
 * @param src
 */
export function* prisma_parseEnvExpressions(src: string) {
  const re = /env\(([^)]+)\)/gm
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const match of (src as any).matchAll(re)) {
    try {
      const start = Position_fromOffsetOrFail(match.index, src)
      const end = Position_fromOffsetOrFail(match.index + match[0].length, src)
      const range = Range.create(start, end)
      const key = JSON.parse(match[1])
      yield { range, key }
    } catch (e) {
      // we don't care about malformed env() calls
      // that should be picked up by the prisma parser
    }
  }
}
