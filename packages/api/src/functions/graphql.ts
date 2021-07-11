import type {
  Context,
  ContextFunction,
  GraphQLRequestContext,
} from 'apollo-server-core'
import { ApolloServer } from 'apollo-server-lambda'
import type { Config, CreateHandlerOptions } from 'apollo-server-lambda'
import type { ApolloServerPlugin } from 'apollo-server-plugin-base'
import type { APIGatewayProxyEvent, Context as LambdaContext } from 'aws-lambda'
import depthLimit from 'graphql-depth-limit'
import { BaseLogger } from 'pino'
import { v4 as uuidv4 } from 'uuid'

import type { AuthContextPayload } from 'src/auth'
import { getAuthenticationContext } from 'src/auth'
import {
  GlobalContext,
  setContext,
  getPerRequestContext,
  usePerRequestContext,
} from 'src/globalContext'

export type GetCurrentUser = (
  decoded: AuthContextPayload[0],
  raw: AuthContextPayload[1],
  req?: AuthContextPayload[2]
) => Promise<null | Record<string, unknown> | string>

/**
 * Settings for limiting the complexity of the queries solely by their depth.
 * Use by graphql-depth-limit,
 *
 * @see https://github.com/stems/graphql-depth-limit
 */
type DepthLimitOptions = { maxDepth: number; ignore?: string[] }

/**
 * Options for request and response information to include in the log statements
 * output by UseRedwoodLogger around the execution event
 *
 * @param data - Include response data sent to client.
 * @param operationName - Include operation name.
 * @param requestId - Include the event's requestId, or if none, generate a uuid as an identifier.
 * @param query - Include the query. This is the query or mutation (with fields) made in the request.
 * @param tracing - Include the tracing and timing information.
 * @param userAgent - Include the browser (or client's) user agent.
 */
type GraphQLLoggerOptions = {
  /**
   * @description Include response data sent to client.
   */
  data?: boolean

  /**
   * @description Include operation name.
   *
   * The operation name is a meaningful and explicit name for your operation. It is only required in multi-operation documents,
   * but its use is encouraged because it is very helpful for debugging and server-side logging.
   * When something goes wrong (you see errors either in your network logs, or in the logs of your GraphQL server)
   * it is easier to identify a query in your codebase by name instead of trying to decipher the contents.
   * Think of this just like a function name in your favorite programming language.
   *
   * @see https://graphql.org/learn/queries/#operation-name
   */
  operationName?: boolean

  /**
   * @description Include the event's requestId, or if none, generate a uuid as an identifier.
   *
   * The requestId can be helpful when contacting your deployment provider to resolve issues when encountering errors or unexpected behavior.
   */
  requestId?: boolean

  /**
   * @description Include the query. This is the query or mutation (with fields) made in the request.
   */
  query?: boolean

  /**
   * @description Include the tracing and timing information.
   *
   * This will log various performance timings withing the GraphQL event lifecycle (parsing, validating, executing, etc).
   */
  tracing?: boolean

  /**
   * @description Include the browser (or client's) user agent.
   *
   * This can be helpful to know what type of client made the request to resolve issues when encountering errors or unexpected behavior.
   */
  userAgent?: boolean
}

/**
 * Configure the logger used by the GraphQL server.
 *
 * @param logger your logger
 * @param options the GraphQLLoggerOptions such as tracing, operationName, etc
 */
type LoggerConfig = { logger: BaseLogger; options?: GraphQLLoggerOptions }
/**
 * This plugin logs every time an operation is being executed and
 * when the execution of the operation is done.
 *
 * It adds information using a child logger from the context
 * such as the operation name, request id, errors, and header info
 * to help trace and diagnose issues.
 *
 * Tracing and timing information can be set in LoggerConfig options.
 *
 * @see https://www.apollographql.com/docs/apollo-server/integrations/plugins/
 * @returns
 */
