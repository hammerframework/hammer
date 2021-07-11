import path from 'path'

import type { Handler } from 'aws-lambda'
import bodyParser from 'body-parser'
import type { Application, Request, Response } from 'express'
import glob from 'glob'
import escape from 'lodash.escape'

import { getPaths } from '@redwoodjs/internal'

import { requestHandler } from '../requestHandlers/awsLambda'

export type Lambdas = Record<string, Handler>
const LAMBDA_FUNCTIONS: Lambdas = {}

export const setLambdaFunctions = (foundFunctions: string[]) => {
  for (const fnPath of foundFunctions) {
    const routeName = path.basename(fnPath).replace('.js', '')
    const { handler } = require(fnPath)
    LAMBDA_FUNCTIONS[routeName] = handler
    if (!handler) {
      console.warn(
        routeName,
        'at',
        fnPath,
        'does not have a function called handler defined.'
      )
    }
  }
}

const lambdaRequestHandler = async (req: Request, res: Response) => {
  const { routeName } = req.params
  if (!LAMBDA_FUNCTIONS[routeName]) {
    const errorMessage = `Function "${routeName}" was not found.`
    console.error(errorMessage)
    res.status(404).send(escape(errorMessage))
    return
  }
  return requestHandler(req, res, LAMBDA_FUNCTIONS[routeName])
}

const withFunctions = (app: Application, apiRootPath: string) => {
  app.use(
    bodyParser.text({
      type: ['text/*', 'application/json', 'multipart/form-data'],
      limit: process.env.BODY_PARSER_LIMIT,
    })
  )

  app.use(
    bodyParser.raw({
      type: '*/*',
      limit: process.env.BODY_PARSER_LIMIT,
    })
  )

  const rwjsPaths = getPaths()

  console.log('Importing API... ')
  const ts = Date.now()
  const apiFunctions = glob.sync('dist/functions/*.{ts,js}', {
    cwd: rwjsPaths.api.base,
    absolute: true,
  })
  setLambdaFunctions(apiFunctions)
  console.log('Imported in', Date.now() - ts, 'ms')

  app.all(`${apiRootPath}:routeName`, lambdaRequestHandler)
  app.all(`${apiRootPath}:routeName/*`, lambdaRequestHandler)

  return app
}

export default withFunctions
