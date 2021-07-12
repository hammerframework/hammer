export * from './parseJWT'

import type { APIGatewayProxyEvent, Context as LambdaContext } from 'aws-lambda'

import type { SupportedAuthTypes } from '@redwoodjs/auth'

import type { GlobalContext } from 'src/globalContext'

import { decodeToken } from './decoders'

// This is shared by `@redwoodjs/web`
const AUTH_PROVIDER_HEADER = 'auth-provider'

export const getAuthProviderHeader = (
  event: APIGatewayProxyEvent
): SupportedAuthTypes => {
  return event?.headers[AUTH_PROVIDER_HEADER] as SupportedAuthTypes
}

export interface AuthorizationHeader {
  schema: 'Bearer' | 'Basic' | string
  token: string
}
/**
 * Split the `Authorization` header into a schema and token part.
 */
export const parseAuthorizationHeader = (
  event: APIGatewayProxyEvent
): AuthorizationHeader => {
  const parts = event.headers?.authorization?.split(' ')
  if (parts?.length !== 2) {
    throw new Error('The `Authorization` header is not valid.')
  }
  const [schema, token] = parts
  if (!schema.length || !token.length) {
    throw new Error('The `Authorization` header is not valid.')
  }
  return { schema, token }
}

export type AuthContextPayload = [
  string | Record<string, unknown> | null,
  { type: SupportedAuthTypes } & AuthorizationHeader,
  { event: APIGatewayProxyEvent; context: GlobalContext & LambdaContext }
]

/**
 * Get the authorization information from the request headers and request context.
 * @returns [decoded, { type, schema, token }, { event, context }]
 **/
export const getAuthenticationContext = async ({
  event,
  context,
}: {
  event: APIGatewayProxyEvent
  context: GlobalContext & LambdaContext
}): Promise<undefined | AuthContextPayload> => {
  const type = getAuthProviderHeader(event)
  // No `auth-provider` header means that the user is logged out,
  // and none of this is auth malarky is required.
  if (!type) {
    return undefined
  }

  let decoded = null
  const { schema, token } = parseAuthorizationHeader(event)
  decoded = await decodeToken(type, token, { event, context })
  return [decoded, { type, schema, token }, { event, context }]
}