const UseRedwoodLogger = (loggerConfig?: LoggerConfig): ApolloServerPlugin => {
  return {
    requestDidStart(requestContext: GraphQLRequestContext) {
      const logger = requestContext.logger as BaseLogger

      const includeData = loggerConfig?.options?.data
      const includeOperationName = loggerConfig?.options?.operationName
      const includeRequestId = loggerConfig?.options?.requestId
      const includeTracing = loggerConfig?.options?.tracing
      const includeUserAgent = loggerConfig?.options?.userAgent
      const includeQuery = loggerConfig?.options?.query

      if (!logger) {
        return
      }

      const childLoggerOptions = {} as any

      if (includeUserAgent) {
        childLoggerOptions['userAgent'] =
          requestContext.request.http?.headers.get('user-agent') as string
      }

      if (includeQuery) {
        childLoggerOptions['query'] = requestContext.request.query
      }

      const childLogger = logger.child({
        name: 'apollo-graphql-server',
        ...childLoggerOptions,
      })

      const options = {} as any

      if (includeTracing) {
        options['metrics'] = requestContext.metrics
      }

      childLogger.info({ ...options }, 'GraphQL requestDidStart')

      return {
        executionDidStart(requestContext: GraphQLRequestContext) {
          const options = {} as any

          if (includeOperationName) {
            options['operationName'] = requestContext.operationName
          }

          if (includeRequestId) {
            options['requestId'] =
              requestContext.request.http?.headers.get('x-amz-request-id') ||
              uuidv4()
          }

          childLogger.debug({ ...options }, 'GraphQL executionDidStart')
        },
        willSendResponse(requestContext: GraphQLRequestContext) {
          const options = {} as any

          if (includeData) {
            options['data'] = requestContext.response?.data
          }

          if (includeOperationName && requestContext.operationName) {
            options['operationName'] = requestContext.operationName
          }

          if (includeRequestId) {
            options['requestId'] =
              requestContext.request.http?.headers.get('x-amz-request-id') ||
              uuidv4()
          }

          if (includeTracing) {
            options['tracing'] = requestContext.response?.extensions?.tracing
          }

          childLogger.info({ ...options }, 'GraphQL willSendResponse')
        },
        didEncounterErrors(requestContext: GraphQLRequestContext) {
          const options = {} as any

          if (includeOperationName) {
            options['operationName'] = requestContext.operationName
          }

          if (includeRequestId) {
            options['requestId'] =
              requestContext.request.http?.headers.get('x-amz-request-id') ||
              uuidv4()
          }

          if (includeTracing) {
            options['tracing'] = requestContext.response?.extensions?.tracing
          }
          childLogger.error(
            {
              errors: requestContext.errors,
              ...options,
            },
            'GraphQL didEncounterErrors'
          )
        },
      }
    },
  }
}

/**
 * We use Apollo Server's `context` option as an entry point to construct our
 * own global context.
 *
 * Context explained by Apollo's Docs:
 * Context is an object shared by all resolvers in a particular query,
 * and is used to contain per-request state, including authentication information,
 * dataloader instances, and anything else that should be taken into account when
 * resolving the query.
 */
export const createContextHandler = (
  userContext?: Context | ContextFunction,
  getCurrentUser?: GetCurrentUser
) => {
  return async ({
    event,
    context,
  }: {
    event: APIGatewayProxyEvent
    context: GlobalContext & LambdaContext
  }) => {
    // Prevent the Serverless function from waiting for all resources (db connections)
    // to be released before returning a response.
    context.callbackWaitsForEmptyEventLoop = false

    // If the request contains authorization headers, we'll decode the providers that we support,
    // and pass those to the `currentUser`.
    const authContext = await getAuthenticationContext({ event, context })
    if (authContext) {
      context.currentUser = getCurrentUser
        ? await getCurrentUser(authContext[0], authContext[1], authContext[2])
        : authContext
    }

    let customUserContext = userContext
    if (typeof userContext === 'function') {
      // if userContext is a function, run that and return just the result
      customUserContext = await userContext({ event, context })
    }
    // Sets the **global** context object, which can be imported with:
    // import { context } from '@redwoodjs/api'
    return setContext({
      ...context,
      ...customUserContext,
    })
  }
}

/**
 * GraphQLHandlerOptions
 */
interface GraphQLHandlerOptions extends Config {
  /**
   * @description  Modify the resolver and global context.
   */
  context?: Context | ContextFunction

