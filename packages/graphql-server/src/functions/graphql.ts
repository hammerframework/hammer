/* eslint-disable react-hooks/rules-of-hooks */
import { useApolloServerErrors } from '@envelop/apollo-server-errors'
import {
  envelop,
  FormatErrorHandler,
  useErrorHandler,
  useMaskedErrors,
  useSchema,
  Plugin,
  EnvelopError,
} from '@envelop/core'
import { useDepthLimit, DepthLimitConfig } from '@envelop/depth-limit'
import { useDisableIntrospection } from '@envelop/disable-introspection'
import { useFilterAllowedOperations } from '@envelop/filter-operation-type'
import type { AllowedOperations } from '@envelop/filter-operation-type'
import { useParserCache } from '@envelop/parser-cache'
import { useValidationCache } from '@envelop/validation-cache'
import type {
  APIGatewayProxyEvent,
  Context as LambdaContext,
  APIGatewayProxyResult,
} from 'aws-lambda'
import { GraphQLError, GraphQLSchema } from 'graphql'
import {
  Request,
  getGraphQLParameters,
  processRequest,
  shouldRenderGraphiQL,
} from 'graphql-helix'
import { renderPlaygroundPage } from 'graphql-playground-html'
import { BaseLogger } from 'pino'
import { v4 as uuidv4 } from 'uuid'

import { ApolloError, AuthContextPayload } from '@redwoodjs/api'
import { getAuthenticationContext } from '@redwoodjs/api'
import {
  getPerRequestContext,
  setContext,
  usePerRequestContext,
} from '@redwoodjs/api'

import { CorsConfig, createCorsContext } from 'src/cors'
import { createHealthcheckContext, OnHealthcheckFn } from 'src/healthcheck'

export type GetCurrentUser = (
  decoded: AuthContextPayload[0],
  raw: AuthContextPayload[1],
  req?: AuthContextPayload[2]
) => Promise<null | Record<string, unknown> | string>

export type Context = Record<string, unknown>
export type ContextFunction = (...args: any[]) => Context | Promise<Context>
export type RedwoodGraphQLContext = {
  event: APIGatewayProxyEvent
  // TODO: Maybe this needs a better name?
  context: LambdaContext
}

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
 * GraphQLHandlerOptions
 */
interface GraphQLHandlerOptions {
  /**
   * @description Customize GraphQL Logger
   *
   * Collect resolver timings, and exposes trace data for
   * an individual request under extensions as part of the GraphQL response.
   */
  loggerConfig: LoggerConfig

  /**
   * @description  Modify the resolver and global context.
   */
  context?: Context | ContextFunction

  /**
   * A @description n async function that maps the auth token retrieved from the request headers to an object.
   * Is it executed when the `auth-provider` contains one of the supported providers.
   */
  getCurrentUser?: GetCurrentUser

  /**
   *  @description A callback when an unhandled exception occurs. Use this to disconnect your prisma instance.
   */
  onException?: () => void

  /**
   * T @description he GraphQL Schema
   */
  schema: GraphQLSchema

  /**
   *  @description CORS configuration
   */
  cors?: CorsConfig

  /**
   *  @description Healthcheck
   */
  onHealthCheck?: OnHealthcheckFn

  /**
   *  @description Limit the complexity of the queries solely by their depth.
   *
   * @see https://www.npmjs.com/package/graphql-depth-limit#documentation
   */
  depthLimitOptions?: DepthLimitConfig

  /**
   * @description  Only allows the specified operation types (e.g. subscription, query or mutation).
   *
   * By default, only allow query and mutation (ie, do not allow subscriptions).
   *
   * @see https://github.com/dotansimha/envelop/tree/main/packages/plugins/filter-operation-type
   */

  allowedOperations?: AllowedOperations

  /**
   * @description  Custom Envelop plugins
   */
  extraPlugins?: Plugin<any>[]

  /**
   * @description  Customize the GraphiQL Endpoint that appears in the location bar of the GraphQL Playground
   *
   * Defaults to '/graphql' as this value must match the name of the `graphql` function on the api-side.
   *
   */
  graphiQLEndpoint?: string
}

/**
 * Extracts and parses body payload from event with base64 encoding check
 *
 */
const parseEventBody = (event: APIGatewayProxyEvent) => {
  if (event.isBase64Encoded) {
    return JSON.parse(Buffer.from(event.body || '', 'base64').toString('utf-8'))
  } else {
    return event.body && JSON.parse(event.body)
  }
}

function normalizeRequest(event: APIGatewayProxyEvent): Request {
  const body = parseEventBody(event)

  return {
    headers: event.headers || {},
    method: event.httpMethod,
    query: event.queryStringParameters,
    body,
  }
}

