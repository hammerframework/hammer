import type { Context, ContextFunction } from 'apollo-server-core'
import { ApolloServer } from 'apollo-server-lambda'
import type { Config, CreateHandlerOptions } from 'apollo-server-lambda'
import type { APIGatewayProxyEvent, Context as LambdaContext } from 'aws-lambda'

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

interface GraphQLHandlerOptions extends Config {
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

  cors?: CreateHandlerOptions['cors']
  onHealthCheck?: CreateHandlerOptions['onHealthCheck']
}
/**
 * Creates an Apollo GraphQL Server.
 *
 * ```js
 * export const handler = createGraphQLHandler({ schema, context, getCurrentUser })
 * ```
 */
export const createGraphQLHandler = ({
  context,
  getCurrentUser,
  onException,
  cors,
  onHealthCheck,
  ...options
}: GraphQLHandlerOptions = {}) => {
  const isDevEnv = process.env.NODE_ENV === 'development'
  const handler = new ApolloServer({
    // Turn off playground, introspection and debug in production.
    debug: isDevEnv,
    introspection: isDevEnv,
    playground: isDevEnv,
    // Log the errors in the console
    formatError: (error) => {
      if (isDevEnv) {
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
