import path from 'path'

import c from 'ansi-colors'
import type { Handler } from 'aws-lambda'
import bodyParser from 'body-parser'
import type { Application, Request, Response } from 'express'
import fg from 'fast-glob'
import escape from 'lodash.escape'

import { getPaths } from '@redwoodjs/internal'

import { requestHandler } from '../requestHandlers/awsLambda'

export type Lambdas = Record<string, Handler>
const LAMBDA_FUNCTIONS: Lambdas = {}

// TODO: Use v8 caching to load these crazy fast.
const loadFunctionsFromDist = async () => {
  const rwjsPaths = getPaths()
  const serverFunctions = fg.sync('dist/functions/*.{ts,js}', {
    cwd: rwjsPaths.api.base,
    absolute: true,
  })
  // Place `GraphQL` serverless function at the start.
  const i = serverFunctions.findIndex((x) => x.indexOf('graphql') !== -1)
  if (i >= 0) {
    const graphQLFn = serverFunctions.splice(i, 1)[0]
    serverFunctions.unshift(graphQLFn)
  }
  await setLambdaFunctions(serverFunctions)
}

// Import the API functions and add them to the LAMBDA_FUNCTIONS object
export const setLambdaFunctions = async (foundFunctions: string[]) => {
  const tsImport = Date.now()
  console.log(c.italic(c.dim('Importing Server Functions... ')))

  const imports = foundFunctions.map((fnPath) => {
    return new Promise((resolve) => {
      const ts = Date.now()
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
      // TODO: Use terminal link.
      console.log(
        c.magenta('/' + routeName),
        c.italic(c.dim(Date.now() - ts + ' ms'))
      )
      return resolve(true)
    })
  })

  Promise.all(imports).then((_results) => {
    console.log(
      c.italic(c.dim('... Imported in ' + (Date.now() - tsImport) + ' ms'))
    )
  })
}

const lambdaRequestHandler = async (req: Request, res: Response) => {
  const { routeName } = req.params
  if (!LAMBDA_FUNCTIONS[routeName]) {
    const errorMessage = `Function "${routeName}" was not found.`
    console.error(errorMessage)
    res.status(404)

    if (process.env.NODE_ENV === 'development') {
      const devError = {
        error: errorMessage,
        availableFunctions: Object.keys(LAMBDA_FUNCTIONS),
      }
      res.json(devError)
    } else {
      res.send(escape(errorMessage))
    }

    return
  }
  return requestHandler(req, res, LAMBDA_FUNCTIONS[routeName])
}

const withFunctions = async (app: Application, apiRootPath: string) => {
  // TODO: Fix these deprecations.
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

  app.all(`${apiRootPath}:routeName`, lambdaRequestHandler)
  app.all(`${apiRootPath}:routeName/*`, lambdaRequestHandler)

  await loadFunctionsFromDist()

  return app
}

export default withFunctions