function redwoodErrorHandler(errors: Readonly<GraphQLError[]>) {
  for (const error of errors) {
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
}

/**
 * Envelop plugin for injecting the current user into the GraphQL Context,
 * based on custom getCurrentUser function.
 */
const useRedwoodAuthContext = (
  getCurrentUser: GraphQLHandlerOptions['getCurrentUser']
): Plugin<RedwoodGraphQLContext> => {
  return {
    async onContextBuilding({ context, extendContext }) {
      const lambdaContext = context.context as any

      const authContext = await getAuthenticationContext({
        event: context.event,
        context: lambdaContext,
      })

      if (authContext) {
        const currentUser = getCurrentUser
          ? await getCurrentUser(authContext[0], authContext[1], authContext[2])
          : authContext

        lambdaContext.currentUser = currentUser
      }

      // TODO: Maybe we don't need to spread the entire object here? since it's already there
      extendContext(lambdaContext)
    },
  }
}

export const useUserContext = (
  userContextBuilder: NonNullable<GraphQLHandlerOptions['context']>
): Plugin<RedwoodGraphQLContext> => {
  return {
    async onContextBuilding({ context, extendContext }) {
      const userContext =
        typeof userContextBuilder === 'function'
          ? await userContextBuilder({ context })
          : userContextBuilder

      extendContext(userContext)
    },
  }
}

/**
 * This Envelop plugin waits until the GraphQL context is done building and sets the
 * Redwood global context which can be imported with:
 * // import { context } from '@redwoodjs/api'
 * @returns
 */
export const useRedwoodGlobalContextSetter =
  (): Plugin<RedwoodGraphQLContext> => ({
    onContextBuilding() {
      return ({ context }) => {
        setContext(context)
      }
    },
  })

/**
 * This plugin logs every time an operation is being executed and
 * when the execution of the operation is done.
 *
 * It adds information using a child logger from the context
 * such as the operation name, request id, errors, and header info
 * to help trace and diagnose issues.
 *
 * Tracing and timing information can be enabled via the
 * GraphQLHandlerOptions traction option.
 *
 * @see https://www.envelop.dev/docs/plugins/lifecycle
 * @returns
 */
const useRedwoodLogger = (
  loggerConfig: LoggerConfig
): Plugin<RedwoodGraphQLContext> => {
  const logger = loggerConfig.logger

  const childLogger = logger.child({
    name: 'graphql-server',
  })

  const includeData = loggerConfig?.options?.data
  const includeOperationName = loggerConfig?.options?.operationName
  const includeRequestId = loggerConfig?.options?.requestId
  const includeTracing = loggerConfig?.options?.tracing
  const includeUserAgent = loggerConfig?.options?.userAgent
  const includeQuery = loggerConfig?.options?.query

  return {
    onExecute({ args }) {
      const options = {} as any

      if (includeOperationName && args.operationName) {
        options['operationName'] = args.operationName
      }

      if (includeQuery) {
        options['query'] = args.variableValues && args.variableValues
      }

      if (includeRequestId) {
        options['requestId'] = args.contextValue.awsRequestId || uuidv4()
      }

      if (includeUserAgent) {
        options['userAgent'] = args.contextValue.event?.headers['user-agent']
      }

      const envelopLogger = childLogger.child({
        ...options,
      })

      envelopLogger.info(`GraphQL execution started`)

      return {
        onExecuteDone({ result }) {
          const options = {} as any

          if (includeData) {
            options['data'] = result.data
          }

          if (result.errors && result.errors.length > 0) {
            envelopLogger.error(
              {
                errors: result.errors,
              },
              `GraphQL execution completed with errors:`
            )
          } else {
            if (includeTracing) {
              options['tracing'] = args.contextValue._envelopTracing
            }

            envelopLogger.info(
              {
                ...options,
              },
              `GraphQL execution completed`
            )
          }
        },
      }
    },
  }
}

/*
 * Prevent unexpected error messages from leaking to the GraphQL clients.
 *
 * Unexpected errors are those that are not Envelop or Apollo errors
 *
 * Note that error masking should come after useApolloServerErrors since the originalError
 * will could become an ApolloError but if not, then should get masked
 **/
export const formatError: FormatErrorHandler = (err) => {
  if (
    err.originalError &&
    err.originalError instanceof EnvelopError === false &&
    err.originalError instanceof ApolloError === false
  ) {
    return new GraphQLError('Something went wrong.')
  }

  return err
}

/**
 * Creates an Enveloped GraphQL Server.
 *
 * @see https://www.envelop.dev/ for information about envelop
 * @see https://www.envelop.dev/plugins for available envelop plugins
 * ```js
 * export const handler = createGraphQLHandler({ schema, context, getCurrentUser })
 * ```
 */
export const createGraphQLHandler = ({
  loggerConfig,
  schema,
  context,
  getCurrentUser,
  onException,
  extraPlugins,
  cors,
  onHealthCheck,
  depthLimitOptions,
  allowedOperations,
  graphiQLEndpoint,
}: GraphQLHandlerOptions) => {
  // Important: Plugins are executed in order of their usage, and inject functionality serially,
  // so the order here matters
  const plugins: Plugin<any>[] = [
    // Simple LRU for caching parse results.
    useParserCache(),
    // Simple LRU for caching validate results.
    useValidationCache(),
    // Simplest plugin to provide your GraphQL schema.
    useSchema(schema),
    // Custom Redwood plugins
    useRedwoodAuthContext(getCurrentUser),
    useRedwoodGlobalContextSetter(),
    useRedwoodLogger(loggerConfig),
    // Limits the depth of your GraphQL selection sets.
    useDepthLimit({
      maxDepth: (depthLimitOptions && depthLimitOptions.maxDepth) || 10,
      ignore: (depthLimitOptions && depthLimitOptions.ignore) || [],
    }),
    // Only allow execution of specific operation types
    useFilterAllowedOperations(allowedOperations || ['mutation', 'query']),
    // Apollo Server compatible errors.
    // Important: *must* be listed before useMaskedErrors
    useApolloServerErrors(),
    // Prevent unexpected error messages from leaking to the GraphQL clients.
    // Important: *must* be listed after useApolloServerErrors so it can detect if the error is an ApolloError
    // and mask if not
    useMaskedErrors({ formatError }),
  ]

  const isDevEnv = process.env.NODE_ENV === 'development'

  if (!isDevEnv) {
    plugins.push(useDisableIntrospection())
  }

  if (isDevEnv) {
    plugins.push(useErrorHandler(redwoodErrorHandler))
  }

  if (context) {
    plugins.push(useUserContext(context))
  }

  if (extraPlugins && extraPlugins.length > 0) {
    plugins.push(...extraPlugins)
  }

  const corsContext = createCorsContext(cors)

  const healthcheckContext = createHealthcheckContext(
    onHealthCheck,
    corsContext
  )

  const createSharedEnvelop = envelop({
    plugins,
    enableInternalTracing: loggerConfig.options?.tracing,
  })

  const handlerFn = async (
    event: APIGatewayProxyEvent,
    lambdaContext: LambdaContext
  ): Promise<APIGatewayProxyResult> => {
    const enveloped = createSharedEnvelop({ event, context: lambdaContext })

    const logger = loggerConfig.logger

    // In the future, this could be part of a specific handler for AWS lambdas
    lambdaContext.callbackWaitsForEmptyEventLoop = false

    // In the future, the normalizeRequest can take more flexible params, maybe even cloud provider name
    // and return a normalized request structure.
    const request = normalizeRequest(event)

    if (healthcheckContext.isHealthcheckRequest(event.path)) {
      return healthcheckContext.handleHealthCheck(request, event)
    }

    const corsHeaders = cors ? corsContext.getRequestHeaders(request) : {}

    if (corsContext.shouldHandleCors(request)) {
      return {
        body: '',
        statusCode: 200,
        headers: corsHeaders,
      }
    }

    if (isDevEnv && shouldRenderGraphiQL(request)) {
      return {
        body: renderPlaygroundPage({
          endpoint: graphiQLEndpoint || '/graphql',
        }),
        statusCode: 200,
        headers: {
          'Content-Type': 'text/html',
          ...corsHeaders,
        },
      }
    }

    const { operationName, query, variables } = getGraphQLParameters(request)

    let lambdaResponse: APIGatewayProxyResult

    try {
      const result = await processRequest({
        operationName,
        query,
        variables,
        request,
        validationRules: undefined,
        ...enveloped,
        contextFactory: enveloped.contextFactory,
      })

      if (result.type === 'RESPONSE') {
        lambdaResponse = {
          body: JSON.stringify(result.payload),
          statusCode: 200,
          headers: {
            ...(result.headers || {}).reduce(
              (prev, header) => ({ ...prev, [header.name]: header.value }),
              {}
            ),
            ...corsHeaders,
          },
        }
      } else if (result.type === 'MULTIPART_RESPONSE') {
        lambdaResponse = {
          body: JSON.stringify({ error: 'Streaming is not supported yet!' }),
          statusCode: 500,
        }
      } else {
        lambdaResponse = {
          body: JSON.stringify({ error: 'Unexpected flow' }),
          statusCode: 500,
        }
      }
    } catch (e) {
      logger.error(e)
      onException && onException()

      lambdaResponse = {
        body: JSON.stringify({ error: 'GraphQL execution failed' }),
        statusCode: 200, // should be 500
      }
    }

    if (!lambdaResponse.headers) {
      lambdaResponse.headers = {}
    }

    lambdaResponse.headers['Content-Type'] = 'application/json'

    return lambdaResponse
  }

  return (
    event: APIGatewayProxyEvent,
    context: LambdaContext
  ): Promise<any> => {
    const execFn = async () => {
      try {
        return await handlerFn(event, context)
      } catch (e) {
        onException && onException()

        throw e
      }
    }

    if (usePerRequestContext()) {
      // This must be used when you're self-hosting RedwoodJS.
      return getPerRequestContext().run(new Map(), execFn)
    } else {
      // This is OK for AWS (Netlify/Vercel) because each Lambda request
      // is handled individually.
      return execFn()
    }
  }
}
