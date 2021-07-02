/* eslint-disable react-hooks/rules-of-hooks */
import { useApolloTracing } from '@envelop/apollo-tracing'
import {
  envelop,
  useErrorHandler,
  useMaskedErrors,
  useSchema,
  Plugin,
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

import type { AuthContextPayload } from '@redwoodjs/api'
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

interface GraphQLHandlerOptions {
  /**
   * Customize GraphQL Logger
   */
  logger: BaseLogger

  /**
   * Modify the resolver and global context.
   */
  context?: Context | ContextFunction

  /**
   * An async function that maps the auth token retrieved from the request headers to an object.
   * Is it executed when the `auth-provider` contains one of the supported providers.
   */
  getCurrentUser?: GetCurrentUser

  /**
   * A callback when an unhandled exception occurs. Use this to disconnect your prisma instance.
   */
  onException?: () => void

  /**
   * The GraphQL Schema
   */
  schema: GraphQLSchema

  /**
   * CORS configuration
   */
  cors?: CorsConfig

  /**
   * Healthcheck
   */
  onHealthCheck?: OnHealthcheckFn

  /**
   * Limit the complexity of the queries solely by their depth.
   * @see https://www.npmjs.com/package/graphql-depth-limit#documentation
   */
  depthLimit?: DepthLimitConfig

  /**
   * Only allows the specified operation types (e.g. subscription, query or mutation).
   *
   * By default, only allow query and mutation (ie, do not allow subscriptions).
   *
   * @see https://github.com/dotansimha/envelop/tree/main/packages/plugins/filter-operation-type
   */

  allowedOperations?: AllowedOperations

  /**
   * Custom Envelop plugins
   */
  extraPlugins?: Plugin<any>[]

  /**
   * Customize the GraphiQL Endpoint that appears in the location bar of the GraphQL Playground
   *
   * Defaults to '/graphql' as this value must match the name of the `graphql` function on the api-side.
   *
   */
  graphiQLEndpoint?: string
}

function normalizeRequest(event: APIGatewayProxyEvent): Request {
  return {
    headers: event.headers || {},
    method: event.httpMethod,
    query: event.queryStringParameters,
    body: event.body && JSON.parse(event.body),
  }
}

function redwoodErrorHandler(errors: Readonly<GraphQLError[]>) {
  for (const error of errors) {
    // I want the api-server to pick this up!?
    // TODO: Move the error handling into a separate package
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    import('@redwoodjs/api-server/dist/error')
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

const useRedwoodLogger = (
  baseLogger: BaseLogger
): Plugin<RedwoodGraphQLContext> => {
  const childLogger = baseLogger.child({ name: 'graphql-server' })

  return {
    onExecute({ args }) {
      childLogger.info(
        {
          operationName: args.operationName,
          userAgent: args.contextValue.event.headers['user-agent'],
        },
        `GraphQL execution started`
      )

      return {
        onExecuteDone({ result }) {
          if (result.errors && result.errors.length > 0) {
            childLogger.error(
              {
                operationName: args.operationName,
                errors: result.errors,
              },
              `GraphQL execution completed with errors:`
            )
          } else {
            childLogger.info(
              {
                operationName: args.operationName,
                userAgent: args.contextValue.event.headers['user-agent'],
                envelopTracing: args.contextValue._envelopTracing,
              },
              `GraphQL execution completed`
            )
          }
        },
      }
    },
  }
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
  logger,
  schema,
  context,
  getCurrentUser,
  onException,
  extraPlugins,
  cors,
  onHealthCheck,
  depthLimit,
  allowedOperations,
  graphiQLEndpoint,
}: GraphQLHandlerOptions) => {
  const plugins: Plugin<any>[] = [
    // Limits the depth of your GraphQL selection sets.
    useDepthLimit({
      maxDepth: (depthLimit && depthLimit.maxDepth) || 5,
      ignore: (depthLimit && depthLimit.ignore) || [],
    }),
    // Only allow execution of specific operation types
    useFilterAllowedOperations(allowedOperations || ['mutation', 'query']),
    // Prevent unexpected error messages from leaking to the GraphQL clients.
    useMaskedErrors(),
    // Simple LRU for caching parse results.
    useParserCache(),
    // Simple LRU for caching validate results.
    useValidationCache(),
    // Simplest plugin to provide your GraphQL schema.
    useSchema(schema),
    // Custom Redwood plugins
    useRedwoodAuthContext(getCurrentUser),
    useRedwoodGlobalContextSetter(),
    useRedwoodLogger(logger),
  ]

  const isDevEnv = process.env.NODE_ENV === 'development'

  if (!isDevEnv) {
    plugins.push(useDisableIntrospection())
  }

  if (isDevEnv) {
    plugins.push(useApolloTracing())
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
    enableInternalTracing: isDevEnv,
  })

  const handlerFn = async (
    event: APIGatewayProxyEvent,
    lambdaContext: LambdaContext
  ): Promise<APIGatewayProxyResult> => {
    const enveloped = createSharedEnvelop({ event, context: lambdaContext })

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

    if (shouldRenderGraphiQL(request)) {
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