  /**
   * @description  An async function that maps the auth token retrieved from the request headers to an object.
   * Is it executed when the `auth-provider` contains one of the supported providers.
   */
  getCurrentUser?: GetCurrentUser

  /**
   * @description  A callback when an unhandled exception occurs. Use this to disconnect your prisma instance.
   */
  onException?: () => void

  /**
   * @description  CORS configuration
   */
  cors?: CreateHandlerOptions['cors']

  /**
   * @description  Customize GraphQL Logger with options
   */
  loggerConfig?: LoggerConfig

  /**
   * @description  Healthcheck
   */
  onHealthCheck?: CreateHandlerOptions['onHealthCheck']

  /**
   * @description  Limit the complexity of the queries solely by their depth.
   * @see https://www.npmjs.com/package/graphql-depth-limit#documentation
   */
  depthLimitOptions?: DepthLimitOptions

  /**
   * @description  Custom Apollo Server plugins
   */
  extraPlugins?: ApolloServerPlugin[]
}

/**
 * Creates an Apollo GraphQL Server.
 *
 * @param options - GraphQLHandlerOptions
 *
 * @example
 * ```js
 * export const handler = createGraphQLHandler({
 *  loggerConfig: { logger, options: {} },
 *  schema: makeMergedSchema({
 *    schemas,
 *    services: makeServices({ services }),
 *  }),
 *  onException: () => {
 *    // Disconnect from your database with an unhandled exception.
 *    db.$disconnect()
 *  },
 * })
 * ```
 */
export const createGraphQLHandler = ({
  context,
  getCurrentUser,
  onException,
  cors,
  loggerConfig,
  onHealthCheck,
  extraPlugins,
  depthLimitOptions,
  ...options
}: GraphQLHandlerOptions = {}) => {
  const isDevEnv = process.env.NODE_ENV === 'development'

  const logger = options.logger || (loggerConfig && loggerConfig.logger)

  const plugins = options.plugins || []

  if (logger) {
    plugins.push(UseRedwoodLogger(loggerConfig))
  }

  if (extraPlugins && extraPlugins.length > 0) {
    plugins.push(...extraPlugins)
  }

  // extract depth limit configuration and use a sensible default
  const ignore = (depthLimitOptions && depthLimitOptions.ignore) || []
  const maxDepth = (depthLimitOptions && depthLimitOptions.maxDepth) || 10

  const validationRules = options.validationRules || []

  validationRules.push(depthLimit(maxDepth, { ignore }))

  const handler = new ApolloServer({
    // Turn off playground, introspection and debug in production.
    debug: isDevEnv,
    introspection: isDevEnv,
    logger,
    playground: isDevEnv,
    plugins,
    // Log trace timings if set in loggerConfig
    tracing: loggerConfig?.options?.tracing,
    // Limits the depth of your GraphQL selection sets.
    validationRules,
    // Log the errors in the console
    formatError: (error) => {
      if (isDevEnv) {
        // I want the dev-server to pick this up!?
        // TODO: Move the error handling into a separate package
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        import('@redwoodjs/dev-server/dist/error')
          .then(({ handleError }) => {
            return handleError(error.originalError as Error)
          })
          .then(console.log)
          .catch(() => {})
      }
      return error
    },
    // Wrap the user's context function in our own
    context: createContextHandler(context, getCurrentUser),
    ...options,
  }).createHandler({ cors, onHealthCheck })

  return (
    event: APIGatewayProxyEvent,
    context: LambdaContext,
    callback: any
  ): void => {
    if (usePerRequestContext()) {
      // This must be used when you're self-hosting RedwoodJS.
      const localAsyncStorage = getPerRequestContext()
      localAsyncStorage.run(new Map(), () => {
        try {
          handler(event, context, callback)
        } catch (e) {
          onException && onException()
          throw e
        }
      })
    } else {
      // This is OK for AWS (Netlify/Vercel) because each Lambda request
      // is handled individually.
      try {
        handler(event, context, callback)
      } catch (e) {
        onException && onException()
        throw e
      }
    }
  }
}
